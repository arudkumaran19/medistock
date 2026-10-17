from __future__ import annotations

from typing import Any, TypedDict


class CoordinatorState(TypedDict, total=False):
    """Execution state machine contract for the Multi-Agent Coordinator."""

    objective: str
    facility_id: str | None
    medicine_id: str | None
    workflow_id: str | None
    workflow_type: str
    parameters: dict[str, Any]

    intent: str
    plan: list[str]
    current_step: int
    response_detail: str  # concise | standard | detailed
    execution_events: list[dict[str, Any]]

    # Specialist agent results
    inventory_data: dict[str, Any] | None
    shortage_analysis: dict[str, Any] | None
    redistribution_proposal: dict[str, Any] | None
    procurement_proposal: dict[str, Any] | None
    policy_validation: dict[str, Any] | None

    # Governance & Approval
    requires_approval: bool
    approval_type: str | None
    approval_reason: str | None
    available_strategies: list[str] | None
    final_recommendation: str
    status: str  # SUCCESS, PARTIAL, FAILED
    errors: list[str]
