from pydantic import BaseModel, Field
from medistock_agents.models.agent_models import (
	ActionType,
	ProcurementActionType,
	CoordinatorTaskRequest,
	CoordinatorTaskResponse,
)


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
	"InventoryAgentRequest",
	"InventoryAgentResponse",
	"ProcurementAgentRequest",
	"ProcurementAgentResponse",
	"CoordinatorTaskRequest",
	"CoordinatorTaskResponse",
]
