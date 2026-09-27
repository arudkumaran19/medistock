"""Controlled tools for the Demand & Shortage Agent.

Sathurstiga S. (IT24103156).

The five tools the blueprint assigns to this agent::

    getConsumptionHistory
    calculateDailyConsumption
    calculateForecast
    calculateProjectedStockout
    getShortageThreshold

No tool touches PostgreSQL. Each one posts to an ASP.NET Core internal tool endpoint,
which applies authorization and the authoritative business rules and returns a
structured result (blueprint section 38). The arithmetic lives in the backend, not
here and not in the model.

Failure handling follows the blueprint risk register entry assigned to this vertical
(AI API outage: retry then safe failure). A tool retries at most twice
(MAX_RETRIES_PER_TOOL, section 22) and then returns a FAILURE result. It never
fabricates a value to keep the workflow moving.

Not specified in the final blueprint: the request body shape of the internal tool
endpoints. Section 38 freezes the endpoint paths but not their payloads. The
{"operation", "arguments"} envelope below must be confirmed with the agent-contract
owner, ILHAM MM (IT24103530), and the backend before integration.
Do not assume or introduce a new decision without team-level confirmation.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from medistock_agents.models.tool_models import (
    ConsumptionHistoryResult,
    DailyConsumptionResult,
    ForecastResult,
    ProjectedStockoutResult,
    ShortageThresholdResult,
    ToolResult,
)
from medistock_agents.safety.tool_guard import ToolGuard

logger = logging.getLogger(__name__)

# Blueprint section 22.
MAX_RETRIES_PER_TOOL = 2

DEFAULT_TIMEOUT_SECONDS = 10.0

# Blueprint section 38.
CONSUMPTION_ENDPOINT = "/internal/tools/consumption"
FORECAST_ENDPOINT = "/internal/tools/forecast"

# Must match InternalToolsController.ServiceTokenHeader in the backend.
SERVICE_TOKEN_HEADER = "X-Internal-Token"


class DemandToolClient:
    """Calls the ASP.NET Core internal tool endpoints on behalf of the agent.

    Every call is checked against the agent's allow-list first, so a tool name that
    reached the agent through injected text is refused before any request is made.
    """

    agent_name = "demand_shortage"

    def __init__(
        self,
        base_url: str,
        service_token: str | None = None,
        client: httpx.Client | None = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._service_token = service_token
        self._client = client
        self._timeout = timeout
        self._guard = ToolGuard(self.agent_name)

    # ------------------------------------------------------------------
    # The five blueprint tools
    # ------------------------------------------------------------------

    def get_consumption_history(
        self,
        facility_id: str,
        medicine_id: str,
        window_days: int = 30,
    ) -> ToolResult:
        """Historical consumption for a facility and medicine."""
        return self._call(
            tool="getConsumptionHistory",
            endpoint=CONSUMPTION_ENDPOINT,
            operation="history",
            arguments={
                "facilityId": facility_id,
                "medicineId": medicine_id,
                "windowDays": window_days,
            },
        )

    def calculate_daily_consumption(
        self,
        facility_id: str,
        medicine_id: str,
        window_days: int = 30,
    ) -> ToolResult:
        """Average daily consumption across the window."""
        return self._call(
            tool="calculateDailyConsumption",
            endpoint=CONSUMPTION_ENDPOINT,
            operation="dailyAverage",
            arguments={
                "facilityId": facility_id,
                "medicineId": medicine_id,
                "windowDays": window_days,
            },
        )

    def calculate_forecast(
        self,
        facility_id: str,
        medicine_id: str,
        window_days: int = 30,
        horizon_days: int = 30,
        method: str = "MOVING_AVERAGE",
    ) -> ToolResult:
        """Deterministic demand forecast produced by the backend."""
        return self._call(
            tool="calculateForecast",
            endpoint=FORECAST_ENDPOINT,
            operation="forecast",
            arguments={
                "facilityId": facility_id,
                "medicineId": medicine_id,
                "windowDays": window_days,
                "horizonDays": horizon_days,
                "method": method,
            },
        )

    def calculate_projected_stockout(
        self,
        facility_id: str,
        medicine_id: str,
        current_stock: float,
        average_daily_consumption: float | None = None,
        lead_time_days: int | None = None,
        window_days: int = 30,
    ) -> ToolResult:
        """Days of stock, projected stockout date and shortage risk."""
        return self._call(
            tool="calculateProjectedStockout",
            endpoint=FORECAST_ENDPOINT,
            operation="projectedStockout",
            arguments={
                "facilityId": facility_id,
                "medicineId": medicine_id,
                "currentStock": current_stock,
                "averageDailyConsumption": average_daily_consumption,
                "leadTimeDays": lead_time_days,
                "windowDays": window_days,
            },
        )

    def get_shortage_threshold(self, facility_id: str, medicine_id: str) -> ToolResult:
        """Minimum stock, reorder point, safety stock and lead time."""
        return self._call(
            tool="getShortageThreshold",
            endpoint=FORECAST_ENDPOINT,
            operation="shortageThreshold",
            arguments={
                "facilityId": facility_id,
                "medicineId": medicine_id,
            },
        )

    # ------------------------------------------------------------------
    # Transport
    # ------------------------------------------------------------------

    def _call(
        self,
        tool: str,
        endpoint: str,
        operation: str,
        arguments: dict[str, Any],
    ) -> ToolResult:
        # Allow-list first: refuse before anything leaves the service.
        self._guard.enforce(tool)

        payload = {"operation": operation, "arguments": arguments}
        headers = {"Content-Type": "application/json"}

        # A dedicated header, not Authorization: the backend must never be able to
        # mistake a user's JWT for service credentials.
        if self._service_token:
            headers[SERVICE_TOKEN_HEADER] = self._service_token

        last_error: str | None = None

        # One initial attempt plus at most MAX_RETRIES_PER_TOOL retries.
        for attempt in range(MAX_RETRIES_PER_TOOL + 1):
            try:
                response = self._request(endpoint, payload, headers)

                if response.status_code >= 500:
                    # Server-side faults are worth retrying.
                    last_error = f"Backend returned {response.status_code}."
                    continue

                if response.status_code >= 400:
                    # Client-side faults will not improve on retry.
                    return ToolResult(
                        tool=tool,
                        status="FAILURE",
                        error_code="TOOL_REQUEST_REJECTED",
                        error_message=f"Backend returned {response.status_code}.",
                    )

                body = response.json()
                data = body.get("data", body) if isinstance(body, dict) else body

                return ToolResult(tool=tool, status="SUCCESS", data=data)

            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                logger.warning(
                    "Tool %s attempt %s/%s failed: %s",
                    tool,
                    attempt + 1,
                    MAX_RETRIES_PER_TOOL + 1,
                    last_error,
                )
            except ValueError as exc:
                # Malformed JSON will not improve on retry.
                return ToolResult(
                    tool=tool,
                    status="FAILURE",
                    error_code="TOOL_INVALID_RESPONSE",
                    error_message=str(exc),
                )

        # Retries exhausted. Fail safely rather than inventing a number.
        return ToolResult(
            tool=tool,
            status="FAILURE",
            error_code="TOOL_UNAVAILABLE",
            error_message=last_error or "The tool endpoint was unreachable.",
        )

    def _request(
        self,
        endpoint: str,
        payload: dict[str, Any],
        headers: dict[str, str],
    ) -> httpx.Response:
        url = f"{self._base_url}{endpoint}"

        if self._client is not None:
            return self._client.post(url, json=payload, headers=headers, timeout=self._timeout)

        with httpx.Client(timeout=self._timeout) as client:
            return client.post(url, json=payload, headers=headers)


# ---------------------------------------------------------------------------
# Typed parsing helpers. Kept separate so a malformed backend payload surfaces as a
# validation error rather than silently becoming a wrong forecast.
# ---------------------------------------------------------------------------


def parse_consumption_history(result: ToolResult) -> ConsumptionHistoryResult:
    return ConsumptionHistoryResult.model_validate(result.data or {})


def parse_daily_consumption(result: ToolResult) -> DailyConsumptionResult:
    return DailyConsumptionResult.model_validate(result.data or {})


def parse_forecast(result: ToolResult) -> ForecastResult:
    return ForecastResult.model_validate(result.data or {})


def parse_projected_stockout(result: ToolResult) -> ProjectedStockoutResult:
    return ProjectedStockoutResult.model_validate(result.data or {})


def parse_shortage_threshold(result: ToolResult) -> ShortageThresholdResult:
    return ShortageThresholdResult.model_validate(result.data or {})
