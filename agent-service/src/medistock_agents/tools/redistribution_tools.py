"""Controlled tools for the Redistribution Planning Agent.

Redistribution vertical (Member 3).

The redistribution design's tools opened a database connection directly. Blueprint
section 38 does not allow that: no tool touches PostgreSQL. Each tool here posts to the
ASP.NET Core endpoint /internal/tools/redistribution, which applies the authoritative
rules and returns a structured result. The names are kept from the design:

    getTransferRequest, getCandidateFacilities, getFacilityLocation,
    getFacilityInventory, calculateDistance            (backend)
    calculateTransferQuantity                           (local arithmetic)

Every call is checked against the agent's allow-list first, retried at most twice
(blueprint section 22), and returns a FAILURE result rather than inventing a value.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from medistock_agents.models.tool_models import ToolResult
from medistock_agents.safety.tool_guard import ToolGuard

logger = logging.getLogger(__name__)

MAX_RETRIES_PER_TOOL = 2
DEFAULT_TIMEOUT_SECONDS = 10.0
REDISTRIBUTION_ENDPOINT = "/internal/tools/redistribution"
SERVICE_TOKEN_HEADER = "X-Internal-Token"


class RedistributionToolClient:
    """Calls the backend's redistribution tools on behalf of the agent."""

    agent_name = "redistribution_planning"

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

    # ----- backend tools ----------------------------------------------------

    def get_transfer_request(self, transfer_id: str) -> ToolResult:
        return self._call("getTransferRequest", {"transferId": transfer_id})

    def get_candidate_facilities(self, transfer_id: str) -> ToolResult:
        return self._call("getCandidateFacilities", {"transferId": transfer_id})

    def get_facility_location(self, facility_id: str) -> ToolResult:
        return self._call("getFacilityLocation", {"facilityId": facility_id})

    def get_facility_inventory(self, facility_id: str, medicine_id: str) -> ToolResult:
        return self._call("getFacilityInventory", {"facilityId": facility_id, "medicineId": medicine_id})

    def calculate_distance(self, source_facility_id: str, destination_facility_id: str) -> ToolResult:
        return self._call(
            "calculateDistance",
            {"sourceFacilityId": source_facility_id, "destinationFacilityId": destination_facility_id},
        )

    # ----- local tool ---------------------------------------------------------

    def calculate_transfer_quantity(self, requested: int, available_surplus: int) -> ToolResult:
        """How much a source can send: the request, capped by what it can spare."""
        self._guard.enforce("calculateTransferQuantity")
        quantity = max(0, min(int(requested), int(available_surplus)))
        return ToolResult(
            tool="calculateTransferQuantity",
            status="SUCCESS",
            data={
                "requested": int(requested),
                "availableSurplus": int(available_surplus),
                "transferQuantity": quantity,
                "coversRequest": quantity >= int(requested),
            },
        )

    # ----- transport ----------------------------------------------------------

    def _call(self, tool: str, arguments: dict[str, Any]) -> ToolResult:
        self._guard.enforce(tool)

        headers = {"Content-Type": "application/json"}
        if self._service_token:
            headers[SERVICE_TOKEN_HEADER] = self._service_token

        payload = {"operation": tool, "arguments": arguments}
        last_error: str | None = None

        for attempt in range(MAX_RETRIES_PER_TOOL + 1):
            try:
                response = self._post(payload, headers)

                if response.status_code >= 500:
                    last_error = f"Backend returned {response.status_code}."
                    continue

                if response.status_code >= 400:
                    return ToolResult(
                        tool=tool,
                        status="FAILURE",
                        error_code="TOOL_REQUEST_REJECTED",
                        error_message=f"Backend returned {response.status_code}.",
                    )

                body = response.json()
                data = body.get("data", body) if isinstance(body, dict) else body
                # ToolResult.data is a dict; candidate lists are wrapped.
                if isinstance(data, list):
                    data = {"items": data}
                return ToolResult(tool=tool, status="SUCCESS", data=data)

            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                logger.warning("Tool %s attempt %s failed: %s", tool, attempt + 1, last_error)
            except ValueError as exc:
                return ToolResult(tool=tool, status="FAILURE", error_code="TOOL_INVALID_RESPONSE", error_message=str(exc))

        return ToolResult(
            tool=tool,
            status="FAILURE",
            error_code="TOOL_UNAVAILABLE",
            error_message=last_error or "The tool endpoint was unreachable.",
        )

    def _post(self, payload: dict[str, Any], headers: dict[str, str]) -> httpx.Response:
        url = f"{self._base_url}{REDISTRIBUTION_ENDPOINT}"
        if self._client is not None:
            return self._client.post(url, json=payload, headers=headers, timeout=self._timeout)
        with httpx.Client(timeout=self._timeout) as client:
            return client.post(url, json=payload, headers=headers)
