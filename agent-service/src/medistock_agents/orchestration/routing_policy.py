"""Coordinator routing policy: intent classification and agent selection.

PRIMARY OWNER of ``orchestration/``: Vaisnavi L. (IT24102469).

SUPPORTING CONTRIBUTION by Sathurstiga S. (IT24103156): intent classification and
demand delegation, which is this member's assigned coordinator contribution
(blueprint section 31). The coordinator itself, the graph and the workflow state
remain with the primary owner, who reviews and integrates this module.

Why classification is deterministic
-----------------------------------
The blueprint's central risk for the coordinator is that it degenerates into a fixed
pipeline that always calls all four specialists (sections 13 and 100). Classifying the
objective with explicit rules makes the selection inspectable and directly testable:
each of the five worked examples in section 21 has an expected agent set, asserted in
``tests/test_coordinator.py``.

The coordinator may still refine a plan using the model. This module decides the
minimum set of specialists an objective actually requires.
"""

from __future__ import annotations

import re
from enum import Enum


class Intent(str, Enum):
    """What the objective is asking for."""

    INVENTORY_QUERY = "INVENTORY_QUERY"
    SHORTAGE_ASSESSMENT = "SHORTAGE_ASSESSMENT"
    SHORTAGE_RESOLUTION = "SHORTAGE_RESOLUTION"
    TRANSFER_PROPOSAL = "TRANSFER_PROPOSAL"
    PROCUREMENT_PLANNING = "PROCUREMENT_PLANNING"
    UNKNOWN = "UNKNOWN"


# Specialist agent names, matching the registered agents.
INVENTORY = "inventory_intelligence"
DEMAND = "demand_shortage"
REDISTRIBUTION = "redistribution_planning"
PROCUREMENT_VALIDATION = "procurement_policy_validation"


# The minimum specialists each intent requires, in delegation order.
INTENT_AGENTS: dict[Intent, tuple[str, ...]] = {
    # "How much Amoxicillin is available at Hospital B?"
    Intent.INVENTORY_QUERY: (INVENTORY,),
    # "Will Hospital B run out of Amoxicillin?"
    Intent.SHORTAGE_ASSESSMENT: (DEMAND,),
    # "Hospital B may run out. Find a suitable transfer."
    Intent.SHORTAGE_RESOLUTION: (DEMAND, REDISTRIBUTION, PROCUREMENT_VALIDATION),
    # "Can we transfer 400 units from Hospital A to B?"
    # The request already supplies the quantity, so no forecast is needed.
    Intent.TRANSFER_PROPOSAL: (INVENTORY, PROCUREMENT_VALIDATION),
    # "We cannot redistribute enough. What procurement action should be considered?"
    Intent.PROCUREMENT_PLANNING: (INVENTORY, DEMAND, PROCUREMENT_VALIDATION),
    Intent.UNKNOWN: (),
}


_PROCUREMENT = re.compile(
    r"\b(procure|procurement|purchase\s+order|purchasing|supplier|reorder|replenishment\s+order)\b",
    re.I,
)

_SHORTAGE = re.compile(
    r"\b(run\s+out|running\s+out|stock\s*out|stockout|shortage|short\s+of|"
    r"days\s+of\s+stock|forecast|demand|consumption|deplete)\w*\b",
    re.I,
)

_RESOLUTION = re.compile(
    r"\b(find|identify|suggest|recommend|source|resolve|solve|fix|options?|"
    r"redistribut\w*|suitable)\b",
    re.I,
)

_TRANSFER = re.compile(r"\b(transfer|move|send|ship)\b", re.I)

_PROPOSAL = re.compile(r"\b(can\s+we|could\s+we|is\s+it\s+possible|should\s+we|may\s+we)\b", re.I)

_INVENTORY = re.compile(
    r"\b(how\s+much|how\s+many|available|availability|on\s+hand|stock\s+level|"
    r"quantity|batch|expiry|expiring|balance)\b",
    re.I,
)


def classify_intent(objective: str | None) -> Intent:
    """Classify an objective into the intent that drives agent selection.

    Ordering matters. A procurement question is procurement even when it mentions a
    shortage, and a shortage that asks for a response is a resolution rather than a
    plain assessment.
    """
    text = (objective or "").strip()

    if not text:
        return Intent.UNKNOWN

    if _PROCUREMENT.search(text):
        return Intent.PROCUREMENT_PLANNING

    mentions_shortage = bool(_SHORTAGE.search(text))

    # A shortage plus a request for a response needs the full resolution chain.
    if mentions_shortage and (_RESOLUTION.search(text) or _TRANSFER.search(text)):
        return Intent.SHORTAGE_RESOLUTION

    # An explicit transfer proposal already carries its own quantity, so it needs
    # validation rather than a forecast.
    if _TRANSFER.search(text) and _PROPOSAL.search(text):
        return Intent.TRANSFER_PROPOSAL

    if mentions_shortage:
        return Intent.SHORTAGE_ASSESSMENT

    if _INVENTORY.search(text):
        return Intent.INVENTORY_QUERY

    return Intent.UNKNOWN


def select_agents(objective: str | None) -> tuple[str, ...]:
    """The specialists an objective requires, in delegation order."""
    return INTENT_AGENTS[classify_intent(objective)]


def requires_demand_agent(objective: str | None) -> bool:
    """Whether this objective needs the Demand & Shortage Agent.

    The delegation contract this vertical is responsible for: the demand specialist
    is called when the objective concerns forecasting, days of stock or shortage
    risk, and is left out when it does not.
    """
    return DEMAND in select_agents(objective)
