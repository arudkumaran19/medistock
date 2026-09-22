from typing import Any
from medistock_agents.models.agent_models import AgentResult, InventoryAction, InventoryInsight, ActionType
from medistock_agents.tools.inventory_tools import BackendUnavailableError

class InventoryAgent:
	def plan(self, action: InventoryAction) -> list[str]:
		return ["classify inventory request", "run deterministic inventory validation", "request human approval for stock mutations", "execute through backend API"]
	def validate(self, action: InventoryAction) -> list[str]:
		errors: list[str] = []
		if action.action_type in {ActionType.RECEIVE, ActionType.ADJUST, ActionType.RESERVE} and (not action.payload.get("medicineId") or not action.payload.get("facilityId")): errors.append("medicineId and facilityId are required")
		if action.action_type in {ActionType.RECEIVE, ActionType.RESERVE}:
			try:
				if int(action.payload.get("quantity", 0)) <= 0: errors.append("quantity must be greater than zero")
			except (TypeError, ValueError):
				errors.append("quantity must be an integer")
		if action.action_type == ActionType.ADJUST and not action.payload.get("reason"): errors.append("reason is required for adjustments")
		return errors
	def analyze(self, balances: list[dict[str, Any]], expiring: list[dict[str, Any]]) -> list[InventoryInsight]:
		insights = [InventoryInsight(kind="low_stock", message=f"{x.get('medicineName')} is below minimum stock", medicine_id=x.get("medicineId"), facility_id=x.get("facilityId"), severity="warning") for x in balances if x.get("isBelowMinimum")]
		insights.extend(InventoryInsight(kind="expiring_stock", message=f"Batch {x.get('batchNumber')} expires on {x.get('expiryDateUtc')}", medicine_id=x.get("medicineId"), facility_id=x.get("facilityId"), severity="warning") for x in expiring)
		return insights
	async def run(self, action: InventoryAction, backend: Any, approved: bool = False) -> AgentResult:
		errors = self.validate(action); result = AgentResult(plan=self.plan(action), insights=[], validation_errors=errors, approval_required=action.action_type != ActionType.ANALYZE)
		if errors or action.action_type == ActionType.ANALYZE:
			if action.action_type == ActionType.ANALYZE:
				try:
					result.insights = self.analyze(await backend.get_inventory(), await backend.get_expiring())
				except BackendUnavailableError as error:
					result.validation_errors.append(str(error))
			return result
		if not approved: return result
		try:
			result.backend_result = await backend.execute(action.action_type.value, action.payload); result.executed = True
		except BackendUnavailableError as error:
			result.validation_errors.append(str(error))
		return result
