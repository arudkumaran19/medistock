# Demand & Shortage agent contract - Sathurstiga S. (IT24103156).
#
# This was originally written into models/agent_models.py while that file was an
# empty placeholder. On develop, agent_models.py is ILHAM MM's real shared contract
# and defines a different AgentResult for the inventory and procurement agents, so
# this vertical's structured-output contract lives here rather than overwriting it.

"""Frozen specialist-agent input and output contract.

SHARED CONTRACT - primary owner: ILHAM MM (IT24103530).

Placeholder created by the Demand & Shortage vertical (Sathurstiga S., IT24103156)
only so this slice can implement against the frozen schema and ship contract tests.
Replace with the owner's implementation on integration; do not widen it from a
specialist agent.

The output shape is fixed by blueprint section 73::

    {
      "agent": "demand_shortage",
      "status": "SUCCESS",
      "confidence": 0.84,
      "findings": [],
      "recommendations": [],
      "requiredValidation": true,
      "requestedAction": null,
      "evidence": []
    }
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Specialist agent names registered with the coordinator.
AgentName = Literal[
    "inventory_intelligence",
    "demand_shortage",
    "redistribution_planning",
    "procurement_policy_validation",
]

# SUCCESS is the only status named by blueprint section 73. SAFE_FAILURE carries the
# safe-failure requirement of section 41 through to the agent result.
#
# Not specified in the final blueprint: the complete agent status enumeration.
# Do not assume or introduce a new decision without team-level confirmation.
AgentStatus = Literal["SUCCESS", "SAFE_FAILURE"]


class CamelModel(BaseModel):
    """Base model serialising to the frozen camelCase JSON convention."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class Finding(CamelModel):
    """A single observation an agent made."""

    code: str
    summary: str
    value: float | None = None
    unit: str | None = None


class Recommendation(CamelModel):
    """A suggested operational response. Never self-executing."""

    code: str
    summary: str
    priority: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"


class Evidence(CamelModel):
    """Traceable support for a finding: which tool produced which value."""

    source: str
    detail: str
    value: Any | None = None


class AgentResult(CamelModel):
    """The structured output every specialist agent returns.

    Validated against this schema before the coordinator accepts it.
    """

    agent: AgentName
    status: AgentStatus
    confidence: float = Field(ge=0.0, le=1.0)
    findings: list[Finding] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    required_validation: bool = True
    requested_action: dict[str, Any] | None = None
    evidence: list[Evidence] = Field(default_factory=list)

    def to_contract_dict(self) -> dict[str, Any]:
        """Serialise to the frozen camelCase wire shape."""
        return self.model_dump(by_alias=True, mode="json")
