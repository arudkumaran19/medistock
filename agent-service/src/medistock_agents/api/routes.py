from fastapi import APIRouter, Header

from medistock_agents.agents.inventory_agent import InventoryAgent
from medistock_agents.agents.procurement_validation_agent import ProcurementValidationAgent
from medistock_agents.models.agent_models import InventoryAction, ProcurementAction
from medistock_agents.api.schemas import (
	InventoryAgentRequest,
	InventoryAgentResponse,
	ProcurementAgentRequest,
	ProcurementAgentResponse,
	CoordinatorTaskRequest,
	CoordinatorTaskResponse,
)
from medistock_agents.tools.inventory_tools import InventoryBackend
from medistock_agents.tools.procurement_tools import ProcurementBackend

# ---------------------------------------------------------------------------
# Inventory agent router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/inventory-agent", tags=["inventory-agent"])


@router.post("/run", response_model=InventoryAgentResponse)
async def run_inventory_agent(
	request: InventoryAgentRequest,
	authorization: str | None = Header(None),
) -> InventoryAgentResponse:
	token = None
	if authorization and authorization.lower().startswith("bearer "):
		token = authorization[7:].strip()
	backend = InventoryBackend()
	if token and hasattr(backend, "token"):
		backend.token = token
	result = await InventoryAgent().run(
		InventoryAction(action_type=request.action_type, payload=request.payload),
		backend,
		request.approved,
	)
	return InventoryAgentResponse(**result.model_dump())


# ---------------------------------------------------------------------------
# Procurement & Policy Validation agent router
# ---------------------------------------------------------------------------

procurement_router = APIRouter(
	prefix="/api/procurement-agent",
	tags=["procurement-agent"],
)


@procurement_router.post("/run", response_model=ProcurementAgentResponse)
async def run_procurement_agent(
	request: ProcurementAgentRequest,
	authorization: str | None = Header(None),
) -> ProcurementAgentResponse:
	token = None
	if authorization and authorization.lower().startswith("bearer "):
		token = authorization[7:].strip()
	backend = ProcurementBackend()
	if token and hasattr(backend, "token"):
		backend.token = token
	result = await ProcurementValidationAgent().run(
		ProcurementAction(action_type=request.action_type, payload=request.payload),
		backend,
		request.approved,
	)
	return ProcurementAgentResponse(**result.model_dump())


@procurement_router.post("/coordinator-task", response_model=CoordinatorTaskResponse)
async def handle_coordinator_task(
	request: CoordinatorTaskRequest,
	approved: bool = False,
	authorization: str | None = Header(None),
) -> CoordinatorTaskResponse:
	"""Endpoint for the shared Coordinator Agent to delegate tasks to Procurement."""
	token = None
	if authorization and authorization.lower().startswith("bearer "):
		token = authorization[7:].strip()
	agent = ProcurementValidationAgent()
	backend = ProcurementBackend()
	if token and hasattr(backend, "token"):
		backend.token = token
	return await agent.handle_coordinator_task(request, backend, approved=approved)
