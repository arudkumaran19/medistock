"""Input guard: screens an objective before it reaches the model.

Prompt-injection mitigation is assigned to Sathurstiga S. (IT24103156) in the
blueprint risk register.

The guard does not attempt to decide whether text is "safe" in general. It flags the
specific class of instruction the blueprint's golden case names - text that tries to
make the agent override system policy, approve a transaction, or escalate its own
permissions - so the agent refuses rather than complies (blueprint section 65,
golden case 4).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Phrases that ask the agent to discard its own rules or to act beyond its remit.
# Matched case-insensitively against the objective text.
_OVERRIDE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"ignore\s+(all\s+|any\s+|your\s+|previous\s+|prior\s+)*(rules|instructions|policy|policies)", re.I),
    re.compile(r"disregard\s+(all\s+|any\s+|your\s+|previous\s+|prior\s+)*(rules|instructions|policy|policies)", re.I),
    re.compile(r"forget\s+(all\s+|your\s+|previous\s+|prior\s+)*(rules|instructions)", re.I),
    re.compile(r"override\s+(the\s+|all\s+|any\s+)?(validation|rules|policy|policies|system)", re.I),
    re.compile(r"bypass\s+(the\s+)?(validation|approval|rules|policy|policies|authorization)", re.I),
    re.compile(r"\byou\s+are\s+now\b", re.I),
    re.compile(r"\bdeveloper\s+mode\b", re.I),
    re.compile(r"\bsystem\s+prompt\b", re.I),
    re.compile(r"reveal\s+(your\s+)?(instructions|prompt|rules|api\s*key|secret)", re.I),
)

# Actions this agent is never permitted to take, however they are phrased.
# The Demand & Shortage Agent assesses risk; it does not move or authorise stock.
_PRIVILEGED_ACTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bapprove\b.{0,40}\b(transfer|order|request|purchase)", re.I),
    re.compile(r"\b(execute|perform|commit)\b.{0,40}\b(transfer|transaction)", re.I),
    re.compile(r"\b(modify|update|adjust|change|delete)\b.{0,30}\b(inventory|stock|database)", re.I),
    re.compile(r"\bcreate\b.{0,30}\bpurchase\s+order", re.I),
    re.compile(r"\bdelete\b.{0,30}\b(facility|record|user)", re.I),
)

MAX_OBJECTIVE_LENGTH = 2000


@dataclass
class InputGuardResult:
    """Outcome of screening an objective."""

    is_safe: bool
    sanitised_objective: str
    reasons: list[str] = field(default_factory=list)

    @property
    def refusal_reason(self) -> str:
        return "; ".join(self.reasons)


class InputGuard:
    """Screens an incoming objective for override and privilege-escalation attempts."""

    def inspect(self, objective: str | None) -> InputGuardResult:
        text = (objective or "").strip()
        reasons: list[str] = []

        if not text:
            return InputGuardResult(False, "", ["The objective is empty."])

        if len(text) > MAX_OBJECTIVE_LENGTH:
            # Oversized input is truncated rather than rejected, so a long but
            # legitimate objective still runs.
            text = text[:MAX_OBJECTIVE_LENGTH]
            reasons.append("The objective was truncated to the maximum accepted length.")

        for pattern in _OVERRIDE_PATTERNS:
            if pattern.search(text):
                return InputGuardResult(
                    False,
                    text,
                    ["The objective attempts to override system rules or policy."],
                )

        for pattern in _PRIVILEGED_ACTION_PATTERNS:
            if pattern.search(text):
                return InputGuardResult(
                    False,
                    text,
                    [
                        "The objective requests an action outside this agent's remit. "
                        "The Demand & Shortage Agent assesses shortage risk and never "
                        "approves, executes or modifies stock."
                    ],
                )

        return InputGuardResult(True, text, reasons)
