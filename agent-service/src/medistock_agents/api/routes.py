from fastapi import APIRouter
from medistock_agents.agents.inventory_agent import InventoryAgent
from medistock_agents.models.agent_models import InventoryAction
from medistock_agents.api.schemas import InventoryAgentRequest, InventoryAgentResponse
from medistock_agents.tools.inventory_tools import InventoryBackend
router = APIRouter(prefix="/api/inventory-agent", tags=["inventory-agent"])
@router.post("/run", response_model=InventoryAgentResponse)
async def run_agent(request: InventoryAgentRequest) -> InventoryAgentResponse:
	result = await InventoryAgent().run(InventoryAction(action_type=request.action_type, payload=request.payload), InventoryBackend(), request.approved)
	return InventoryAgentResponse(**result.model_dump())
