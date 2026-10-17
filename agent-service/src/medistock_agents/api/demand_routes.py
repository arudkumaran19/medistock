"""Demand & Shortage agent HTTP surface.
Sathurstiga S. (IT24103156).

Follows the same shape as the inventory and procurement routers on develop: one
router per specialist, mounted by main.py. Kept in its own module so ILHAM MM's
api/routes.py and api/schemas.py are untouched.

Security (blueprint sections 23 and 37)
---------------------------------------
React and Flutter must never reach this service. Every request must carry the shared
``X-Internal-Token`` header, which only the ASP.NET Core backend holds. A request
without it is refused with 401 before any agent runs.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from medistock_agents.agents.demand_graph import DemandPlanner
from medistock_agents.agents.demand_reasoning import DemandNarrator
from medistock_agents.agents.demand_shortage_agent import (
    DemandShortageAgent,
    DemandShortageRequest,
)
from medistock_agents.llm.provider import get_llm_provider
from medistock_agents.models.demand_models import AgentResult
from medistock_agents.orchestration.routing_policy import (
    classify_intent,
    requires_demand_agent,
    select_agents,
)
from medistock_agents.safety.input_guard import InputGuard
from medistock_agents.tools.demand_tools import DemandToolClient

logger = logging.getLogger(__name__)

SERVICE_TOKEN_HEADER = "X-Internal-Token"

# The backend this service calls back into for its controlled tools.
API_BASE_URL = os.getenv("MEDISTOCK_API_BASE_URL", "http://localhost:5000")

# Shared secret with the ASP.NET backend. Never committed; supplied by environment.
AGENT_SERVICE_TOKEN = os.getenv("AGENT_SERVICE_TOKEN", "")

# Stateless, so one instance is shared across requests.
_INPUT_GUARD = InputGuard()

# Model-assisted interpretation. Set DEMAND_AGENT_REASONING=false to pin the vertical
# to its deterministic path - useful for a reproducible demo or a CI run that must not
# reach an external API. The agent degrades to exactly this path on its own whenever
# the model is unavailable, so disabling it changes nothing about correctness.
REASONING_ENABLED = os.getenv("DEMAND_AGENT_REASONING", "true").strip().lower() not in {
    "false",
    "0",
    "no",
}

demand_router = APIRouter(prefix="/api/demand-agent", tags=["demand-agent"])


class CamelModel(BaseModel):
    """Same camelCase convention as the agent contracts (blueprint section 71)."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class DemandAgentRequest(CamelModel):
    """A domain objective delegated to this agent by ASP.NET Core."""

    objective: str | None = None
    facility_id: str
    medicine_id: str
    current_stock: float | None = None
    window_days: int = 30


class DemandAgentResponse(CamelModel):
    """Envelope returned to ASP.NET Core.

    ``plan`` and ``intent`` come from this vertical's routing-policy contribution to
    the shared coordinator (blueprint section 31). They describe which specialists an
    objective needs - they are not a persisted workflow, which remains the
    responsibility of Features/Workflow.
    """

    intent: str
    plan: list[str]
    handled_by: str | None
    result: AgentResult | None
    duration_ms: int


def _authorise(token: str | None) -> None:
    """Refuse anything that does not carry the shared internal token."""
    if not AGENT_SERVICE_TOKEN:
        # Fail closed. An unconfigured service must not accept traffic.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent service token is not configured.",
        )

    if token != AGENT_SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal service token missing or invalid.",
        )


def _reasoning() -> tuple[DemandNarrator | None, DemandPlanner | None]:
    """The planner and narrator, or (None, None) to run deterministically.

    ``get_llm_provider`` is owned by Arudkumaran V. (IT24103011) and is imported
    unmodified. A provider that turns out to be unreachable is not an error here: the
    agent degrades on its own when a call fails.
    """
    if not REASONING_ENABLED:
        return None, None

    try:
        provider = get_llm_provider()
    except Exception as exc:
        logger.warning("LLM provider could not be constructed, running deterministically: %s", exc)
        return None, None

    return DemandNarrator(provider), DemandPlanner(provider)


def _agent() -> DemandShortageAgent:
    narrator, planner = _reasoning()

    return DemandShortageAgent(
        tools=DemandToolClient(base_url=API_BASE_URL, service_token=AGENT_SERVICE_TOKEN),
        narrator=narrator,
        planner=planner,
    )


async def _run_agent(request: DemandAgentRequest) -> AgentResult:
    return await _agent().analyze_with_reasoning(
        DemandShortageRequest(
            facility_id=request.facility_id,
            medicine_id=request.medicine_id,
            current_stock=request.current_stock,
            window_days=request.window_days,
            objective=request.objective,
        )
    )


@demand_router.get("/health")
def health() -> dict[str, object]:
    """Liveness probe for the demand specialist."""
    return {
        "status": "healthy",
        "agents": ["demand_shortage"],
        "apiBaseUrl": API_BASE_URL,
        "tokenConfigured": bool(AGENT_SERVICE_TOKEN),
    }


@demand_router.post("/run", response_model=DemandAgentResponse)
async def run(
    request: DemandAgentRequest,
    x_internal_token: Annotated[str | None, Header(alias=SERVICE_TOKEN_HEADER)] = None,
) -> DemandAgentResponse:
    """Classify an objective and run the demand specialist when it is required.

    Returns a SAFE_FAILURE-shaped result rather than raising, so the caller always
    receives a structured, auditable outcome (blueprint section 41).
    """
    _authorise(x_internal_token)

    started = time.perf_counter()

    intent = classify_intent(request.objective)
    plan = list(select_agents(request.objective))

    # Screening precedes routing. An injected instruction rarely classifies to a real
    # intent, so routing first would silently drop it as "no specialist required"
    # instead of refusing it on the record. Security decisions must be explicit.
    screened = _INPUT_GUARD.inspect(request.objective)

    if not screened.is_safe:
        logger.warning(
            "Objective refused before routing for facility %s: %s",
            request.facility_id,
            screened.refusal_reason,
        )
        return DemandAgentResponse(
            intent=intent.value,
            plan=[],
            handled_by="demand_shortage",
            # The agent's own guard produces the SAFE_FAILURE result, so the refusal
            # shape stays identical whether it is caught here or inside analyze().
            result=await _run_agent(request),
            duration_ms=int((time.perf_counter() - started) * 1000),
        )

    # This router carries only the demand specialist. When an objective does not need
    # it, say so plainly instead of inventing an answer.
    if request.objective is not None and not requires_demand_agent(request.objective):
        logger.info("Objective routed away from demand_shortage: intent=%s", intent.value)
        return DemandAgentResponse(
            intent=intent.value,
            plan=plan,
            handled_by=None,
            result=None,
            duration_ms=int((time.perf_counter() - started) * 1000),
        )

    return DemandAgentResponse(
        intent=intent.value,
        plan=plan,
        handled_by="demand_shortage",
        result=await _run_agent(request),
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
