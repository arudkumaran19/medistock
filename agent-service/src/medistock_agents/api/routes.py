"""API routes for MediStock internal agent service."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Header, HTTPException, status
from medistock_agents.agents.redistribution_agent import RedistributionAgent
from medistock_agents.agents.inventory_agent import InventoryAgent
from medistock_agents.agents.procurement_validation_agent import ProcurementValidationAgent
from medistock_agents.api.schemas import (
    HealthResponse,
    RedistributionPlanRequest,
    RedistributionPlanResponse,
	InventoryAgentRequest,
	InventoryAgentResponse,
	ProcurementAgentRequest,
	ProcurementAgentResponse,
	CoordinatorTaskRequest,
	CoordinatorTaskResponse,
)
from medistock_agents.models.agent_models import InventoryAction, ProcurementAction
from medistock_agents.tools.inventory_tools import InventoryBackend
from medistock_agents.tools.procurement_tools import ProcurementBackend

logger = logging.getLogger("medistock_agents.api")

router = APIRouter()
inventory_router = APIRouter(prefix="/api/inventory-agent", tags=["inventory-agent"])
_redistribution_agent = RedistributionAgent()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Internal health check endpoint for ASP.NET Core gateway probes."""
    return HealthResponse(
        status="healthy",
        service="medistock-agent-service",
        version="1.0.0",
    )


@router.post(
    "/api/agents/redistribution/plan",
    response_model=RedistributionPlanResponse,
    response_model_by_alias=True,
    tags=["Redistribution Planning"],
)
async def plan_redistribution(
    request: RedistributionPlanRequest,
) -> RedistributionPlanResponse:
    """
    Executes the internal LangGraph Redistribution Agent workflow to find
    optimal candidate facilities and propose transfer quantity.
    
    This endpoint is STRICTLY INTERNAL and only consumed by ASP.NET Core AgentGateway.
    React and Flutter clients NEVER communicate directly with this endpoint.
    """
    try:
        logger.info(
            "Received redistribution planning request for workflow %s, destination %s, medicine %s, qty %d",
            request.workflow_run_id,
            request.destination_facility_id,
            request.medicine_id,
            request.shortage_quantity,
        )

        response = await _redistribution_agent.plan_redistribution(request)
        return response

    except Exception as ex:
        logger.error("Unhandled error during redistribution agent execution: %s", ex, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent execution failed: {str(ex)}",
        )
# ---------------------------------------------------------------------------
# Inventory agent router
# ---------------------------------------------------------------------------

@inventory_router.post("/run", response_model=InventoryAgentResponse)
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
