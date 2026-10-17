"""Regression tests for agent RBAC and contextual error reporting.

Covers requirement 1: authorisation must be enforced BEFORE any retrieval, agent
delegation or tool execution, and a failure must be reported with a role-appropriate
explanation that never leaks a stack trace or protected data.
"""

from __future__ import annotations

from medistock_agents.api import routes
from medistock_agents.config import get_settings
from medistock_agents.main import app
from medistock_agents.safety.rbac import (
    COORDINATOR_ALLOWED_ROLES,
    INVENTORY_ALLOWED_ROLES,
    AccessDenied,
    normalise_roles,
    require_role,
    roles_from_bearer,
)

from test_inventory_agent import INTERNAL_TOKEN, FakeBackend, _agent_headers, _make_user_token

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Role claim parsing
# ---------------------------------------------------------------------------

def test_roles_are_read_from_the_long_form_claim():
    assert "storeofficer" in normalise_roles(roles_from_bearer(_make_user_token("StoreOfficer")))


def test_role_normalisation_is_separator_insensitive():
    assert normalise_roles(["Store Officer", "FACILITY-MANAGER"]) == {
        "storeofficer",
        "facilitymanager",
    }


def test_an_unreadable_token_yields_no_roles():
    assert roles_from_bearer("not-a-jwt") == []


# ---------------------------------------------------------------------------
# require_role
# ---------------------------------------------------------------------------

def test_a_missing_token_is_401_not_403():
    try:
        require_role(None, INVENTORY_ALLOWED_ROLES, "the Inventory Intelligence Agent")
    except AccessDenied as error:
        assert error.status == 401
    else:  # pragma: no cover
        raise AssertionError("expected AccessDenied")


def test_a_permitted_role_passes():
    require_role(_make_user_token("Administrator"), INVENTORY_ALLOWED_ROLES, "the agent")


def test_a_disallowed_role_is_refused_with_a_role_appropriate_message():
    try:
        require_role(_make_user_token("SupplierOfficer"), INVENTORY_ALLOWED_ROLES, "the agent")
    except AccessDenied as error:
        assert error.status == 403
        assert "your role does not permit" in error.message
    else:  # pragma: no cover
        raise AssertionError("expected AccessDenied")


def test_a_supplier_officer_may_use_the_coordinator_but_not_inventory():
    token = _make_user_token("SupplierOfficer")
    require_role(token, COORDINATOR_ALLOWED_ROLES, "the Coordinator")

    try:
        require_role(token, INVENTORY_ALLOWED_ROLES, "the agent")
    except AccessDenied:
        pass
    else:  # pragma: no cover
        raise AssertionError("expected AccessDenied")


# ---------------------------------------------------------------------------
# HTTP layer: RBAC runs before any tool executes
# ---------------------------------------------------------------------------

def _post_agent(question: str, headers: dict[str, str] | None):
    return TestClient(app).post(
        "/api/inventory-agent/run",
        json={"action_type": "ask", "payload": {"question": question}, "approved": False},
        headers=headers,
    )


def test_no_user_token_is_rejected_401_and_no_tool_runs(monkeypatch):
    """A valid internal call with no user principal is 401, and nothing is executed."""
    backend = FakeBackend(include_demo_balances=True)
    monkeypatch.setattr(routes, "InventoryBackend", lambda: backend)

    # Present the internal service token (as the ASP.NET proxy does) but no user
    # token, so the failure is attributable to the missing principal, not to the
    # internal-token guard that runs first.
    headers = {"X-Internal-Token": INTERNAL_TOKEN} if INTERNAL_TOKEN else {}
    response = _post_agent("Give me today's inventory summary", headers)

    assert response.status_code == 401
    assert backend.transaction_scopes == []
    assert backend.execute_calls == []


def test_a_disallowed_role_is_rejected_403_and_no_tool_runs(monkeypatch):
    backend = FakeBackend(include_demo_balances=True)
    monkeypatch.setattr(routes, "InventoryBackend", lambda: backend)

    response = _post_agent(
        "Give me today's inventory summary",
        _agent_headers(role="SupplierOfficer"),
    )

    assert response.status_code == 403
    assert "your role does not permit" in response.json()["detail"]
    assert backend.transaction_scopes == []
    assert backend.execute_calls == []


def test_an_allowed_role_succeeds_and_actually_retrieves(monkeypatch):
    backend = FakeBackend(include_demo_balances=True)
    monkeypatch.setattr(routes, "InventoryBackend", lambda: backend)

    response = _post_agent(
        "Show me the transaction history for VITC-DEMO at Central Facility.",
        _agent_headers(role="StoreOfficer"),
    )

    assert response.status_code == 200
    assert response.json()["answer"]
    # Real retrieval happened, not a simulated success.
    assert backend.transaction_scopes == [("vitc", "f")]


def test_a_bad_internal_token_is_refused(monkeypatch):
    backend = FakeBackend()
    monkeypatch.setattr(routes, "InventoryBackend", lambda: backend)

    if not INTERNAL_TOKEN:
        return  # guard disabled in this environment; nothing to assert

    response = _post_agent(
        "Give me today's inventory summary",
        {"X-Internal-Token": "wrong-token", "X-User-Token": _make_user_token("StoreOfficer")},
    )

    assert response.status_code == 403
    assert backend.execute_calls == []


def test_camel_case_request_bodies_bind_correctly(monkeypatch):
    """The ASP.NET proxy forwards the browser's camelCase body verbatim."""
    backend = FakeBackend(include_demo_balances=True)
    monkeypatch.setattr(routes, "InventoryBackend", lambda: backend)

    response = TestClient(app).post(
        "/api/inventory-agent/run",
        json={"actionType": "ask", "payload": {"question": "Give me today's inventory summary"}},
        headers=_agent_headers(),
    )

    assert response.status_code == 200
    assert response.json()["answer"]


def test_configured_token_is_available_for_the_guard():
    # Guards the premise of the suite: .env configures a service token.
    assert isinstance(INTERNAL_TOKEN, str)


def test_coordinator_chat_refuses_invalid_internal_token(monkeypatch):
    """Coordinator HTTP route must refuse calls with invalid internal token."""
    from medistock_agents.config import Settings
    import medistock_agents.api.coordinator_routes as coord_routes
    dummy_settings = Settings(internal_service_token="secret-token-123")
    monkeypatch.setattr(routes, "get_settings", lambda: dummy_settings)
    monkeypatch.setattr(coord_routes, "get_settings", lambda: dummy_settings)

    client = TestClient(app)
    response = client.post(
        "/api/coordinator/chat",
        json={"message": "What is the stock?"},
        headers={
            "X-Internal-Token": "wrong-token",
            "Authorization": f"Bearer {_make_user_token('Administrator')}",
        },
    )
    assert response.status_code == 403
    assert "invalid internal token" in response.json()["detail"].lower()


def test_coordinator_chat_requires_internal_token():
    """Coordinator HTTP route must refuse calls when internal token is missing."""
    client = TestClient(app)
    response = client.post(
        "/api/coordinator/chat",
        json={"message": "What is the stock?"},
        headers={},
    )
    if INTERNAL_TOKEN:
        assert response.status_code == 403
        assert "invalid internal token" in response.json()["detail"].lower()


def test_coordinator_chat_requires_authenticated_role():
    """Coordinator HTTP route must refuse calls with valid internal token but without user token."""
    client = TestClient(app)
    headers = {"X-Internal-Token": INTERNAL_TOKEN} if INTERNAL_TOKEN else {}
    response = client.post(
        "/api/coordinator/chat",
        json={"message": "What is the stock?"},
        headers=headers,
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Cryptographic JWT & adversarial tests
# ---------------------------------------------------------------------------

def test_alg_none_token_is_strictly_rejected():
    """Unsigned tokens (alg: none) must be rejected with 401."""
    import base64
    import json
    from medistock_agents.safety.rbac import AccessDenied, require_role, INVENTORY_ALLOWED_ROLES

    h = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).rstrip(b"=").decode()
    p = base64.urlsafe_b64encode(json.dumps({"role": "Administrator"}).encode()).rstrip(b"=").decode()
    token = f"{h}.{p}."

    with pytest.raises(AccessDenied) as exc_info:
        require_role(token, INVENTORY_ALLOWED_ROLES, "the agent")
    assert exc_info.value.status == 401
    assert "algorithm" in exc_info.value.message.lower()


def test_tampered_signature_is_rejected():
    """Tokens with altered payloads or invalid HMAC signatures must be rejected with 401."""
    from medistock_agents.safety.rbac import AccessDenied, create_signed_jwt, require_role, INVENTORY_ALLOWED_ROLES

    valid_token = create_signed_jwt({"role": "StoreOfficer"})
    parts = valid_token.split(".")
    # Tamper with the signature bytes
    tampered_token = f"{parts[0]}.{parts[1]}.badsignature12345"

    with pytest.raises(AccessDenied) as exc_info:
        require_role(tampered_token, INVENTORY_ALLOWED_ROLES, "the agent")
    assert exc_info.value.status == 401
    assert "invalid token signature" in exc_info.value.message.lower()


def test_expired_token_is_rejected():
    """Tokens past their expiration time must be rejected with 401."""
    import time
    from medistock_agents.safety.rbac import AccessDenied, create_signed_jwt, require_role, INVENTORY_ALLOWED_ROLES

    expired_token = create_signed_jwt({
        "role": "Administrator",
        "exp": time.time() - 3600,  # 1 hour in the past
    })

    with pytest.raises(AccessDenied) as exc_info:
        require_role(expired_token, INVENTORY_ALLOWED_ROLES, "the agent")
    assert exc_info.value.status == 401
    assert "expired" in exc_info.value.message.lower()


def test_invalid_issuer_is_rejected():
    """Tokens with untrusted issuer must be rejected with 401."""
    from medistock_agents.safety.rbac import AccessDenied, create_signed_jwt, require_role, INVENTORY_ALLOWED_ROLES

    untrusted_token = create_signed_jwt({
        "role": "Administrator",
        "iss": "MaliciousIssuer.Org",
    })

    with pytest.raises(AccessDenied) as exc_info:
        require_role(untrusted_token, INVENTORY_ALLOWED_ROLES, "the agent")
    assert exc_info.value.status == 401
    assert "issuer" in exc_info.value.message.lower()


def test_valid_signed_token_succeeds_and_extracts_role():
    """Validly signed JWT passes signature check and grants role capability."""
    from medistock_agents.safety.rbac import create_signed_jwt, require_role, INVENTORY_ALLOWED_ROLES

    token = create_signed_jwt({
        "sub": "user-123",
        "role": "StoreOfficer",
    })

    claims = require_role(token, INVENTORY_ALLOWED_ROLES, "the agent")
    assert claims["sub"] == "user-123"
    assert claims["role"] == "StoreOfficer"



