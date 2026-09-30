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

from medistock_agents.agents.demand_graph import DemandPlanner, build_demand_graph
from medistock_agents.agents.demand_reasoning import DemandFacts, DemandNarrator
from medistock_agents.models.demand_models import (
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

# Finding codes whose summary text the reasoning layer is allowed to replace. The
# codes, values and units are tool-derived and are never touched.
_NARRATABLE_FINDING = "AI_ASSESSMENT"


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
        narrator: DemandNarrator | None = None,
        planner: DemandPlanner | None = None,
    ) -> None:
        self._tools = tools
        self._input_guard = input_guard or InputGuard()
        self._output_guard = output_guard or OutputGuard()
        # Both optional. Without them the agent behaves exactly as it always has.
        self._narrator = narrator
        self._planner = planner

        # The full agentic path needs both: something to choose the tools and
        # something to explain the results.
        self._graph = (
            build_demand_graph(planner, tools, narrator)
            if planner is not None and narrator is not None
            else None
        )

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
    # Model-assisted entry point
    # ------------------------------------------------------------------

    async def analyze_with_reasoning(self, request: DemandShortageRequest) -> AgentResult:
        """Assess shortage risk with the model in the loop.

        Three paths, in descending capability, each degrading into the next:

        1. AGENTIC - the model selects which controlled tools the objective needs
           (blueprint section 21), code executes them, the model interprets them.
        2. INTERPRETED - the fixed tool sequence runs, the model explains the result.
        3. DETERMINISTIC - the original behaviour, with no model involved.

        Whatever fails, the caller gets a correct answer. The model can improve the
        response but can never be the reason there isn't one (blueprint section 41).
        """
        # Screening precedes everything. Injected text must never reach a prompt.
        if request.objective is not None:
            screened = self._input_guard.inspect(request.objective)

            if not screened.is_safe:
                logger.warning(
                    "Objective refused before planning for facility %s: %s",
                    request.facility_id,
                    screened.refusal_reason,
                )
                return self._safe_failure("OBJECTIVE_REFUSED", screened.refusal_reason)

        if self._graph is not None:
            agentic = await self._run_graph(request)

            if agentic is not None:
                return agentic

            logger.info("Agentic path unavailable; falling back to the fixed sequence.")

        result = self.analyze(request)

        if self._narrator is None:
            return result

        # Nothing to interpret: the objective was refused or a tool was down. Adding
        # model prose to a safe failure would only dress up an absence of data.
        if result.status != "SUCCESS":
            return result

        facts = _facts_from(result, request)
        narrative = await self._narrator.interpret(facts, objective=request.objective)

        if not narrative.accepted:
            logger.info(
                "Keeping deterministic demand result: %s",
                narrative.rejection_reason,
            )
            return result

        enriched = result.model_copy(
            update={
                "findings": [
                    *result.findings,
                    Finding(
                        code=_NARRATABLE_FINDING,
                        summary=narrative.assessment or "",
                    ),
                ],
                "recommendations": [*result.recommendations, *narrative.recommendations],
            }
        )

        # The enriched result goes through the same guard as every other result. A
        # model-authored recommendation gets no privileged path.
        return self._validated(enriched)

    async def _run_graph(self, request: DemandShortageRequest) -> AgentResult | None:
        """Run the agentic workflow. Returns None when the caller must fall back."""
        window_days = request.window_days or DEFAULT_WINDOW_DAYS

        try:
            state = await self._graph.ainvoke(  # type: ignore[union-attr]
                {
                    "objective": request.objective,
                    "facility_id": request.facility_id,
                    "medicine_id": request.medicine_id,
                    "current_stock": request.current_stock,
                    "window_days": window_days,
                    "errors": [],
                }
            )
        except Exception as exc:
            logger.warning("Demand graph failed: %s", exc)
            return None

        if state.get("fallback_triggered"):
            return None

        findings: list[Finding] = list(state.get("findings") or [])

        if not findings:
            return None

        by_code = {finding.code: finding for finding in findings}
        recommendations: list[Recommendation] = []

        # The deterministic response to a confirmed shortage, unchanged from analyze().
        if "SHORTAGE_RISK" in by_code:
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

        # The plan wanted a stockout projection but no stock level was supplied.
        if "STOCK_REQUIRED" in (state.get("errors") or []):
            recommendations.append(
                Recommendation(
                    code="STOCK_REQUIRED",
                    summary=(
                        "Current stock on hand is required before a stockout can be "
                        "projected. Request it from the Inventory agent."
                    ),
                    priority="MEDIUM",
                )
            )

        assessment = state.get("assessment")

        if assessment:
            findings.append(Finding(code=_NARRATABLE_FINDING, summary=assessment))
            recommendations.extend(state.get("recommendations") or [])

        facts = state.get("facts")
        average_daily = getattr(facts, "average_daily_consumption", None) or 0.0
        risk_level = getattr(facts, "risk_level", None) or ""

        return self._validated(
            AgentResult(
                agent=AGENT_NAME,
                status="SUCCESS",
                confidence=self._confidence(risk_level, average_daily),
                findings=findings,
                recommendations=recommendations,
                # Unchanged: a specialist never clears its own work, however it ran.
                required_validation=True,
                requested_action=None,
                evidence=list(state.get("evidence") or []),
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


def _facts_from(result: AgentResult, request: DemandShortageRequest) -> DemandFacts:
    """Build the model's fact sheet from the deterministic result.

    Reads back only what the tools put into the result, so the sheet cannot contain a
    value the backend did not produce.
    """
    by_code = {finding.code: finding for finding in result.findings}

    def value_of(code: str) -> float | None:
        finding = by_code.get(code)
        return finding.value if finding is not None else None

    lead_time = value_of("LEAD_TIME")
    days_remaining = value_of("DAYS_OF_STOCK")
    requires_transfer = "SHORTAGE_RISK" in by_code

    return DemandFacts(
        facility_id=request.facility_id,
        medicine_id=request.medicine_id,
        window_days=request.window_days or DEFAULT_WINDOW_DAYS,
        average_daily_consumption=value_of("AVERAGE_DAILY_CONSUMPTION"),
        lead_time_days=int(lead_time) if lead_time is not None else None,
        current_stock=request.current_stock,
        days_remaining=int(days_remaining) if days_remaining is not None else None,
        # Only meaningful once a stockout was actually projected.
        requires_transfer=requires_transfer if days_remaining is not None else None,
        risk_level="HIGH" if requires_transfer else None,
    )


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
