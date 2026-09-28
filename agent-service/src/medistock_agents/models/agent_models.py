from enum import Enum
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Inventory domain models
# ---------------------------------------------------------------------------

class ActionType(str, Enum):
	ANALYZE = "analyze"
	ASK = "ask"
	RECEIVE = "receive"
	ADJUST = "adjust"
	RESERVE = "reserve"


class InventoryAction(BaseModel):
	action_type: ActionType
	payload: dict = Field(default_factory=dict)
	requires_approval: bool = False


class InventoryInsight(BaseModel):
	kind: str
	message: str
	medicine_id: str | None = None
	facility_id: str | None = None
	severity: str = "info"
	details: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Procurement domain models
# ---------------------------------------------------------------------------

class ProcurementActionType(str, Enum):
	ASK = "ask"
	ANALYZE = "analyze"
	VALIDATE = "validate"
	APPROVE = "approve"
	REJECT = "reject"
	REVISE = "revise"


class ProcurementAction(BaseModel):
	action_type: ProcurementActionType
	payload: dict = Field(default_factory=dict)
	requires_approval: bool = False


class ProcurementInsight(BaseModel):
	kind: str
	message: str
	purchase_order_id: str | None = None
	supplier_id: str | None = None
	severity: str = "info"
	details: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Shared result model (supports all agents)
# ---------------------------------------------------------------------------

class AgentResult(BaseModel):
	plan: list[str]
	insights: list[InventoryInsight | ProcurementInsight] = Field(default_factory=list)
	validation_errors: list[str] = Field(default_factory=list)
	approval_required: bool = False
	executed: bool = False
	backend_result: dict | None = None
	answer: str | None = None


# ---------------------------------------------------------------------------
# Coordinator Agent Integration Contract
# ---------------------------------------------------------------------------

class CoordinatorTaskRequest(BaseModel):
	"""Structured delegated request received from the shared Coordinator Agent."""
	task_id: str
	source_agent: str = "coordinator"
	intent: str
	facility_id: str | None = None
	medicine_id: str | None = None
	quantity: int | None = None
	payload: dict = Field(default_factory=dict)
	context: dict = Field(default_factory=dict)


class CoordinatorTaskResponse(BaseModel):
	"""Structured machine-readable result returned to the Coordinator Agent."""
	task_id: str
	intent: str
	plan: list[str] = Field(default_factory=list)
	actions: list[dict] = Field(default_factory=list)
	tool_results: list[dict] = Field(default_factory=list)
	validation_results: dict = Field(default_factory=dict)
	recommendation: str = ""
	approval_required: bool = False
	approval_context: dict = Field(default_factory=dict)
	execution_status: str = "success"  # "success" | "pending_approval" | "failed"
	errors: list[str] = Field(default_factory=list)
	metadata: dict = Field(default_factory=dict)
