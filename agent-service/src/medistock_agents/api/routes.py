from fastapi import APIRouter, Header, HTTPException

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
from medistock_agents.safety.rbac import (
	PROCUREMENT_ALLOWED_ROLES,
	INVENTORY_ALLOWED_ROLES,
	AccessDenied,
	require_role,
)
from medistock_agents.tools.inventory_tools import (
	BackendAccessDeniedError,
	BackendDataNotFoundError,
	BackendUnavailableError,
	InventoryBackend,
)
from medistock_agents.tools.procurement_tools import ProcurementBackend
from medistock_agents.config import get_settings


def _extract_user_token(x_user_token: str | None, authorization: str | None) -> str | None:
	"""Prefer the token the .NET proxy forwarded, else the raw Authorization header.

	The .NET proxy sets X-User-Token to the user's JWT so the agent's back-calls into
	/api/inventory/* run under that user's own permissions.
	"""
	if x_user_token and x_user_token.strip():
		return x_user_token.strip()
	if authorization and authorization.lower().startswith("bearer "):
		return authorization[7:].strip()
	return None


def _raise_access_denied(error: AccessDenied) -> None:
	"""Turn a role refusal into the matching HTTP status with a safe message."""
	raise HTTPException(status_code=error.status, detail=error.message) from error


# ---------------------------------------------------------------------------
# Inventory agent router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/inventory-agent", tags=["inventory-agent"])


@router.post("/run", response_model=InventoryAgentResponse)
async def run_inventory_agent(
	request: InventoryAgentRequest,
	x_internal_token: str | None = Header(None),
	x_user_token: str | None = Header(None),
	authorization: str | None = Header(None),
) -> InventoryAgentResponse:
	# Validate the internal service token - only the .NET API is allowed to call this.
	# If the token is not configured (dev without .env), skip validation.
	cfg = get_settings()
	expected_token = cfg.internal_service_token
	if expected_token and x_internal_token != expected_token:
		raise HTTPException(status_code=403, detail="Forbidden: invalid internal token")

	# RBAC runs BEFORE the agent resolves entities, retrieves data, delegates to a
	# sub-agent or executes any tool.
	user_token = _extract_user_token(x_user_token, authorization)
	try:
		require_role(user_token, INVENTORY_ALLOWED_ROLES, "the Inventory Intelligence Agent")
	except AccessDenied as error:
		_raise_access_denied(error)

	backend = InventoryBackend()
	if user_token:
		backend.token = user_token

	try:
		result = await InventoryAgent().run(
			InventoryAction(action_type=request.action_type, payload=request.payload),
			backend,
			request.approved,
		)
	except BackendAccessDeniedError as error:
		# The backend itself refused: report access, execute nothing.
		raise HTTPException(status_code=403, detail=str(error)) from error
	except BackendDataNotFoundError as error:
		# Not enough data to answer - a distinct, honest outcome, not a failure.
		return InventoryAgentResponse(
			plan=["Interpret the inventory question", "Retrieve matching inventory data"],
			insights=[],
			validation_errors=[str(error)],
			approval_required=False,
			executed=False,
			backend_result=None,
			answer=str(error),
		)
	except BackendUnavailableError as error:
		# A genuine service failure is reported as one, never as a fabricated answer.
		raise HTTPException(status_code=503, detail=str(error)) from error

	if result.validation_errors:
		for err in result.validation_errors:
			if "could not be reached" in err.lower() or "unavailable" in err.lower():
				raise HTTPException(status_code=503, detail=err)

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
	# RBAC before any retrieval, delegation or tool execution.
	token = _extract_user_token(None, authorization)
	try:
		require_role(token, PROCUREMENT_ALLOWED_ROLES, "the Procurement Policy Agent")
	except AccessDenied as error:
		_raise_access_denied(error)

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
