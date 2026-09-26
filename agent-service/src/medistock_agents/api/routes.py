"""API routes for MediStock internal agent service."""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status
from medistock_agents.agents.redistribution_agent import RedistributionAgent
from medistock_agents.api.schemas import (
    HealthResponse,
    RedistributionPlanRequest,
    RedistributionPlanResponse,
)

logger = logging.getLogger("medistock_agents.api")

router = APIRouter()
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
