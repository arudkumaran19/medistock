"""LLM-driven intent classification for the MediStock Coordinator.

Produces a validated `IntentDecision` from the user's natural-language objective
using the configured LLM provider.  Falls back to `None` gracefully when the
LLM is unavailable or returns invalid output — the caller must apply deterministic
fallback routing in that case.

Design constraints
------------------
* The LLM *recommends* an intent and a plan.  Deterministic application code
  retains full authority over permissions, approvals, and operational execution.
* All model outputs are validated against allowlists before any step is executed.
* No sensitive inventory or patient data is included in the prompt.
* No secrets are logged.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowlists -- validated before executing any plan step
# ---------------------------------------------------------------------------

ALLOWED_INTENTS: frozenset[str] = frozenset([
    "InventoryAudit",
    "CatalogueQuery",
    "ExpiryAudit",
    "DemandForecast",
    "ShortageAnalysis",
    "StockRedistribution",
    "AutonomousProcurement",
    "CombinedResolution",
    "Neither",
    "RedistributionEvaluation",
    "ProcurementEvaluation",
    "Clarification",
    "GeneralInquiry",
    "OutOfDomain",
    "InsufficientData",
])

ALLOWED_AGENTS: frozenset[str] = frozenset([
    "InventoryAudit",
    "DemandForecast",
    "StockRedistribution",
    "AutonomousProcurement",
    "PolicyValidation",
])

ALLOWED_TOOLS: frozenset[str] = frozenset([
    "get_stock_balance",
    "get_medicine_catalogue",
    "calculate_days_of_supply",
    "calculate_demand_forecast",
    "find_donor_candidates",
    "score_suppliers",
    "validate_policy",
])

_MAX_OBJECTIVE_CHARS = 500


# ---------------------------------------------------------------------------
# IntentDecision dataclass
# ---------------------------------------------------------------------------

@dataclass
class IntentDecision:
    """Validated structured intent decision produced by the LLM classifier."""

    intent: str
    required_agents: list[str] = field(default_factory=list)
    required_tools: list[str] = field(default_factory=list)
    plan: list[str] = field(default_factory=list)
    response_detail: str = "standard"
    requires_clarification: bool = False
    clarification_question: str = ""
    requires_approval: bool = False
    entities: dict[str, Any] = field(default_factory=dict)
    llm_used: bool = False


# ---------------------------------------------------------------------------
# LLM Intent Classifier
# ---------------------------------------------------------------------------

class LLMIntentClassifier:
    """Classifies a user objective into a validated IntentDecision using the LLM."""

    _SYSTEM_PROMPT = """\
You are the MediStock Multi-Agent Coordinator intent classifier.

Your role is to interpret the user request and produce a structured JSON decision.
You must ONLY select from the allowed intents, agents, and tools listed below.

ALLOWED_INTENTS (choose exactly one):
- InventoryAudit        : Simple factual stock lookup ("What is the stock of X?")
- CatalogueQuery        : Multi-medicine catalogue or all-medicines stock query
- ExpiryAudit           : Batch expiry scan across all facilities ("which batches expire in X days?")
- DemandForecast        : Consumption rate / days-of-supply / forecast query (no action)
- ShortageAnalysis      : Full shortage investigation ending with user strategy selection
- StockRedistribution   : Execute redistribution (only when user explicitly selected)
- AutonomousProcurement : Execute procurement (only when user explicitly selected)
- CombinedResolution    : Both redistribution and procurement (user explicitly selected)
- Neither               : Retain findings, no action (user explicitly selected)
- RedistributionEvaluation : Advisory redistribution comparison, no action
- ProcurementEvaluation : Advisory procurement comparison, no action
- Clarification         : Essential information is missing; ask a focused question
- GeneralInquiry        : Greetings, capabilities, or general MediStock operational questions
- OutOfDomain           : Inquiries unrelated to MediStock or healthcare inventory (weather, general chat)
- InsufficientData      : Data required to answer is missing or unavailable

ALLOWED_AGENTS: InventoryAudit, DemandForecast, StockRedistribution, AutonomousProcurement, PolicyValidation
ALLOWED_TOOLS: get_stock_balance, get_medicine_catalogue, calculate_days_of_supply, calculate_demand_forecast, find_donor_candidates, score_suppliers, validate_policy

RULES:
1. Simple stock question -> InventoryAudit only. response_detail = concise.
2. Multi-medicine/all-medicines -> CatalogueQuery only.
3. Forecast/days-of-supply question -> DemandForecast only.
4. Full shortage inquiry -> ShortageAnalysis.
5. "Redistribution"/"Procurement"/"Both"/"Neither" standalone or "apply strategy" -> that exact intent.
6. Comparison request -> RedistributionEvaluation or ProcurementEvaluation.
7. Explicit "initiate"/"execute"/"proceed" -> corresponding action intent.
8. NEVER produce tool/agent names not in the allowed lists.
9. NEVER requires_approval=true for read-only intents.
10. NEVER requires_approval for ShortageAnalysis.

Return ONLY valid JSON:
{
  "intent": "...",
  "required_agents": ["..."],
  "required_tools": ["..."],
  "plan": ["Step 1: ...", "Step 2: ..."],
  "response_detail": "concise|standard|detailed",
  "requires_clarification": false,
  "clarification_question": "",
  "requires_approval": false,
  "entities": {"medicine": "...", "facility": "...", "quantity": null, "horizon_days": 30}
}
"""

    def __init__(self, llm_provider: Any) -> None:
        self._llm = llm_provider

    async def classify(
        self,
        objective: str,
        workflow_type: str = "",
        conversation_context: str = "",
    ) -> "IntentDecision | None":
        if not self._llm:
            return None
        try:
            available = await self._llm.is_available()
        except Exception:
            available = False
        if not available:
            logger.debug("LLM unavailable -- using deterministic intent routing")
            return None

        safe_obj = objective[:_MAX_OBJECTIVE_CHARS]
        wf_hint = f"\nFrontend workflow type hint: {workflow_type}" if workflow_type else ""
        ctx_hint = f"\nConversation context (last turn): {conversation_context[-200:]}" if conversation_context else ""

        user_prompt = (
            f"User objective: {safe_obj}{wf_hint}{ctx_hint}\n\nClassify this into a structured JSON decision."
        )

        try:
            raw = await self._llm.generate(user_prompt, self._SYSTEM_PROMPT)
        except Exception as ex:
            logger.warning("LLM intent classification failed: %s", ex)
            return None

        return self._parse_and_validate(raw, workflow_type)

    def _parse_and_validate(self, raw: str, workflow_type: str) -> "IntentDecision | None":
        if not raw:
            return None
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            logger.warning("LLM returned non-JSON intent response: %s", raw[:200])
            return None
        try:
            data = json.loads(json_match.group(0))
        except json.JSONDecodeError as ex:
            logger.warning("LLM intent JSON parse failed: %s", ex)
            return None

        intent = str(data.get("intent", "")).strip()
        if intent not in ALLOWED_INTENTS:
            logger.warning("LLM returned unknown intent %r -- falling back to deterministic", intent)
            return None

        # Frontend-explicit strategy selections override LLM
        if workflow_type in ("StockRedistribution", "AutonomousProcurement", "CombinedResolution", "Neither"):
            intent = workflow_type

        raw_agents = data.get("required_agents", [])
        agents = [a for a in (raw_agents if isinstance(raw_agents, list) else []) if a in ALLOWED_AGENTS]

        raw_tools = data.get("required_tools", [])
        tools = [t for t in (raw_tools if isinstance(raw_tools, list) else []) if t in ALLOWED_TOOLS]

        raw_plan = data.get("plan", [])
        plan = [str(s)[:200] for s in (raw_plan if isinstance(raw_plan, list) else []) if isinstance(s, str)]

        detail = str(data.get("response_detail", "standard"))
        if detail not in ("concise", "standard", "detailed"):
            detail = "standard"

        requires_clarification = bool(data.get("requires_clarification", False))
        clarification_question = str(data.get("clarification_question", ""))[:300]
        requires_approval = (
            bool(data.get("requires_approval", False))
            and intent in ("StockRedistribution", "AutonomousProcurement", "CombinedResolution")
        )

        raw_entities = data.get("entities", {})
        entities = raw_entities if isinstance(raw_entities, dict) else {}

        logger.info(
            "LLM intent decision: intent=%s agents=%s tools=%s detail=%s",
            intent, agents, tools, detail,
        )

        return IntentDecision(
            intent=intent,
            required_agents=agents,
            required_tools=tools,
            plan=plan,
            response_detail=detail,
            requires_clarification=requires_clarification,
            clarification_question=clarification_question,
            requires_approval=requires_approval,
            entities=entities,
            llm_used=True,
        )
