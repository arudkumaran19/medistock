"""Tool allow-list tests for the Demand & Shortage Agent.

Sathurstiga S. (IT24103156).

Blueprint section 23 requires every agent to hold an allow-list and to be refused any
tool outside it. Other agents' entries are added here by their owners.
"""

from __future__ import annotations

import pytest

from medistock_agents.safety.tool_guard import (
    DEMAND_SHORTAGE_TOOLS,
    ToolGuard,
    ToolNotAllowedError,
)


@pytest.fixture
def guard() -> ToolGuard:
    return ToolGuard("demand_shortage")


def test_allow_list_matches_the_blueprint_exactly():
    assert DEMAND_SHORTAGE_TOOLS == {
        "getConsumptionHistory",
        "calculateDailyConsumption",
        "calculateForecast",
        "calculateProjectedStockout",
        "getShortageThreshold",
    }


@pytest.mark.parametrize("tool", sorted(DEMAND_SHORTAGE_TOOLS))
def test_permitted_tools_are_allowed(guard: ToolGuard, tool: str):
    assert guard.is_allowed(tool)
    guard.enforce(tool)


@pytest.mark.parametrize(
    "tool",
    [
        "approveTransfer",
        "modifyInventory",
        "createPurchaseOrder",
        "deleteFacility",
        "calculateDistance",
        "getCandidateFacilities",
        "getMedicineBatch",
    ],
)
def test_tools_outside_the_allow_list_are_refused(guard: ToolGuard, tool: str):
    assert not guard.is_allowed(tool)

    with pytest.raises(ToolNotAllowedError):
        guard.enforce(tool)


def test_an_unregistered_agent_is_allowed_nothing():
    """Least privilege by default: an unknown agent gets an empty allow-list."""
    guard = ToolGuard("not_a_registered_agent")

    with pytest.raises(ToolNotAllowedError):
        guard.enforce("calculateForecast")


def test_the_demand_agent_cannot_reach_another_vertical_tool(guard: ToolGuard):
    # Routing and distance belong to the Redistribution agent.
    with pytest.raises(ToolNotAllowedError):
        guard.enforce("calculateDistance")


def test_refusal_names_the_agent_and_the_tool(guard: ToolGuard):
    with pytest.raises(ToolNotAllowedError) as exc_info:
        guard.enforce("approveTransfer")

    assert exc_info.value.agent == "demand_shortage"
    assert exc_info.value.tool == "approveTransfer"
