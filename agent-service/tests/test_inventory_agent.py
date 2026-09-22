import pytest
from medistock_agents.agents.inventory_agent import InventoryAgent
from medistock_agents.models.agent_models import ActionType, InventoryAction
from medistock_agents.tools.inventory_tools import BackendUnavailableError, InventoryBackend
class FakeBackend:
	async def get_inventory(self): return [{"medicineName": "Test", "medicineId": "m", "facilityId": "f", "isBelowMinimum": True}]
	async def get_expiring(self): return [{"medicineName": "Test", "medicineId": "m", "facilityId": "f", "batchNumber": "b", "expiryDateUtc": "2026-01-01"}]
	async def execute(self, action, payload): return {"action": action, "payload": payload}
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
