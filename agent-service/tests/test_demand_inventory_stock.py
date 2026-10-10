"""Demand agent: current stock from the Inventory balance.

Sathurstiga S. (IT24103156).

When the caller does not supply current stock, the backend tool reads it from the
Inventory balance (on hand - reserved). The agent never guesses it: when Inventory
has no balance either, the existing STOCK_REQUIRED recommendation is returned.
"""

from __future__ import annotations

import json

import httpx
import pytest

from medistock_agents.agents.demand_shortage_agent import (
    DemandShortageAgent,
    DemandShortageRequest,
)

from conftest import FACILITY_ID, MEDICINE_ID, FakeBackend, build_client


def _request(**overrides) -> DemandShortageRequest:
    defaults = {
        "facility_id": FACILITY_ID,
        "medicine_id": MEDICINE_ID,
        "current_stock": None,
        "window_days": 30,
    }
    defaults.update(overrides)

    return DemandShortageRequest(**defaults)


def _codes(result) -> set[str]:
    return {finding.code for finding in result.findings}


def test_missing_stock_is_read_from_inventory_and_projects_the_worked_example():
    """Inventory holds 120 available: 120 / 20 = 6 days < 10 lead time."""
    backend = FakeBackend(inventory_stock=120.0)
    agent = DemandShortageAgent(build_client(backend.handler))

    result = agent.analyze(_request())

    assert result.status == "SUCCESS"
    assert "SHORTAGE_RISK" in _codes(result)
    days = next(f for f in result.findings if f.code == "DAYS_OF_STOCK")
    assert days.value == 6
    assert not any(r.code == "STOCK_REQUIRED" for r in result.recommendations)


def test_inventory_stock_is_attributed_in_the_evidence():
    backend = FakeBackend(inventory_stock=120.0)
    agent = DemandShortageAgent(build_client(backend.handler))

    result = agent.analyze(_request())

    inventory = [e for e in result.evidence if "Inventory balance" in e.detail]
    assert len(inventory) == 1
    assert inventory[0].value == 120.0


def test_no_inventory_balance_still_asks_for_stock_rather_than_guessing():
    backend = FakeBackend(inventory_stock=None)
    agent = DemandShortageAgent(build_client(backend.handler))

    result = agent.analyze(_request())

    assert result.status == "SUCCESS"
    assert any(r.code == "STOCK_REQUIRED" for r in result.recommendations)
    assert "DAYS_OF_STOCK" not in _codes(result)


def test_supplied_stock_is_used_and_inventory_is_not_consulted():
    backend = FakeBackend(inventory_stock=9999.0)
    agent = DemandShortageAgent(build_client(backend.handler))

    result = agent.analyze(_request(current_stock=120.0))

    days = next(f for f in result.findings if f.code == "DAYS_OF_STOCK")
    assert days.value == 6
    # Exactly one stockout projection: the real one, not an inventory lookup.
    assert [op for _, op in backend.calls].count("projectedStockout") == 1
    assert not any("Inventory balance" in e.detail for e in result.evidence)


def test_the_lookup_sends_no_stock_so_the_backend_reads_inventory():
    backend = FakeBackend(inventory_stock=120.0)
    seen: list[dict] = []

    def recording_handler(request):
        payload = json.loads(request.content)
        if payload["operation"] == "projectedStockout":
            seen.append(payload["arguments"])
        return backend.handler(request)

    agent = DemandShortageAgent(build_client(recording_handler))
    agent.analyze(_request())

    assert seen[0]["currentStock"] is None
    # The follow-up projection carries the figure the backend returned.
    assert seen[-1]["currentStock"] == 120.0


def test_default_lead_time_is_called_out_in_the_finding():
    """A medicine with no reorder rule gets the backend default, and the agent says so."""
    backend = FakeBackend(inventory_stock=120.0)

    def default_rule_handler(request):
        response = backend.handler(request)
        payload = json.loads(request.content)

        if payload["operation"] == "shortageThreshold":
            body = response.json()
            body["data"]["source"] = "DEFAULT"
            return httpx.Response(200, json=body)

        return response

    agent = DemandShortageAgent(build_client(default_rule_handler))

    result = agent.analyze(_request())

    lead_time = next(f for f in result.findings if f.code == "LEAD_TIME")
    assert "default lead time" in lead_time.summary
    assert "SHORTAGE_RISK" in _codes(result)


def test_configured_lead_time_is_not_called_a_default():
    backend = FakeBackend(inventory_stock=120.0)
    agent = DemandShortageAgent(build_client(backend.handler))

    result = agent.analyze(_request())

    lead_time = next(f for f in result.findings if f.code == "LEAD_TIME")
    assert lead_time.summary == "Replenishment lead time is 10 days."


@pytest.mark.asyncio
async def test_reasoning_path_without_a_model_also_reads_inventory():
    backend = FakeBackend(inventory_stock=120.0)
    agent = DemandShortageAgent(build_client(backend.handler))

    result = await agent.analyze_with_reasoning(_request())

    assert "SHORTAGE_RISK" in _codes(result)
