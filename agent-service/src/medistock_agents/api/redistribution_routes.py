"""Redistribution agent HTTP surface. Redistribution vertical (Member 3).

Own module, so the shared api/routes.py is untouched. Only ASP.NET Core may call it: a
request without the shared X-Internal-Token is refused before any agent runs.
"""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from medistock_agents.agents.redistribution_agent import RedistributionPlanningAgent
from medistock_agents.llm.provider import get_llm_provider
from medistock_agents.tools.redistribution_tools import RedistributionToolClient

API_BASE_URL = os.getenv("MEDISTOCK_API_BASE_URL", "http://localhost:5182")
AGENT_SERVICE_TOKEN = os.getenv("AGENT_SERVICE_TOKEN", "")
REASONING_ENABLED = os.getenv("DEMAND_AGENT_REASONING", "true").strip().lower() not in {"false", "0", "no"}

redistribution_router = APIRouter(prefix="/api/redistribution-agent", tags=["redistribution-agent"])


class RunRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    transfer_id: str
    objective: str | None = None


def _authorise(token: str | None) -> None:
    if not AGENT_SERVICE_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent service token is not configured.")
    if token != AGENT_SERVICE_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal service token missing or invalid.")


@redistribution_router.get("/health")
def health() -> dict[str, object]:
    return {"status": "healthy", "agents": ["redistribution_planning"], "tokenConfigured": bool(AGENT_SERVICE_TOKEN)}


@redistribution_router.post("/run")
async def run(
    request: RunRequest,
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
) -> dict[str, object]:
    _authorise(x_internal_token)

    llm = None
    if REASONING_ENABLED:
        try:
            llm = get_llm_provider()
        except Exception:  # an unconstructable provider is a missing narrative, not an error
            llm = None

    agent = RedistributionPlanningAgent(
        RedistributionToolClient(base_url=API_BASE_URL, service_token=AGENT_SERVICE_TOKEN),
        llm=llm,
    )
    return await agent.run(request.transfer_id, request.objective)
