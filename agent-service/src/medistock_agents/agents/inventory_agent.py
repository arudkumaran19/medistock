import re
from typing import Any

from medistock_agents.models.agent_models import ActionType, AgentResult, InventoryAction, InventoryInsight
from medistock_agents.tools.inventory_tools import BackendUnavailableError


class InventoryAgent:
	_MUTATION_VERB = re.compile(r"^\s*(?:(?:please|can you|could you)\s+)*(adjust|increase|reduce|decrease|add|remove)\b", re.IGNORECASE)

	@classmethod
	def _mutation_intent(cls, question: str) -> tuple[str, int] | None:
		match = cls._MUTATION_VERB.search(question)
		if not match:
			return None
		verb = match.group(1).casefold()
		quantity = re.search(r"\bby\s+(\d+)\b", question, re.IGNORECASE)
		if quantity is None and verb in {"add", "remove"}:
			quantity = re.search(r"\b(?:add|remove)\s+(\d+)\s+(?:units?\s+)?of\b", question, re.IGNORECASE)
		if quantity is None:
			return verb, 0
		amount = int(quantity.group(1))
		return verb, -amount if verb in {"reduce", "decrease", "remove"} else amount

	@staticmethod
	def _catalog_match(question: str, records: list[dict[str, Any]], fields: tuple[str, ...]) -> dict[str, Any] | None:
		"""Find the longest catalog name/code mentioned in a natural-language question."""
		normalize = lambda value: re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()
		query = f" {normalize(question)} "
		candidates = []
		for record in records:
			for field in fields:
				value = normalize(record.get(field))
				if value and f" {value} " in query:
					candidates.append((len(value), record))
		if candidates:
			return max(candidates, key=lambda candidate: candidate[0])[1]
		# Allow a unique base medicine name (for example "Amoxicillin") to resolve
		# a catalog entry that includes a strength suffix ("Amoxicillin 250 mg").
		prefix_matches: list[tuple[int, dict[str, Any]]] = []
		for record in records:
			for field in fields:
				name = normalize(record.get(field)).split()
				for length in range(1, len(name)):
					prefix = " ".join(name[:length])
					if f" {prefix} " in query:
						prefix_matches.append((length, record))
		if not prefix_matches:
			return None
		longest = max(length for length, _ in prefix_matches)
		unique_records = {str(record.get("id")): record for length, record in prefix_matches if length == longest}
		return next(iter(unique_records.values())) if len(unique_records) == 1 else None

	def plan(self, action: InventoryAction) -> list[str]:
		if action.action_type == ActionType.ASK:
			return ["understand the inventory question", "retrieve matching inventory data from the MediStock API", "summarize results with current stock context"]
		if action.action_type == ActionType.ANALYZE:
			return ["retrieve stock balances and expiring batches", "calculate low-stock and expiry insights", "report inventory risks"]
		return ["classify inventory request", "run deterministic inventory validation", "request human approval for stock mutations", "execute through backend API"]

	def validate(self, action: InventoryAction) -> list[str]:
		errors: list[str] = []
		if action.action_type == ActionType.ASK and not str(action.payload.get("question", "")).strip():
			errors.append("question is required")
		if action.action_type in {ActionType.RECEIVE, ActionType.ADJUST, ActionType.RESERVE} and (not action.payload.get("medicineId") or not action.payload.get("facilityId")):
			errors.append("medicineId and facilityId are required")
		if action.action_type in {ActionType.RECEIVE, ActionType.RESERVE}:
			try:
				if int(action.payload.get("quantity", 0)) <= 0: errors.append("quantity must be greater than zero")
			except (TypeError, ValueError):
				errors.append("quantity must be an integer")
		if action.action_type == ActionType.ADJUST and not action.payload.get("reason"): errors.append("reason is required for adjustments")
		return errors

	async def _classify_mutation(self, question: str, backend: Any) -> tuple[InventoryAction, list[str], str | None] | None:
		intent = self._mutation_intent(question)
		if intent is None:
			return None
		verb, quantity_delta = intent
		medicines = await backend.get_medicines()
		medicine = self._catalog_match(question, medicines, ("name", "code"))
		facilities = await backend.get_facilities()
		facility = self._catalog_match(question, facilities, ("name", "code"))
		balances = await backend.get_inventory()
		balance = None
		issues: list[str] = []
		if medicine is None:
			issues.append("Name a medicine or medicine code that exists in the inventory catalog.")
		else:
			medicine_balances = [row for row in balances if str(row.get("medicineId")) == str(medicine["id"])]
			if facility is not None:
				facility_balances = [row for row in medicine_balances if str(row.get("facilityId")) == str(facility["id"])]
				balance = next(iter(facility_balances), None)
				if balance is None:
					issues.append(f"No inventory balance was found for {medicine.get('name')} at {facility.get('name')}.")
			elif len(medicine_balances) == 1:
				balance = medicine_balances[0]
			elif len(medicine_balances) > 1:
				issues.append(f"Name the facility for {medicine.get('name')} so I can scope the requested adjustment.")
			else:
				issues.append(f"No inventory balance was found for {medicine.get('name')}.")
		if quantity_delta == 0:
			issues.append("Include a nonzero adjustment quantity, such as 'by 10 units'.")

		payload: dict[str, Any] = {"quantityDelta": quantity_delta}
		if medicine is not None:
			payload["medicineId"] = medicine["id"]
		if facility is not None:
			payload["facilityId"] = facility["id"]
		elif balance is not None:
			payload["facilityId"] = balance["facilityId"]
		if medicine is not None and balance is not None and quantity_delta:
			current = int(balance.get("quantityOnHand", 0))
			reserved = int(balance.get("quantityReserved", 0))
			if current + quantity_delta < reserved:
				issues.append("The adjustment would make available stock negative.")
		payload["reason"] = f"Agent-requested stock adjustment: {verb} {abs(quantity_delta)} units"
		action = InventoryAction(action_type=ActionType.ADJUST, payload=payload, requires_approval=True)
		answer = None
		if balance is not None and medicine is not None and not issues:
			facility_name = facility.get("name") if facility is not None else balance.get("facilityName", "the selected facility")
			verb_phrase = "increase" if quantity_delta > 0 else "decrease"
			answer = f"Proposed adjustment: {medicine.get('name')} at {facility_name}, {verb_phrase} by {abs(quantity_delta)} units (from {balance.get('quantityOnHand')} to {int(balance.get('quantityOnHand', 0)) + quantity_delta}). Approve to record this change."
		return action, issues, answer

	def analyze(self, balances: list[dict[str, Any]], expiring: list[dict[str, Any]]) -> list[InventoryInsight]:
		insights: list[InventoryInsight] = []
		for row in balances:
			if not row.get("isBelowMinimum"): continue
			current = int(row.get("quantityOnHand", 0)); minimum = int(row.get("minimumStockLevel", 0))
			insights.append(InventoryInsight(kind="low_stock", message=f"{row.get('medicineName')} at {row.get('facilityName', 'the facility')} has {current} on hand against a minimum of {minimum}.", medicine_id=row.get("medicineId"), facility_id=row.get("facilityId"), severity="critical" if current == 0 else "warning", details={"currentStock": current, "minimumStock": minimum, "shortfall": max(minimum - current, 0)}))
		insights.extend(InventoryInsight(kind="expiring_stock", message=f"Batch {row.get('batchNumber')} ({row.get('medicineName')}) expires on {row.get('expiryDateUtc')}.", medicine_id=row.get("medicineId"), facility_id=row.get("facilityId"), severity="warning", details={"batchNumber": row.get("batchNumber"), "expiryDateUtc": row.get("expiryDateUtc"), "quantityOnHand": row.get("quantityOnHand")}) for row in expiring)
		return insights

	async def _ask(self, question: str, backend: Any, result: AgentResult) -> None:
		query = question.casefold()
		balances: list[dict[str, Any]] | None = None
		# Load balances only for intents that need them; history resolution uses the catalogs.
		if not any(word in query for word in ("transaction", "history", "decrease", "decreased")):
			balances = await backend.get_inventory()
		if any(word in query for word in ("summary", "overview", "today's inventory", "inventory total")):
			balances = await backend.get_inventory() if balances is None else balances
			medicines = await backend.get_medicines()
			expiring = await backend.get_expiring(30)
			batches = await backend.get_batches()
			low_count = len({row.get("medicineId") for row in balances if row.get("isBelowMinimum")})
			total = sum(int(row.get("quantityOnHand", 0)) for row in balances)
			result.answer = f"Inventory summary: {len(medicines)} active medicines, {total} units on hand, {low_count} medicines below minimum, {len(expiring)} batches expiring within 30 days, and {len(batches)} active batches."
			return

		batch_match = re.search(r"\bbatch\s+([a-z0-9][a-z0-9_-]{2,})\b", question, re.IGNORECASE)
		if "batch" in query and batch_match:
			batch = await backend.get_batch(batch_match.group(1))
			if batch:
				result.answer = f"Batch {batch.get('batchNumber')}: {batch.get('medicineName')}, {batch.get('quantityOnHand')} on hand, manufactured {batch.get('manufacturingDateUtc')}, expires {batch.get('expiryDateUtc')}."
				result.insights.append(InventoryInsight(kind="batch_detail", message=result.answer, medicine_id=batch.get("medicineId"), facility_id=batch.get("facilityId"), details=batch))
			else: result.answer = f"No batch matching {batch_match.group(1)} was found."
			return

		if "expir" in query:
			match = re.search(r"(\d+)\s*days?", query)
			days = min(int(match.group(1)), 3650) if match else 30
			rows = await backend.get_expiring(days)
			result.insights.extend(self.analyze([], rows))
			result.answer = f"{len(rows)} active batches expire within {days} days. " + ("; ".join(f"{x.get('medicineName')} batch {x.get('batchNumber')} on {x.get('expiryDateUtc')} ({x.get('quantityOnHand')} on hand)" for x in rows[:8]) or "No matching batches were found.")
			return

		if "low" in query or "minimum" in query or "shortfall" in query:
			balances = await backend.get_inventory() if balances is None else balances
			rows = [row for row in balances if row.get("isBelowMinimum")]
			facility_matches = [row for row in rows if str(row.get("facilityName", "")).casefold() in query]
			if facility_matches: rows = facility_matches
			medicine_matches = [row for row in rows if str(row.get("medicineName", "")).casefold() in query]
			if medicine_matches: rows = medicine_matches
			result.insights.extend(self.analyze(rows, []))
			if rows:
				result.answer = "; ".join(f"{x.get('medicineName')} at {x.get('facilityName')}: {x.get('quantityOnHand')} on hand, minimum {x.get('minimumStockLevel')}, short by {max(int(x.get('minimumStockLevel', 0)) - int(x.get('quantityOnHand', 0)), 0)}" for x in rows[:8])
			else: result.answer = "No low-stock balances matched that request."
			return

		if "transaction" in query or "history" in query or "decrease" in query or "decreased" in query:
			medicines = await backend.get_medicines()
			medicine = self._catalog_match(question, medicines, ("name", "code"))
			if not medicine:
				result.answer = "Name the medicine or medicine code so I can look up its stock transactions."
				return
			facilities = await backend.get_facilities()
			facility = self._catalog_match(question, facilities, ("name", "code"))
			if facility:
				scopes = [facility]
			else:
				scopes = facilities
			if not scopes:
				result.answer = f"No active facilities are available to look up transactions for {medicine.get('name', 'that medicine')}."
				return
			is_history = "transaction" in query or "history" in query
			records: list[tuple[dict[str, Any], dict[str, Any]]] = []
			for scope in scopes:
				transactions = await backend.get_transactions(str(medicine["id"]), str(scope["id"]))
				if not is_history:
					transactions = [tx for tx in transactions if int(tx.get("quantity", 0)) < 0]
				records.extend((scope, tx) for tx in transactions)
			if not records:
				result.answer = (f"No stock transactions were found for {medicine.get('name', 'that medicine')}" + (f" at {facility.get('name')}" if facility else "") + ".")
				return
			records.sort(key=lambda item: str(item[1].get("createdAtUtc", "")), reverse=True)
			label = "Transaction history" if is_history else "Stock decreases"
			result.answer = label + " for " + str(medicine.get("name", medicine.get("code", "that medicine"))) + ": " + "; ".join(
				f"{tx.get('type')} {tx.get('quantity')} at {scope.get('name', 'facility')} on {tx.get('createdAtUtc')}: {tx.get('reason')} (balance after {tx.get('balanceAfter')}, batch {tx.get('batchNumber') or 'n/a'})"
				for scope, tx in records[:20]
			)
			return

		balances = await backend.get_inventory() if balances is None else balances
		matches = [row for row in balances if str(row.get("medicineName", "")).casefold() in query or str(row.get("facilityName", "")).casefold() in query]
		result.insights.extend(self.analyze([row for row in matches if row.get("isBelowMinimum")], []))
		result.answer = "; ".join(f"{x.get('medicineName')} at {x.get('facilityName')}: {x.get('quantityOnHand')} on hand, {x.get('availableQuantity')} available" for x in matches[:8]) if matches else "No inventory balances matched that request. Try a medicine or facility name, or ask for low stock, expiry, a batch, or the inventory summary."

	async def run(self, action: InventoryAction, backend: Any, approved: bool = False) -> AgentResult:
		intent_errors: list[str] = []
		intent_question: str | None = None
		intent_answer: str | None = None
		if action.action_type == ActionType.ASK:
			intent_question = str(action.payload.get("question", "")).strip()
			if intent_question:
				try:
					classified = await self._classify_mutation(intent_question, backend)
				except BackendUnavailableError as error:
					classified = None
					intent_errors.append(str(error))
				if classified is not None:
					action, intent_errors, intent_answer = classified
		errors = self.validate(action)
		errors.extend(issue for issue in intent_errors if issue not in errors)
		is_mutation = action.action_type in {ActionType.RECEIVE, ActionType.ADJUST, ActionType.RESERVE}
		result = AgentResult(plan=self.plan(action), insights=[], validation_errors=errors, approval_required=is_mutation)
		if intent_question is not None:
			result.answer = intent_answer or (intent_errors[0] if intent_errors else None)
		if errors: return result
		if action.action_type == ActionType.ANALYZE:
			try:
				result.insights = self.analyze(await backend.get_inventory(), await backend.get_expiring())
				result.answer = f"Found {sum(1 for x in result.insights if x.kind == 'low_stock')} low-stock balances and {sum(1 for x in result.insights if x.kind == 'expiring_stock')} expiring batches."
			except BackendUnavailableError as error: result.validation_errors.append(str(error))
			return result
		if action.action_type == ActionType.ASK:
			try: await self._ask(str(action.payload["question"]).strip(), backend, result)
			except BackendUnavailableError as error: result.validation_errors.append(str(error))
			return result
		if not approved: return result
		try:
			result.backend_result = await backend.execute(action.action_type.value, action.payload); result.executed = True
			if intent_question is not None:
				result.answer = "The approved stock adjustment was recorded."
		except BackendUnavailableError as error: result.validation_errors.append(str(error))
		return result
