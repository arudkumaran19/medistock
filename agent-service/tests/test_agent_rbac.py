"""RBAC unit tests for the agent-service routes.

These tests verify that:
- An unauthenticated request is rejected with 401.
- A SupplierOfficer (not in INVENTORY_ALLOWED_ROLES) is refused with 403.
- A StoreOfficer passes the role check.
- A FacilityManager passes both inventory and procurement role checks.
- An Administrator passes all role checks.
- Internal-token mismatch returns 403 before role checking.
- BackendUnavailableError is surfaced as HTTP 503 (not 500 or a fake answer).
"""
from __future__ import annotations

import base64
import json

import pytest
from fastapi.testclient import TestClient

from medistock_agents.api import routes
from medistock_agents.config import get_settings
from medistock_agents.main import app
from medistock_agents.tools.inventory_tools import (
    BackendAccessDeniedError,
    BackendDataNotFoundError,
    BackendUnavailableError,
)

from medistock_agents.safety.rbac import create_signed_jwt

INTERNAL_TOKEN = get_settings().internal_service_token


def _jwt(role: str) -> str:
    """Signed JWT carrying a verified role claim."""
    return create_signed_jwt({
        "sub": "test-user",
        "role": role,
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
    })


def _headers(role: str | None = "StoreOfficer", internal: bool = True) -> dict[str, str]:
    h: dict[str, str] = {}
    if internal and INTERNAL_TOKEN:
        h["X-Internal-Token"] = INTERNAL_TOKEN
    if role is not None:
        h["X-User-Token"] = _jwt(role)
    return h


# ---------------------------------------------------------------------------
# Shared fixtures / fakes
# ---------------------------------------------------------------------------

class _EmptyBackend:
    """Minimal fake that always returns empty data (no network required)."""
    async def get_inventory(self): return []
    async def get_expiring(self, days=90): return []
    async def get_medicines(self): return []
    async def get_facilities(self): return []
    async def get_batches(self): return []
    async def get_batch(self, batch_number): return None
    async def get_transactions(self, medicine_id, facility_id): return []
    async def execute(self, action, payload): return {}


class _UnavailableBackend(_EmptyBackend):
    async def get_inventory(self): raise BackendUnavailableError()
    async def get_expiring(self, days=90): raise BackendUnavailableError()


class _DeniedBackend(_EmptyBackend):
    async def get_inventory(self): raise BackendAccessDeniedError("Access denied")


class _NotFoundBackend(_EmptyBackend):
    async def get_inventory(self): raise BackendDataNotFoundError()


def _post(client: TestClient, *, role: str | None, internal: bool = True, **kwargs) -> ...:
    return client.post(
        "/api/inventory-agent/run",
        json={"action_type": "analyze", "payload": {}, "approved": False, **kwargs},
        headers=_headers(role=role, internal=internal),
    )


# ---------------------------------------------------------------------------
# Authentication & RBAC
# ---------------------------------------------------------------------------

class TestInventoryAgentRbac:

    def test_unauthenticated_returns_401(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _EmptyBackend)
        r = _post(TestClient(app), role=None)
        assert r.status_code == 401

    def test_supplier_officer_is_refused_with_403(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _EmptyBackend)
        r = _post(TestClient(app), role="SupplierOfficer")
        assert r.status_code == 403

    def test_store_officer_is_allowed(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _EmptyBackend)
        r = _post(TestClient(app), role="StoreOfficer")
        assert r.status_code == 200

    def test_facility_manager_is_allowed(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _EmptyBackend)
        r = _post(TestClient(app), role="FacilityManager")
        assert r.status_code == 200

    def test_administrator_is_allowed(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _EmptyBackend)
        r = _post(TestClient(app), role="Administrator")
        assert r.status_code == 200

    def test_invalid_internal_token_returns_403_regardless_of_role(self):
        r = TestClient(app).post(
            "/api/inventory-agent/run",
            json={"action_type": "analyze", "payload": {}, "approved": False},
            headers={"X-Internal-Token": "wrong-token", "X-User-Token": _jwt("Administrator")},
        )
        # Only fails when INTERNAL_TOKEN is actually set; skip otherwise.
        if not INTERNAL_TOKEN:
            pytest.skip("No AGENT_SERVICE_TOKEN configured; token validation inactive")
        assert r.status_code == 403

    def test_error_message_never_exposes_stack_trace(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _EmptyBackend)
        r = _post(TestClient(app), role="SupplierOfficer")
        assert "System." not in r.text
        assert " at " not in r.text
        assert "StackTrace" not in r.text


# ---------------------------------------------------------------------------
# Backend error classification
# ---------------------------------------------------------------------------

class TestInventoryAgentBackendErrors:

    def test_backend_unavailable_returns_503(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _UnavailableBackend)
        r = _post(TestClient(app), role="StoreOfficer")
        assert r.status_code == 503

    def test_backend_access_denied_returns_403(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _DeniedBackend)
        r = _post(TestClient(app), role="StoreOfficer")
        assert r.status_code == 403

    def test_backend_not_found_returns_200_with_empty_answer(self, monkeypatch):
        """NotFound is a valid outcome, not a failure; 200 with explanation."""
        monkeypatch.setattr(routes, "InventoryBackend", _NotFoundBackend)
        r = _post(TestClient(app), role="StoreOfficer")
        assert r.status_code == 200
        body = r.json()
        assert body["executed"] is False
        assert body["approval_required"] is False

    def test_unavailable_error_message_is_actionable(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _UnavailableBackend)
        r = _post(TestClient(app), role="StoreOfficer")
        detail = r.json().get("detail", "")
        assert "MediStock backend" in detail or "unavailable" in detail.lower()

    def test_503_message_never_exposes_internal_detail(self, monkeypatch):
        monkeypatch.setattr(routes, "InventoryBackend", _UnavailableBackend)
        r = _post(TestClient(app), role="StoreOfficer")
        assert "System." not in r.text
        assert "StackTrace" not in r.text


# ---------------------------------------------------------------------------
# Procurement agent RBAC
# ---------------------------------------------------------------------------

class TestProcurementAgentRbac:

    def _post_procurement(self, client: TestClient, role: str | None) -> ...:
        h = {"Authorization": f"Bearer {_jwt(role)}"} if role else {}
        return client.post(
            "/api/procurement-agent/run",
            json={"action_type": "validate", "payload": {}, "approved": False},
            headers=h,
        )

    def test_unauthenticated_returns_401(self, monkeypatch):
        monkeypatch.setattr(routes, "ProcurementBackend", lambda: _EmptyBackend())
        r = self._post_procurement(TestClient(app), role=None)
        assert r.status_code == 401

    def test_store_officer_is_refused_with_403(self, monkeypatch):
        monkeypatch.setattr(routes, "ProcurementBackend", lambda: _EmptyBackend())
        r = self._post_procurement(TestClient(app), role="StoreOfficer")
        assert r.status_code == 403

    def test_facility_manager_is_allowed(self, monkeypatch):
        monkeypatch.setattr(routes, "ProcurementBackend", lambda: _EmptyBackend())
        r = self._post_procurement(TestClient(app), role="FacilityManager")
        # We only care about RBAC passing; agent logic may still error with empty data.
        assert r.status_code in (200, 422, 500)

    def test_supplier_officer_is_allowed(self, monkeypatch):
        monkeypatch.setattr(routes, "ProcurementBackend", lambda: _EmptyBackend())
        r = self._post_procurement(TestClient(app), role="SupplierOfficer")
        assert r.status_code in (200, 422, 500)

    def test_administrator_is_allowed(self, monkeypatch):
        monkeypatch.setattr(routes, "ProcurementBackend", lambda: _EmptyBackend())
        r = self._post_procurement(TestClient(app), role="Administrator")
        assert r.status_code in (200, 422, 500)
