from pydantic import BaseModel, Field
from pydantic.alias_generators import to_camel

from medistock_agents.models.agent_models import (
    ActionType,
    ProcurementActionType,
    CoordinatorTaskRequest,
    CoordinatorTaskResponse,
)


# ---------------------------------------------------------------------------
# Base schema
# ---------------------------------------------------------------------------

class CamelCaseModel(BaseModel):
    """Accepts both camelCase and snake_case field names.

    The ASP.NET proxy forwards the browser's request body verbatim, so the agent
    must bind the camelCase names the React client sends (``actionType``) as well
    as the snake_case names used by the Python tests and internal callers. Keeping
    ``populate_by_name`` means neither convention wins; both are accepted.
    """

    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }


# ---------------------------------------------------------------------------
# Inventory agent API schemas
# ---------------------------------------------------------------------------

class InventoryAgentRequest(CamelCaseModel):
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

class ProcurementAgentRequest(CamelCaseModel):
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

