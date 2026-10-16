"""Output guard: validates an agent result before the coordinator accepts it.

Prompt-injection mitigation is assigned to Sathurstiga S. (IT24103156) in the
blueprint risk register.

Specialist-agent output must be schema-validated before acceptance (blueprint section
73). The guard additionally refuses any result in which a specialist agent claims an
authoritative action for itself: authority stays with the deterministic backend and
the human approver.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from medistock_agents.models.demand_models import AgentResult


class OutputRejectedError(ValueError):
    """Raised when an agent result fails validation and must not be accepted."""


# Actions a specialist agent may never request for itself. The coordinator routes
# these to deterministic validation and human approval instead.
_FORBIDDEN_ACTIONS: frozenset[str] = frozenset(
    {
        "approveTransfer",
        "executeTransfer",
        "modifyInventory",
        "adjustStock",
        "createPurchaseOrder",
        "deleteFacility",
    }
)


class OutputGuard:
    """Schema-validates agent output and blocks self-authorised actions."""

    def validate(self, payload: dict[str, Any] | AgentResult) -> AgentResult:
        """Return the validated result, or raise :class:`OutputRejectedError`."""
        if isinstance(payload, AgentResult):
            result = payload
        else:
            try:
                result = AgentResult.model_validate(payload)
            except ValidationError as exc:
                raise OutputRejectedError(
                    f"Agent output failed schema validation: {exc}"
                ) from exc

        requested = result.requested_action or {}
        action = requested.get("action") if isinstance(requested, dict) else None

        if action in _FORBIDDEN_ACTIONS:
            raise OutputRejectedError(
                f"Agent requested the forbidden action '{action}'. "
                "Authoritative actions belong to deterministic backend validation "
                "and human approval."
            )

        # A specialist agent never declares its own work exempt from validation.
        if not result.required_validation:
            raise OutputRejectedError(
                "A specialist agent may not set requiredValidation to false."
            )

        return result
