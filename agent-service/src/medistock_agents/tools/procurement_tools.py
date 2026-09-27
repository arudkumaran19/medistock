"""Controlled API adapters for the Procurement & Policy Validation Agent.

All state mutations go through the MediStock ASP.NET backend; the agent
never touches the database directly.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

# Re-export so consumers can import from a single location.
from medistock_agents.tools.inventory_tools import BackendUnavailableError  # noqa: F401


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _base_url() -> str:
    return os.getenv("MEDISTOCK_API_BASE_URL", "http://localhost:5182").rstrip("/")


def _timeout() -> httpx.Timeout:
    return httpx.Timeout(10.0)


# ---------------------------------------------------------------------------
# ProcurementBackend
# ---------------------------------------------------------------------------

class ProcurementBackend:
    """Controlled API adapter for procurement; the agent never connects to the database."""

    def __init__(self, base_url: str | None = None, token: str | None = None) -> None:
        self.base_url = (base_url or _base_url())
        self.token = token or os.getenv("MEDISTOCK_JWT_TOKEN")
        self.timeout = _timeout()

    def _headers(self) -> dict[str, str]:
        token = self.token or os.getenv("MEDISTOCK_JWT_TOKEN")
        if not token:
            try:
                with httpx.Client(timeout=3.0) as client:
                    resp = client.post(
                        f"{self.base_url}/api/auth/login",
                        json={"email": "admin@medistock.com", "password": "Password123!"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        self.token = data.get("accessToken")
                        token = self.token
            except Exception:
                pass

        headers: dict[str, str] = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    # ------------------------------------------------------------------
    # READ – Purchase Orders
    # ------------------------------------------------------------------

    async def get_purchase_orders(
        self,
        status: str | None = None,
        supplier_id: str | None = None,
        facility_id: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if status:
            params["status"] = status
        if supplier_id:
            params["supplierId"] = supplier_id
        if facility_id:
            params["facilityId"] = facility_id
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/purchase-orders", params=params)
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def get_purchase_order(self, po_id: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/purchase-orders/{po_id}")
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def get_pending_approvals(self) -> list[dict[str, Any]]:
        """Return all POs currently awaiting approval."""
        return await self.get_purchase_orders(status="PendingApproval")

    # ------------------------------------------------------------------
    # READ – Suppliers
    # ------------------------------------------------------------------

    async def get_suppliers(
        self,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if search:
            params["search"] = search
        if is_active is not None:
            params["isActive"] = str(is_active).lower()
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/suppliers", params=params)
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def get_supplier(self, supplier_id: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/suppliers/{supplier_id}")
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    # ------------------------------------------------------------------
    # READ – Inventory & Medicines (for replenishment and stock checks)
    # ------------------------------------------------------------------

    async def get_inventory(
        self,
        facility_id: str | None = None,
        medicine_id: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if facility_id:
            params["facilityId"] = facility_id
        if medicine_id:
            params["medicineId"] = medicine_id
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/inventory", params=params)
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def get_medicines(self, search: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if search:
            params["search"] = search
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/medicines", params=params)
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def get_facilities(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/facilities")
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    # ------------------------------------------------------------------
    # READ – Policy / Validation
    # ------------------------------------------------------------------

    async def get_authorization_rules(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/validation/authorization-rules")
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def get_storage_rules(self) -> list[dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/validation/storage-rules")
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def validate_procurement(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Call the backend's procurement policy validation endpoint."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.post(
                    f"{self.base_url}/api/validation/procurement",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    # ------------------------------------------------------------------
    # WRITE – Approval workflow (guarded mutations)
    # ------------------------------------------------------------------

    async def approve_purchase_order(self, po_id: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.post(f"{self.base_url}/api/purchase-orders/{po_id}/approve")
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def reject_purchase_order(self, po_id: str, reason: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.post(
                    f"{self.base_url}/api/purchase-orders/{po_id}/reject",
                    json={"reason": reason},
                )
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def request_revision(self, po_id: str, reason: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.post(
                    f"{self.base_url}/api/purchase-orders/{po_id}/request-revision",
                    json={"reason": reason},
                )
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    # ------------------------------------------------------------------
    # WRITE – Deliveries & Inventory Receiving
    # ------------------------------------------------------------------

    async def get_delivery(self, po_id: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.get(f"{self.base_url}/api/deliveries/purchase-orders/{po_id}")
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def create_delivery(
        self,
        po_id: str,
        expected_at: str | None = None,
        tracking_number: str | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if expected_at:
            payload["expectedAt"] = expected_at
        if tracking_number:
            payload["trackingNumber"] = tracking_number
        if notes:
            payload["notes"] = notes
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.post(
                    f"{self.base_url}/api/deliveries/purchase-orders/{po_id}",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

    async def mark_delivered(
        self,
        delivery_id: str,
        items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Mark delivery as delivered, automatically receiving goods into inventory balances and batches."""
        payload = {"items": items}
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self._headers()) as client:
                response = await client.post(
                    f"{self.base_url}/api/deliveries/{delivery_id}/deliver",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("data", data) if isinstance(data, dict) else data
        except (httpx.RequestError, httpx.HTTPStatusError) as error:
            raise BackendUnavailableError(
                "MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL."
            ) from error

