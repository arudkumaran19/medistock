"""Coordinator intent classification and demand delegation tests.

SUPPORTING CONTRIBUTION by Sathurstiga S. (IT24103156) to the coordinator, which is
owned by Vaisnavi L. (IT24102469). This is the coordinator contribution assigned to
this member in blueprint section 31.

The five worked examples in blueprint section 21 are asserted directly, because the
specification's central coordinator risk is a fixed pipeline that always calls every
specialist.
"""

from __future__ import annotations

import pytest

from medistock_agents.orchestration.routing_policy import (
    DEMAND,
    INVENTORY,
    PROCUREMENT_VALIDATION,
    REDISTRIBUTION,
    Intent,
    classify_intent,
    requires_demand_agent,
    select_agents,
)


# ---------------------------------------------------------------------------
# The five worked examples from blueprint section 21
# ---------------------------------------------------------------------------


def test_example_a_simple_inventory_query_calls_inventory_only():
    objective = "How much Amoxicillin is available at Hospital B?"

    assert classify_intent(objective) is Intent.INVENTORY_QUERY
    assert select_agents(objective) == (INVENTORY,)


def test_example_b_shortage_question_calls_demand_only():
    objective = "Will Hospital B run out of Amoxicillin?"

    assert classify_intent(objective) is Intent.SHORTAGE_ASSESSMENT
    assert select_agents(objective) == (DEMAND,)


def test_example_c_shortage_resolution_calls_the_full_chain():
    objective = "Hospital B may run out of Amoxicillin. Find a suitable transfer."

    assert classify_intent(objective) is Intent.SHORTAGE_RESOLUTION
    assert select_agents(objective) == (DEMAND, REDISTRIBUTION, PROCUREMENT_VALIDATION)


def test_example_d_procurement_question_calls_procurement():
    objective = (
        "We cannot redistribute enough stock. What procurement action should be considered?"
    )

    assert classify_intent(objective) is Intent.PROCUREMENT_PLANNING
    assert select_agents(objective) == (INVENTORY, DEMAND, PROCUREMENT_VALIDATION)


def test_example_e_transfer_proposal_skips_the_forecast():
    """The request already supplies the quantity, so no demand forecast is needed."""
    objective = "Can we transfer 400 units from Hospital A to B?"

    assert classify_intent(objective) is Intent.TRANSFER_PROPOSAL
    assert select_agents(objective) == (INVENTORY, PROCUREMENT_VALIDATION)
    assert requires_demand_agent(objective) is False


# ---------------------------------------------------------------------------
# Dynamic delegation, not a fixed pipeline
# ---------------------------------------------------------------------------


def test_no_objective_calls_every_specialist():
    """If the coordinator always called all four, this project's central risk is real."""
    objectives = [
        "How much Amoxicillin is available at Hospital B?",
        "Will Hospital B run out of Amoxicillin?",
        "Can we transfer 400 units from Hospital A to B?",
    ]

    for objective in objectives:
        assert len(select_agents(objective)) < 4


def test_different_objectives_select_different_agents():
    inventory_only = select_agents("How much Amoxicillin is available at Hospital B?")
    demand_only = select_agents("Will Hospital B run out of Amoxicillin?")

    assert inventory_only != demand_only


def test_an_unrecognised_objective_selects_nothing():
    """The coordinator must ask for clarification rather than guess a plan."""
    assert classify_intent("Hello") is Intent.UNKNOWN
    assert select_agents("Hello") == ()


@pytest.mark.parametrize("objective", [None, "", "   "])
def test_an_empty_objective_is_unknown(objective):
    assert classify_intent(objective) is Intent.UNKNOWN


# ---------------------------------------------------------------------------
# Demand delegation contract - this vertical's responsibility
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "objective",
    [
        "Will Hospital B run out of Amoxicillin?",
        "Assess the shortage risk for Amoxicillin at Hospital B.",
        "How many days of stock remain at Hospital B?",
        "Forecast demand for Amoxicillin next month.",
        "Hospital B may run out. Find a suitable transfer.",
        "What procurement action should we consider for Amoxicillin?",
    ],
)
def test_demand_agent_is_delegated_to_when_the_question_is_about_demand(objective: str):
    assert requires_demand_agent(objective) is True


@pytest.mark.parametrize(
    "objective",
    [
        "How much Amoxicillin is available at Hospital B?",
        "Show the expiring batches at Hospital A.",
        "Can we transfer 400 units from Hospital A to B?",
        "What is the current stock level of Paracetamol?",
    ],
)
def test_demand_agent_is_left_out_when_the_question_is_not_about_demand(objective: str):
    assert requires_demand_agent(objective) is False


def test_classification_is_case_insensitive():
    assert classify_intent("WILL HOSPITAL B RUN OUT OF AMOXICILLIN?") is Intent.SHORTAGE_ASSESSMENT


def test_procurement_wins_over_a_mentioned_shortage():
    """A procurement question stays procurement even when it names the shortage."""
    objective = "There is a shortage at Hospital B. Raise a purchase order recommendation."

    assert classify_intent(objective) is Intent.PROCUREMENT_PLANNING
