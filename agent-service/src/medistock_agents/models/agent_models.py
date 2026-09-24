from enum import Enum
from pydantic import BaseModel, Field

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

class AgentResult(BaseModel):
	plan: list[str]
	insights: list[InventoryInsight]
	validation_errors: list[str] = Field(default_factory=list)
	approval_required: bool = False
	executed: bool = False
	backend_result: dict | None = None
	answer: str | None = None
