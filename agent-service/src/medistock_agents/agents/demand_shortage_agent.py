"""Demand & Shortage Agent.

Primary owner: Sathurstiga S. (IT24103156).

Responsibilities defined by blueprint section 17:

* Historical consumption
* Demand forecasting
* Days of stock
* Stockout estimation
* Shortage risk

Worked example the agent must reproduce::

    Stock = 120
    Average consumption = 20/day
    Days remaining = 6

    Lead time = 10 days
    6 < 10
    SHORTAGE RISK

What this agent does and does not do
------------------------------------
It selects which demand capabilities an objective needs, calls the controlled tools in
order, and explains what the resulting numbers mean operationally. Every number it
reports comes from a backend tool. It performs no arithmetic of its own, approves
nothing, and modifies nothing - authority stays with deterministic backend validation
and the human approver (blueprint sections 19, 20 and 23).

Graph wiring
------------
:func:`demand_shortage_node` is the LangGraph node entry point. The graph itself lives
in ``orchestration/`` and is owned by Vaisnavi L. (IT24102469); this module deliberately
does not import LangGraph so the specialist stays independently testable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from medistock_agents.models.agent_models import (
    AgentResult,
    Evidence,
    Finding,
    Recommendation,
)
from medistock_agents.models.tool_models import ToolResult
from medistock_agents.safety.input_guard import InputGuard
from medistock_agents.safety.output_guard import OutputGuard
from medistock_agents.tools.demand_tools import (
    DemandToolClient,
    parse_daily_consumption,
    parse_projected_stockout,
    parse_shortage_threshold,
)

logger = logging.getLogger(__name__)

AGENT_NAME = "demand_shortage"

DEFAULT_WINDOW_DAYS = 30


@dataclass
class DemandShortageRequest:
    """Input the coordinator delegates to this agent."""

    facility_id: str
    medicine_id: str
    current_stock: float | None = None
    window_days: int = DEFAULT_WINDOW_DAYS
    objective: str | None = None


class DemandShortageAgent:
    """Specialist agent for demand forecasting and shortage risk."""

    def __init__(
        self,
        tools: DemandToolClient,
        input_guard: InputGuard | None = None,
        output_guard: OutputGuard | None = None,
    ) -> None:
        self._tools = tools
        self._input_guard = input_guard or InputGuard()
        self._output_guard = output_guard or OutputGuard()

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def analyze(self, request: DemandShortageRequest) -> AgentResult:
        """Assess shortage risk and return a schema-validated result.

        Never raises for an operational failure. A refused objective or an
        unreachable tool becomes a SAFE_FAILURE result, so the coordinator can stop
        cleanly instead of acting on a guess.
        """
        if request.objective is not None:
            screened = self._input_guard.inspect(request.objective)

            if not screened.is_safe:
                logger.warning(
                    "Objective refused for facility %s: %s",
                    request.facility_id,
                    screened.refusal_reason,
                )
                return self._safe_failure(
                    "OBJECTIVE_REFUSED",
                    screened.refusal_reason,
                )

        window_days = request.window_days or DEFAULT_WINDOW_DAYS

        # 1. Average daily consumption, from recorded history.
        consumption_result = self._tools.calculate_daily_consumption(
            request.facility_id,
            request.medicine_id,
            window_days,
        )

        if not consumption_result.succeeded:
            return self._tool_failure(consumption_result)

        average_daily = parse_daily_consumption(consumption_result).average_daily_consumption

        # 2. The configured threshold, which supplies the lead time to compare against.
        threshold_result = self._tools.get_shortage_threshold(
            request.facility_id,
            request.medicine_id,
        )

        if not threshold_result.succeeded:
            return self._tool_failure(threshold_result)

        threshold = parse_shortage_threshold(threshold_result)

        findings: list[Finding] = [
            Finding(
                code="AVERAGE_DAILY_CONSUMPTION",
                summary=(
                    f"Average consumption over the last {window_days} days is "
                    f"{average_daily:g} units per day."
                ),
                value=average_daily,
                unit="units/day",
            ),
            Finding(
                code="LEAD_TIME",
                summary=f"Replenishment lead time is {threshold.lead_time_days} days.",
                value=float(threshold.lead_time_days),
                unit="days",
            ),
        ]

        evidence: list[Evidence] = [
            Evidence(
                source="calculateDailyConsumption",
                detail=f"{window_days} day consumption window",
                value=average_daily,
            ),
            Evidence(
                source="getShortageThreshold",
                detail="Configured reorder rule",
                value=threshold.lead_time_days,
            ),
        ]

        # Without stock on hand there is nothing to project a stockout against.
        # Inventory balances belong to the Inventory vertical, so the coordinator is
        # told what it still needs rather than the agent guessing.
        if request.current_stock is None:
            return self._validated(
                AgentResult(
                    agent=AGENT_NAME,
                    status="SUCCESS",
                    confidence=0.5,
                    findings=findings,
                    recommendations=[
                        Recommendation(
                            code="STOCK_REQUIRED",
                            summary=(
                                "Current stock on hand is required before a stockout "
                                "can be projected. Request it from the Inventory agent."
                            ),
                            priority="MEDIUM",
                        )
                    ],
                    required_validation=True,
                    evidence=evidence,
                )
            )

        # 3. Projected stockout and shortage risk, computed by the backend.
        stockout_result = self._tools.calculate_projected_stockout(
            request.facility_id,
            request.medicine_id,
            current_stock=request.current_stock,
            average_daily_consumption=average_daily,
            lead_time_days=threshold.lead_time_days,
            window_days=window_days,
        )

        if not stockout_result.succeeded:
            return self._tool_failure(stockout_result)

        stockout = parse_projected_stockout(stockout_result)

        evidence.append(
            Evidence(
                source="calculateProjectedStockout",
                detail="Backend deterministic stockout projection",
                value=stockout.days_remaining,
            )
        )

        if stockout.days_remaining is None:
            findings.append(
                Finding(
                    code="NO_PROJECTED_STOCKOUT",
                    summary=(
                        "No consumption is recorded for this medicine, so no stockout "
                        "is projected."
                    ),
                )
            )
        else:
            findings.append(
                Finding(
                    code="DAYS_OF_STOCK",
                    summary=(
                        f"{stockout.current_stock:g} units at {average_daily:g} per day "
                        f"gives {stockout.days_remaining} days of cover."
                    ),
                    value=float(stockout.days_remaining),
                    unit="days",
                )
            )

        recommendations: list[Recommendation] = []

        if stockout.requires_transfer:
            findings.append(
                Finding(
                    code="SHORTAGE_RISK",
                    summary=(
                        f"{stockout.days_remaining} days of cover is less than the "
                        f"{stockout.lead_time_days} day lead time, so stock will run "
                        "out before replenishment arrives."
                    ),
                )
            )
            recommendations.append(
                Recommendation(
                    code="INVESTIGATE_REPLENISHMENT",
                    summary=(
                        "Shortage risk confirmed. Identify a redistribution or "
                        "procurement response for review."
                    ),
                    priority="HIGH",
                )
            )
        else:
            findings.append(
                Finding(
                    code="NO_SHORTAGE_RISK",
                    summary="Stock is projected to last until replenishment arrives.",
                )
            )

        return self._validated(
            AgentResult(
                agent=AGENT_NAME,
                status="SUCCESS",
                confidence=self._confidence(stockout.risk_level, average_daily),
                findings=findings,
                recommendations=recommendations,
                # A specialist agent never clears its own work. Deterministic backend
                # validation and human approval remain authoritative.
                required_validation=True,
                requested_action=None,
                evidence=evidence,
            )
        )

    # ------------------------------------------------------------------
    # LangGraph node
    # ------------------------------------------------------------------

    def as_node(self):
        """Return this agent as a LangGraph node callable."""

        def node(state: dict[str, Any]) -> dict[str, Any]:
            return demand_shortage_node(state, agent=self)

        return node

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _validated(self, result: AgentResult) -> AgentResult:
        """Run the output guard before the result leaves the agent."""
        return self._output_guard.validate(result)

    def _tool_failure(self, result: ToolResult) -> AgentResult:
        logger.warning(
            "Tool %s failed: %s %s",
            result.tool,
            result.error_code,
            result.error_message,
        )
        return self._safe_failure(
            result.error_code or "TOOL_FAILURE",
            f"{result.tool} was unavailable: {result.error_message}",
        )

    def _safe_failure(self, code: str, message: str) -> AgentResult:
        """A failure the coordinator can act on, with no fabricated numbers."""
        return AgentResult(
            agent=AGENT_NAME,
            status="SAFE_FAILURE",
            confidence=0.0,
            findings=[Finding(code=code, summary=message)],
            recommendations=[],
            required_validation=True,
            requested_action=None,
            evidence=[],
        )

    @staticmethod
    def _confidence(risk_level: str, average_daily: float) -> float:
        """Confidence in the assessment, not in the arithmetic.

        The arithmetic is exact. What varies is how much consumption history stood
        behind it, so an assessment built on no recorded usage is reported as weak.

        Not specified in the final blueprint: how agent confidence is derived. The
        contract requires the field but not its formula. Do not assume or introduce a
        new decision without team-level confirmation.
        """
        if average_daily <= 0:
            return 0.4

        return 0.9 if risk_level == "HIGH" else 0.8


def demand_shortage_node(
    state: dict[str, Any],
    agent: DemandShortageAgent | None = None,
) -> dict[str, Any]:
    """LangGraph node entry point for the Demand & Shortage Agent.

    Reads the facility, medicine and stock the coordinator placed in the workflow
    state, and writes the validated agent result back under ``results``.

    The graph that wires this node is owned by Vaisnavi L. (IT24102469).
    """
    if agent is None:
        raise ValueError(
            "demand_shortage_node requires a configured DemandShortageAgent. "
            "Bind one with DemandShortageAgent.as_node()."
        )

    request = DemandShortageRequest(
        facility_id=state["facilityId"],
        medicine_id=state["medicineId"],
        current_stock=state.get("currentStock"),
        window_days=state.get("windowDays", DEFAULT_WINDOW_DAYS),
        objective=state.get("objective"),
    )

    result = agent.analyze(request)

    results = dict(state.get("results") or {})
    results[AGENT_NAME] = result.to_contract_dict()

    return {**state, "results": results}
