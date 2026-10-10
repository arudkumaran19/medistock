"""Frozen API Request and Response schemas for AgentGateway contract."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator
from medistock_agents.models.agent_models import (
    ActionType,
    ProcurementActionType,
    CoordinatorTaskRequest,
    CoordinatorTaskResponse,
)
from medistock_agents.models.tool_models import ToolExecutionRecord


class RedistributionPlanRequest(BaseModel):
    """Payload sent by ASP.NET Core AgentGateway to trigger planning."""
    model_config = ConfigDict(populate_by_name=True)

    workflow_run_id: UUID = Field(..., alias="workflowRunId")
    destination_facility_id: UUID = Field(..., alias="destinationFacilityId")
    medicine_id: UUID = Field(..., alias="medicineId")
    shortage_quantity: int = Field(..., gt=0, alias="shortageQuantity")
    additional_context: Optional[str] = Field(None, alias="additionalContext")

    @field_validator("shortage_quantity")
    @classmethod
    def validate_positive_shortage(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("shortage_quantity must be greater than 0")
        return v


class RedistributionPlanResponse(BaseModel):
    """Response returned to ASP.NET Core AgentGateway."""
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    success: bool = True
    selected_facility_id: Optional[UUID] = Field(None, alias="selectedFacilityId")
    selected_facility_name: Optional[str] = Field(None, alias="selectedFacilityName")
    proposed_quantity: int = Field(0, alias="proposedQuantity")
    distance_km: float = Field(0.0, alias="distanceKm")
    duration_minutes: float = Field(0.0, alias="durationMinutes")
    provider: str = Field("LangGraphRedistributionAgent", alias="provider")
    reasoning: str = ""
    prompt_tokens: int = Field(320, alias="promptTokens")
    completion_tokens: int = Field(120, alias="completionTokens")
    execution_time_ms: int = Field(0, alias="executionTimeMs")
    tool_calls: List[ToolExecutionRecord] = Field(default_factory=list, alias="toolCalls")
    error_message: Optional[str] = Field(None, alias="errorMessage")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    service: str = "medistock-agent-service"
    version: str = "1.0.0"


# ---------------------------------------------------------------------------
# Inventory agent API schemas
# ---------------------------------------------------------------------------

class InventoryAgentRequest(BaseModel):
	action_type: ActionType
	payload: dict = Field(default_factory=dict)
	approved: bool = False


class InventoryAgentResponse(BaseModel):
	plan: list[str]
	insights: list[dict]
	validation_errors: list[str]
	approval_required: bool
	executed: bool
	backend_result: dict | None
	answer: str | None = None


# ---------------------------------------------------------------------------
# Procurement & Policy Validation agent API schemas
# ---------------------------------------------------------------------------

class ProcurementAgentRequest(BaseModel):
	action_type: ProcurementActionType
	payload: dict = Field(default_factory=dict)
	approved: bool = False


class ProcurementAgentResponse(BaseModel):
	plan: list[str]
	insights: list[dict]
	validation_errors: list[str]
	approval_required: bool
	executed: bool
	backend_result: dict | None
	answer: str | None = None


__all__ = [
    "HealthResponse",
    "RedistributionPlanRequest",
    "RedistributionPlanResponse",
	"InventoryAgentRequest",
	"InventoryAgentResponse",
	"ProcurementAgentRequest",
	"ProcurementAgentResponse",
	"CoordinatorTaskRequest",
	"CoordinatorTaskResponse",
]
