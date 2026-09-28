"""Validation tools — thin adapter over the backend's policy-validation
endpoints for use by the procurement agent.

These are separated from procurement_tools.py because they map to the
`/api/validation/*` controller, which is a distinct domain boundary from
the `/api/purchase-orders` and `/api/suppliers` controllers.

All calls go through the controlled MediStock ASP.NET API.
"""

from __future__ import annotations

from typing import Any

from medistock_agents.tools.procurement_tools import ProcurementBackend, BackendUnavailableError  # noqa: F401


async def get_policy_rules(backend: ProcurementBackend) -> dict[str, Any]:
    """Aggregate all deterministic policy rules from the backend."""
    auth_rules = await backend.get_authorization_rules()
    storage_rules = await backend.get_storage_rules()
    return {
        "authorizationRules": auth_rules,
        "storageRules": storage_rules,
    }


async def validate_procurement_payload(
    backend: ProcurementBackend,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Validate a draft procurement payload against the backend's policy engine."""
    return await backend.validate_procurement(payload)
