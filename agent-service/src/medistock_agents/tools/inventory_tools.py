"""Controlled adapter for the MediStock ASP.NET Core API.

The agent never connects to the database. Every read and every mutation goes
through the authoritative backend, so the backend stays the single place where
authorisation and business rules are enforced.

Errors are classified rather than passed through raw: a caller must be able to
tell "you are not allowed" from "there is no data" from "the service is down"
without ever seeing a stack trace or protected data.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class BackendUnavailableError(RuntimeError):
    """The controlled MediStock API could not be reached at all."""

    def __init__(self, message: str | None = None) -> None:
        super().__init__(
            message
            or "The MediStock backend could not be reached. "
            "Confirm the ASP.NET API is running and that MEDISTOCK_API_BASE_URL points at it."
        )


class BackendAccessDeniedError(RuntimeError):
    """The backend refused the call because the caller's role is not permitted."""


class BackendDataNotFoundError(RuntimeError):
    """The backend answered but holds no matching record."""

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or "No matching record was found in MediStock.")


class InventoryBackend:
    """Controlled API adapter; the agent never connects to the database."""

    #: Default .NET API address. Must agree with MEDISTOCK_API_BASE_URL.
    DEFAULT_BASE_URL = "http://localhost:5050"

    #: The demo account used only when no user token is supplied at all. Requests
    #: that carry a user token always run under that user's own permissions.
    FALLBACK_LOGIN_EMAIL = "admin@medistock.com"

    def __init__(self, base_url: str | None = None, token: str | None = None) -> None:
        self.base_url = (base_url or os.getenv("MEDISTOCK_API_BASE_URL", self.DEFAULT_BASE_URL)).rstrip("/")
        self.token = token or os.getenv("MEDISTOCK_JWT_TOKEN")
        self.timeout = httpx.Timeout(10.0)
        self._login_client = httpx.Client(timeout=5.0)

    # -- authentication ---------------------------------------------------

    def _headers(self) -> dict[str, str]:
        """Bearer header for the outgoing call, authenticating lazily if needed."""
        token = self.token or os.getenv("MEDISTOCK_JWT_TOKEN")

        if not token:
            token = self._authenticate()

        headers: dict[str, str] = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _authenticate(self) -> str | None:
        """Obtain a backend token so tool calls are attributable to a principal.

        Never raises: an unreachable backend is reported by the tool call itself,
        which produces the contextual "service unavailable" message.
        """
        password = os.getenv("MEDISTOCK_AGENT_LOGIN_PASSWORD", "Password123!")
        try:
            response = self._login_client.post(
                f"{self.base_url}/api/auth/login",
                json={"email": self.FALLBACK_LOGIN_EMAIL, "password": password},
            )
            if response.status_code == 200:
                self.token = response.json().get("accessToken")
                return self.token
            logger.warning(
                "Inventory backend login was refused with HTTP %s.", response.status_code
            )
        except Exception as error:  # noqa: BLE001 - surfaced as a contextual error later
            logger.warning("Inventory backend login failed: %s", error)
        return None

    # -- error mapping ----------------------------------------------------

    def _raise_for(self, error: Exception, operation: str) -> None:
        """Translate a transport failure into a contextual error."""
        raise BackendUnavailableError(
            "MediStock backend is unavailable: it could not be reached, so "
            f"{operation} could not be retrieved. Confirm the ASP.NET API is running "
            "and that MEDISTOCK_API_BASE_URL points at it."
        ) from error

    @staticmethod
    def _map_status(response: httpx.Response, operation: str) -> None:
        """Map a backend status code onto a distinct, non-leaking error."""
        if response.is_success:
            return

        if response.status_code in (401, 403):
            raise BackendAccessDeniedError(
                "Access denied: your role is not permitted to read "
                f"{operation}. Ask an administrator for the required access."
            )
        if response.status_code == 404:
            raise BackendDataNotFoundError(f"No {operation} were found in MediStock.")
        if response.status_code in (400, 422):
            raise ValueError(
                f"The request for {operation} was rejected as invalid. Check the supplied parameters."
            )
        raise BackendUnavailableError(
            f"The MediStock backend could not serve {operation} (HTTP {response.status_code}). "
            "Please try again shortly."
        )

    @staticmethod
    def _data(response: httpx.Response) -> list[dict[str, Any]] | dict[str, Any] | None:
        """Unwrap the API's { data: ... } envelope."""
        try:
            payload = response.json()
        except ValueError:
            return None
        if isinstance(payload, dict):
            return payload.get("data", payload)
        return payload

    # -- reads ------------------------------------------------------------

    async def get_inventory(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/inventory")
        except httpx.RequestError as error:
            self._raise_for(error, "inventory balances")

        self._map_status(response, "inventory balances")
        return list(self._data(response) or [])

    async def get_expiring(self, days: int = 90) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(
                    f"{self.base_url}/api/inventory/expiring", params={"days": days}
                )
        except httpx.RequestError as error:
            self._raise_for(error, "expiring batches")

        self._map_status(response, "expiring batches")
        return list(self._data(response) or [])

    async def get_medicines(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/medicines")
        except httpx.RequestError as error:
            self._raise_for(error, "the medicine catalogue")

        self._map_status(response, "the medicine catalogue")
        return list(self._data(response) or [])

    async def get_facilities(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/facilities")
        except httpx.RequestError as error:
            self._raise_for(error, "the facility list")

        self._map_status(response, "the facility list")
        return list(self._data(response) or [])

    async def get_batches(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/medicine-batches")
        except httpx.RequestError as error:
            self._raise_for(error, "medicine batches")

        self._map_status(response, "medicine batches")
        return list(self._data(response) or [])

    async def get_batch(self, batch_number: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(
                    f"{self.base_url}/api/medicine-batches/lookup",
                    params={"batchNumber": batch_number},
                )
        except httpx.RequestError as error:
            self._raise_for(error, f"batch {batch_number}")

        if response.status_code == 404:
            return None
        self._map_status(response, f"batch {batch_number}")
        data = self._data(response)
        return data if isinstance(data, dict) else None

    async def get_transactions(self, medicine_id: str, facility_id: str) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(
                    f"{self.base_url}/api/inventory/transactions",
                    params={"medicineId": medicine_id, "facilityId": facility_id},
                )
        except httpx.RequestError as error:
            self._raise_for(error, "stock transactions")

        self._map_status(response, "stock transactions")
        return list(self._data(response) or [])

    # -- controlled mutations --------------------------------------------

    #: The only stock mutations this agent is ever allowed to perform.
    MUTATION_PATHS = {
        "receive": "/api/inventory/receive",
        "adjust": "/api/inventory/adjust",
        "reserve": "/api/inventory/reserve",
    }

    async def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Run an approved, allow-listed stock mutation through the backend."""
        path = self.MUTATION_PATHS.get(action)
        if path is None:
            raise ValueError("Only controlled inventory mutations are executable")

        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.post(f"{self.base_url}{path}", json=payload)
        except httpx.RequestError as error:
            self._raise_for(error, f"the {action} operation")

        self._map_status(response, f"the {action} operation")
        data = self._data(response)
        return dict(data) if isinstance(data, dict) else {}

