from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from medistock_agents.config import get_settings
from medistock_agents.orchestration.coordinator import CoordinatorAgent
from medistock_agents.safety.rbac import (
    COORDINATOR_ALLOWED_ROLES,
    AccessDenied,
    require_role,
)

logger = logging.getLogger(__name__)

coordinator_router = APIRouter(prefix="/api/coordinator", tags=["coordinator"])


def _check_internal_token(x_internal_token: str | None) -> None:
    """Validate internal service token when configured."""
    cfg = get_settings()
    expected_token = cfg.internal_service_token
    if expected_token and x_internal_token != expected_token:
        raise HTTPException(status_code=403, detail="Forbidden: invalid internal token")


def _extract_user_token(x_user_token: str | None, authorization: str | None) -> str | None:
    if x_user_token and x_user_token.strip():
        return x_user_token.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def _authorise(user_token: str | None) -> None:
    """Enforce RBAC before the Coordinator retrieves data or delegates to any agent."""
    try:
        require_role(user_token, COORDINATOR_ALLOWED_ROLES, "the MediStock AI Coordinator")
    except AccessDenied as error:
        raise HTTPException(status_code=error.status, detail=error.message) from error


class CoordinatorRunRequest(BaseModel):
    objective: str
    facility_id: str | None = None
    medicine_id: str | None = None
    workflow_id: str | None = None
    workflow_type: str = "ShortageResolution"
    parameters: dict[str, Any] | None = None


class CoordinatorChatRequest(BaseModel):
    message: str
    facility_id: str | None = None
    context: dict[str, Any] | None = None


@coordinator_router.post("/run")
async def run_coordinator(
    request: CoordinatorRunRequest,
    x_internal_token: str | None = Header(None),
    x_user_token: str | None = Header(None),
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    _check_internal_token(x_internal_token)
    user_token = _extract_user_token(x_user_token, authorization)
    _authorise(user_token)

    agent = CoordinatorAgent()
    return await agent.run(
        objective=request.objective,
        facility_id=request.facility_id,
        medicine_id=request.medicine_id,
        workflow_type=request.workflow_type,
        parameters=request.parameters,
    )


@coordinator_router.post("/chat")
async def chat_coordinator(
    request: CoordinatorChatRequest,
    x_internal_token: str | None = Header(None),
    x_user_token: str | None = Header(None),
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    _check_internal_token(x_internal_token)
    user_token = _extract_user_token(x_user_token, authorization)
    _authorise(user_token)

    agent = CoordinatorAgent()
    result = await agent.run(
        objective=request.message,
        facility_id=request.facility_id,
        parameters=request.context,
    )
    return {
        "reply": result.get("final_recommendation", ""),
        "plan": result.get("plan", []),
        "requires_approval": result.get("requires_approval", False),
        "approval_type": result.get("approval_type"),
        "approval_reason": result.get("approval_reason"),
        "available_strategies": result.get("available_strategies"),
        "redistribution_proposal": result.get("redistribution_proposal"),
        "procurement_proposal": result.get("procurement_proposal"),
        "policy_validation": result.get("policy_validation"),
        "status": result.get("status", "SUCCESS"),
    }


@coordinator_router.get("/health")
def coordinator_health() -> dict[str, str]:
    return {"status": "ok", "service": "CoordinatorAgent"}

