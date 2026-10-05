"""Shared fixtures for the Demand & Shortage Agent tests.

Sathurstiga S. (IT24103156).

The tests drive the real DemandToolClient over an httpx mock transport rather than
stubbing the client out, so retry behaviour, error mapping and schema parsing are all
exercised on the path the agent actually uses.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import httpx
import pytest

from medistock_agents.agents.demand_shortage_agent import DemandShortageAgent
from medistock_agents.tools.demand_tools import DemandToolClient

BASE_URL = "http://backend.test"

FACILITY_ID = "b1000000-0000-0000-0000-000000000002"
MEDICINE_ID = "c1000000-0000-0000-0000-000000000001"


class FakeBackend:
    """Stands in for the ASP.NET Core internal tool endpoints.

    Mirrors the backend's deterministic arithmetic so the worked example in the
    blueprint produces the same numbers end to end.
    """

    def __init__(
        self,
        average_daily_consumption: float = 20.0,
        lead_time_days: int = 10,
        minimum_stock: float = 150.0,
    ) -> None:
        self.average_daily_consumption = average_daily_consumption
        self.lead_time_days = lead_time_days
        self.minimum_stock = minimum_stock
        self.calls: list[tuple[str, str]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        operation = payload["operation"]
        arguments = payload["arguments"]

        self.calls.append((request.url.path, operation))

        builder = getattr(self, f"_{_snake(operation)}", None)

        if builder is None:
            return httpx.Response(400, json={"success": False})

        return httpx.Response(200, json={"success": True, "data": builder(arguments)})

    # -- operations -----------------------------------------------------

    def _history(self, arguments: dict[str, Any]) -> dict[str, Any]:
        window_days = arguments["windowDays"]
        today = datetime.now(timezone.utc).date()

        return {
            "facilityId": arguments["facilityId"],
            "medicineId": arguments["medicineId"],
            "windowDays": window_days,
            "entries": [
                {
                    "consumptionDate": (today - timedelta(days=offset)).isoformat(),
                    "quantityUsed": self.average_daily_consumption,
                }
                for offset in range(window_days, 0, -1)
            ],
        }

    def _daily_average(self, arguments: dict[str, Any]) -> dict[str, Any]:
        return {
            "facilityId": arguments["facilityId"],
            "medicineId": arguments["medicineId"],
            "windowDays": arguments["windowDays"],
            "averageDailyConsumption": self.average_daily_consumption,
        }

    def _forecast(self, arguments: dict[str, Any]) -> dict[str, Any]:
        horizon = arguments["horizonDays"]

        return {
            "forecastId": "f1000000-0000-0000-0000-000000000001",
            "facilityId": arguments["facilityId"],
            "medicineId": arguments["medicineId"],
            "method": arguments["method"],
            "windowDays": arguments["windowDays"],
            "horizonDays": horizon,
            "averageDailyConsumption": self.average_daily_consumption,
            "predictedDemand": self.average_daily_consumption * horizon,
            "confidenceScore": 1.0,
            "leadTimeDays": self.lead_time_days,
        }

    def _projected_stockout(self, arguments: dict[str, Any]) -> dict[str, Any]:
        current_stock = arguments["currentStock"]
        average = arguments.get("averageDailyConsumption") or self.average_daily_consumption
        lead_time = arguments.get("leadTimeDays")
        lead_time = self.lead_time_days if lead_time is None else lead_time

        if average <= 0:
            days_remaining: int | None = None
            stockout_date: str | None = None
            requires_transfer = False
        else:
            days_remaining = int(math.floor(current_stock / average))
            stockout_date = (
                datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                + timedelta(days=days_remaining)
            ).isoformat()
            requires_transfer = days_remaining < lead_time

        return {
            "facilityId": arguments["facilityId"],
            "medicineId": arguments["medicineId"],
            "currentStock": current_stock,
            "averageDailyConsumption": average,
            "daysRemaining": days_remaining,
            "projectedStockoutDate": stockout_date,
            "leadTimeDays": lead_time,
            "riskLevel": "HIGH" if requires_transfer else "MEDIUM",
            "requiresTransfer": requires_transfer,
        }

    def _shortage_threshold(self, arguments: dict[str, Any]) -> dict[str, Any]:
        return {
            "facilityId": arguments["facilityId"],
            "medicineId": arguments["medicineId"],
            "minimumStock": self.minimum_stock,
            "reorderPoint": self.minimum_stock * 2,
            "safetyStock": self.minimum_stock * 0.4,
            "leadTimeDays": self.lead_time_days,
        }


def _snake(operation: str) -> str:
    return "".join(f"_{c.lower()}" if c.isupper() else c for c in operation)


def build_client(handler: Callable[[httpx.Request], httpx.Response]) -> DemandToolClient:
    """A tool client wired to the given mock transport."""
    transport = httpx.MockTransport(handler)

    return DemandToolClient(
        base_url=BASE_URL,
        service_token="test-service-token",
        client=httpx.Client(transport=transport),
    )


@pytest.fixture
def backend() -> FakeBackend:
    """A healthy backend reproducing the blueprint's worked example."""
    return FakeBackend()


@pytest.fixture
def tools(backend: FakeBackend) -> DemandToolClient:
    return build_client(backend.handler)


@pytest.fixture
def agent(tools: DemandToolClient) -> DemandShortageAgent:
    return DemandShortageAgent(tools)
