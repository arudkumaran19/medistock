import pytest
from fastapi.testclient import TestClient
from medistock_agents.api import routes
from medistock_agents.agents.inventory_agent import InventoryAgent
from medistock_agents.models.agent_models import ActionType, InventoryAction
from medistock_agents.main import app
from medistock_agents.tools.inventory_tools import BackendUnavailableError, InventoryBackend
class FakeBackend:
	def __init__(self, include_demo_balances=False): self.transaction_scopes = []; self.execute_calls = []; self.include_demo_balances = include_demo_balances
	async def get_inventory(self):
		rows = [{"medicineName": "Test", "medicineId": "m", "facilityId": "f", "facilityName": "Central Facility", "quantityOnHand": 0, "quantityReserved": 0, "isBelowMinimum": True}]
		if self.include_demo_balances:
			rows.extend([
				{"medicineName": "Vitamin C", "medicineId": "vitc", "facilityId": "f", "facilityName": "Central Facility", "quantityOnHand": 34, "quantityReserved": 0, "isBelowMinimum": True},
				{"medicineName": "Amoxicillin 250 mg", "medicineId": "amox", "facilityId": "f", "facilityName": "Central Facility", "quantityOnHand": 20, "quantityReserved": 0, "isBelowMinimum": False},
			])
		return rows
	async def get_expiring(self, days=90): return [{"medicineName": "Test", "medicineId": "m", "facilityId": "f", "batchNumber": "b", "expiryDateUtc": "2026-01-01", "quantityOnHand": 2}]
	async def get_medicines(self): return [{"id": "m", "name": "Test", "code": "TEST-001"}, {"id": "vitc", "name": "Vitamin C", "code": "VITC-DEMO"}, {"id": "amox", "name": "Amoxicillin 250 mg", "code": "AMOX-250"}]
	async def get_facilities(self): return [{"id": "f", "name": "Central Facility", "code": "CENTRAL"}, {"id": "north", "name": "Northside Clinic", "code": "NORTH"}]
	async def get_batches(self): return [{"id": "b", "batchNumber": "b-123", "quantityOnHand": 2}]
	async def get_batch(self, batch_number): return {"medicineName": "Test", "medicineId": "m", "facilityId": "f", "batchNumber": batch_number, "quantityOnHand": 2, "expiryDateUtc": "2026-12-01", "manufacturingDateUtc": "2025-12-01"}
	async def get_transactions(self, medicine_id, facility_id):
		self.transaction_scopes.append((medicine_id, facility_id))
		if medicine_id == "vitc": return [{"quantity": 24, "type": "RECEIVE", "reason": "supplier delivery", "balanceAfter": 36, "createdAtUtc": "2026-02-02", "batchNumber": "VC-2026-01"}, {"quantity": -2, "type": "ADJUSTMENT", "reason": "count correction", "balanceAfter": 34, "createdAtUtc": "2026-02-03", "batchNumber": "VC-2026-01"}]
		if medicine_id == "amox": return [{"quantity": 10, "type": "RECEIVE", "reason": "scheduled replenishment", "balanceAfter": 10, "createdAtUtc": "2026-02-04", "batchNumber": "AMX-2026-01"}]
		return [{"quantity": -2, "type": "ADJUSTMENT", "reason": "count correction", "balanceAfter": 3, "createdAtUtc": "2026-02-01"}]
	async def execute(self, action, payload): self.execute_calls.append((action, payload)); return {"action": action, "payload": payload}
class UnavailableBackend:
	async def get_inventory(self): raise BackendUnavailableError("MediStock backend is unavailable.")
	async def get_expiring(self): raise BackendUnavailableError("MediStock backend is unavailable.")
	async def execute(self, action, payload): raise BackendUnavailableError("MediStock backend is unavailable.")
def test_validation_rejects_missing_scope():
	assert "medicineId and facilityId are required" in InventoryAgent().validate(InventoryAction(action_type=ActionType.RESERVE, payload={"quantity": 1}))
	assert "quantity must be an integer" in InventoryAgent().validate(InventoryAction(action_type=ActionType.RESERVE, payload={"medicineId": "m", "facilityId": "f", "quantity": "bad"}))
@pytest.mark.asyncio
async def test_analysis_returns_low_and_expiry_insights():
	result = await InventoryAgent().run(InventoryAction(action_type=ActionType.ANALYZE), FakeBackend()); assert len(result.insights) == 2
@pytest.mark.asyncio
async def test_mutation_requires_approval_and_executes_only_after_approval():
	action = InventoryAction(action_type=ActionType.ADJUST, payload={"medicineId": "m", "facilityId": "f", "quantityDelta": 1, "reason": "count"})
	pending = await InventoryAgent().run(action, FakeBackend()); assert pending.approval_required and not pending.executed
	approved = await InventoryAgent().run(action, FakeBackend(), approved=True); assert approved.executed

@pytest.mark.asyncio
async def test_natural_language_mutation_requires_approval_and_does_not_execute_early():
	backend = FakeBackend(include_demo_balances=True)
	action = InventoryAction(action_type=ActionType.ASK, payload={"question": "Adjust Vitamin C stock by 10 units."})
	pending = await InventoryAgent().run(action, backend)
	assert pending.approval_required is True
	assert pending.executed is False
	assert "from 34 to 44" in pending.answer
	assert backend.execute_calls == []

@pytest.mark.asyncio
async def test_natural_language_mutation_executes_only_after_explicit_approval():
	backend = FakeBackend(include_demo_balances=True)
	action = InventoryAction(action_type=ActionType.ASK, payload={"question": "Adjust Vitamin C stock by 10 units."})
	approved = await InventoryAgent().run(action, backend, approved=True)
	assert approved.approval_required is True and approved.executed is True
	assert backend.execute_calls[0][0] == "adjust"
	assert backend.execute_calls[0][1]["quantityDelta"] == 10

@pytest.mark.parametrize(("question", "expected_delta"), [
	("Increase Vitamin C stock by 10.", 10),
	("Reduce Vitamin C stock by 5.", -5),
	("Add 10 units of Amoxicillin.", 10),
	("Remove 5 units of Paracetamol.", -5),
])
def test_natural_language_mutation_direction_and_quantity_are_classified(question, expected_delta):
	assert InventoryAgent._mutation_intent(question)[1] == expected_delta

@pytest.mark.asyncio
async def test_add_request_resolves_base_medicine_name_with_strength_suffix():
	backend = FakeBackend(include_demo_balances=True)
	result = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Add 10 units of Amoxicillin."}), backend)
	assert result.approval_required and not result.executed
	assert "Amoxicillin 250 mg" in result.answer
	assert backend.execute_calls == []

@pytest.mark.asyncio
async def test_backend_unavailable_returns_useful_analysis_error_without_500():
	result = await InventoryAgent().run(InventoryAction(action_type=ActionType.ANALYZE), UnavailableBackend())
	assert result.executed is False
	assert "MediStock backend is unavailable" in result.validation_errors[0]

@pytest.mark.asyncio
async def test_backend_url_uses_environment_override(monkeypatch):
	monkeypatch.setenv("MEDISTOCK_API_BASE_URL", "http://example.test:5999")
	assert InventoryBackend().base_url == "http://example.test:5999"

@pytest.mark.asyncio
async def test_backend_connection_failure_is_translated():
	with pytest.raises(BackendUnavailableError, match="MediStock backend is unavailable"):
		await InventoryBackend("http://127.0.0.1:1").get_inventory()

@pytest.mark.asyncio
async def test_natural_language_summary_and_low_stock_questions():
	backend = FakeBackend()
	result = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Give me today's inventory summary"}), backend)
	assert "3 active medicines" in result.answer
	low = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Why is Test marked low stock?"}), backend)
	assert "minimum" in low.answer
	assert low.insights[0].details["shortfall"] == 0

@pytest.mark.asyncio
async def test_batch_and_transaction_questions_are_read_only():
	backend = FakeBackend()
	batch = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Show details for batch ABC-123"}), backend)
	assert "ABC-123" in batch.answer and not batch.approval_required
	transaction = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Why did Test stock decrease?"}), backend)
	assert "count correction" in transaction.answer and not transaction.executed
	assert not transaction.approval_required

def test_transaction_history_is_not_classified_as_a_mutation():
	assert InventoryAgent._mutation_intent("Show me the transaction history for Vitamin C.") is None

def test_exact_mutation_request_through_agent_api_route_requires_approval(monkeypatch):
	backend = FakeBackend(include_demo_balances=True)
	monkeypatch.setattr(routes, "InventoryBackend", lambda: backend)
	response = TestClient(app).post("/api/inventory-agent/run", json={
		"action_type": "ask",
		"payload": {"question": "Adjust Vitamin C stock by 10 units."},
		"approved": False,
	})
	assert response.status_code == 200
	body = response.json()
	assert body["approval_required"] is True
	assert body["executed"] is False
	assert backend.execute_calls == []

@pytest.mark.asyncio
async def test_transaction_history_resolves_medicine_name_across_facilities():
	backend = FakeBackend()
	result = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Show me the transaction history for Vitamin C."}), backend)
	assert backend.transaction_scopes == [("vitc", "f"), ("vitc", "north")]
	assert "RECEIVE 24" in result.answer and "ADJUSTMENT -2" in result.answer
	assert not result.approval_required and not result.executed

@pytest.mark.asyncio
async def test_transaction_history_resolves_medicine_code_and_facility_name():
	backend = FakeBackend()
	result = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Show me the transaction history for VITC-DEMO at Central Facility."}), backend)
	assert backend.transaction_scopes == [("vitc", "f")]
	assert "Central Facility" in result.answer and "supplier delivery" in result.answer
	assert not result.approval_required and not result.executed

@pytest.mark.asyncio
async def test_transaction_history_supports_other_medicine_and_facility():
	backend = FakeBackend()
	result = await InventoryAgent().run(InventoryAction(action_type=ActionType.ASK, payload={"question": "Show transaction history for AMOX-250 at Northside Clinic"}), backend)
	assert backend.transaction_scopes == [("amox", "north")]
	assert "scheduled replenishment" in result.answer and "Northside Clinic" in result.answer
	assert not result.approval_required and not result.executed

def test_exact_transaction_history_request_through_agent_api_route(monkeypatch):
	backend = FakeBackend()
	monkeypatch.setattr(routes, "InventoryBackend", lambda: backend)
	response = TestClient(app).post("/api/inventory-agent/run", json={
		"action_type": "ask",
		"payload": {"question": "Show me the transaction history for VITC-DEMO at Central Facility."},
		"approved": False,
	})
	assert response.status_code == 200
	body = response.json()
	assert "supplier delivery" in body["answer"]
	assert "Central Facility" in body["answer"]
	assert not body["approval_required"] and not body["executed"]
	assert backend.transaction_scopes == [("vitc", "f")]
