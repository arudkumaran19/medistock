"""Agent service HTTP entry point.

OWNERSHIP NOTE
--------------
The blueprint does not assign an owner for this file. Section 37 defines the
internal agent API surface, and section 30 assigns ``api/schemas.py`` and the agent
contracts to ILHAM MM (IT24103530) and the coordinator/orchestration to
Vaisnavi L. (IT24102469), but no member is named for ``main.py`` itself.

    Not specified in the final blueprint. Do not assume or introduce a new decision
    without team-level confirmation.

This is therefore a MINIMAL, TEMPORARY host added by Sathurstiga S. (IT24103156) so
that the Demand & Shortage Agent is reachable from ASP.NET Core instead of being a
library nobody can invoke. It deliberately does the smallest possible thing:

* it hosts ONLY the demand specialist - it is not the coordinator,
* it creates no workflow state, plan or approval - those belong to
  ``Features/Workflow`` (ILHAM MM),
* it delegates the routing decision to ``orchestration/routing_policy``.

Replace or absorb this into the coordinator host once the orchestration owner
implements ``orchestration/graph.py``.

Security (blueprint sections 23 and 37)
---------------------------------------
React and Flutter must never reach this service. Every request must carry the shared
``X-Internal-Token`` header, which only the ASP.NET Core backend holds. A request
without it is refused with 401 before any agent runs.

Run locally::

    uvicorn medistock_agents.main:app --port 8000
"""

from __future__ import annotations

import logging
import os
import time
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from medistock_agents.agents.demand_shortage_agent import (
    DemandShortageAgent,
    DemandShortageRequest,
)
from medistock_agents.models.agent_models import AgentResult
from medistock_agents.safety.input_guard import InputGuard
from medistock_agents.orchestration.routing_policy import (
    classify_intent,
    requires_demand_agent,
    select_agents,
)
from medistock_agents.tools.demand_tools import DemandToolClient

logger = logging.getLogger(__name__)

SERVICE_TOKEN_HEADER = "X-Internal-Token"

# The backend this service calls back into for its controlled tools.
API_BASE_URL = os.getenv("MEDISTOCK_API_BASE_URL", "http://localhost:5000")

# Shared secret with the ASP.NET backend. Never committed; supplied by environment.
AGENT_SERVICE_TOKEN = os.getenv("AGENT_SERVICE_TOKEN", "")

# Stateless, so one instance is shared across requests.
_INPUT_GUARD = InputGuard()


class CamelModel(BaseModel):
    """Same camelCase convention as the agent contracts (blueprint section 71)."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class AgentRunRequest(CamelModel):
    """A domain objective delegated to the agent service by ASP.NET Core."""

    objective: str | None = None
    facility_id: str
    medicine_id: str
    current_stock: float | None = None
    window_days: int = 30


class AgentRunResponse(CamelModel):
    """Envelope returned to ASP.NET Core.

    ``plan`` and ``intent`` come from this vertical's routing-policy contribution to
    the shared coordinator (blueprint section 31). They describe which specialists an
    objective needs - they are not a persisted workflow, which remains the
    responsibility of ``Features/Workflow``.
    """

    intent: str
    plan: list[str]
    handled_by: str | None
    result: AgentResult | None
    duration_ms: int


app = FastAPI(
    title="MediStock Agent Service",
    description=(
        "Internal agent service. Called only by the ASP.NET Core backend, never by "
        "React or Flutter (blueprint section 37)."
    ),
    version="0.1.0",
)


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


def _agent() -> DemandShortageAgent:
    return DemandShortageAgent(
        tools=DemandToolClient(base_url=API_BASE_URL, service_token=AGENT_SERVICE_TOKEN)
    )


@app.get("/internal/agent/health")
def health() -> dict[str, object]:
    """Liveness probe (blueprint section 37)."""
    return {
        "status": "healthy",
        "agents": ["demand_shortage"],
        "apiBaseUrl": API_BASE_URL,
        "tokenConfigured": bool(AGENT_SERVICE_TOKEN),
    }


@app.post("/internal/agent/run", response_model=AgentRunResponse)
def run(
    request: AgentRunRequest,
    x_internal_token: Annotated[str | None, Header(alias=SERVICE_TOKEN_HEADER)] = None,
) -> AgentRunResponse:
    """Classify an objective and run the demand specialist when it is required.

    Returns a SAFE_FAILURE-shaped response rather than raising, so the caller always
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
        return AgentRunResponse(
            intent=intent.value,
            plan=[],
            handled_by="demand_shortage",
            # The agent's own guard produces the SAFE_FAILURE result, so the refusal
            # shape stays identical whether it is caught here or inside analyze().
            result=_agent().analyze(
                DemandShortageRequest(
                    facility_id=request.facility_id,
                    medicine_id=request.medicine_id,
                    current_stock=request.current_stock,
                    window_days=request.window_days,
                    objective=request.objective,
                )
            ),
            duration_ms=int((time.perf_counter() - started) * 1000),
        )

    # This host carries only the demand specialist. When an objective does not need
    # it, say so plainly instead of inventing an answer.
    if request.objective is not None and not requires_demand_agent(request.objective):
        logger.info("Objective routed away from demand_shortage: intent=%s", intent.value)
        return AgentRunResponse(
            intent=intent.value,
            plan=plan,
            handled_by=None,
            result=None,
            duration_ms=int((time.perf_counter() - started) * 1000),
        )

    result = _agent().analyze(
        DemandShortageRequest(
            facility_id=request.facility_id,
            medicine_id=request.medicine_id,
            current_stock=request.current_stock,
            window_days=request.window_days,
            objective=request.objective,
        )
    )

    return AgentRunResponse(
        intent=intent.value,
        plan=plan,
        handled_by="demand_shortage",
        result=result,
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
