from pydantic import BaseModel, Field
from medistock_agents.models.agent_models import ActionType
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
