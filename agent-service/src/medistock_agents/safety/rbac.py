"""Role authorization and cryptographic token verification for agent routes.

Enforces cryptographic HMAC-SHA256 signature verification and claim validation
(issuer, audience, expiration, not-before) using the shared JWT_SIGNING_KEY.
Unsigned tokens (alg: none), algorithm-confusion attempts, expired tokens,
and tampered role claims are rejected before any agent or tool execution.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Any

from medistock_agents.config import get_settings

logger = logging.getLogger(__name__)

#: Roles permitted to use the Inventory Intelligence Agent.
INVENTORY_ALLOWED_ROLES = frozenset(
    {
        "administrator",
        "admin",
        "facilitymanager",
        "facility_manager",
        "operationalstaff",
        "storeofficer",
        "store_officer",
        "storeoperator",
        "store_operator",
    }
)

#: Roles permitted to use the Procurement & Policy Validation agent.
PROCUREMENT_ALLOWED_ROLES = frozenset(
    {
        "administrator",
        "admin",
        "facilitymanager",
        "facility_manager",
        "supplierofficer",
        "supplier_officer",
    }
)

#: Roles permitted to use the AI Coordinator.
COORDINATOR_ALLOWED_ROLES = frozenset(
    {
        "administrator",
        "admin",
        "facilitymanager",
        "facility_manager",
        "operationalstaff",
        "storeofficer",
        "store_officer",
        "storeoperator",
        "store_operator",
        "supplierofficer",
        "supplier_officer",
    }
)


class AccessDenied(Exception):
    """The caller is unauthenticated (401), unauthorized (403), or auth is misconfigured (500)."""

    def __init__(self, message: str, status: int = 403) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def _b64_decode(data: str) -> bytes:
    """Decode base64url data with automatic padding."""
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded)


def _b64_encode(data: bytes) -> str:
    """Encode bytes as base64url string without trailing padding."""
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def create_signed_jwt(
    claims: dict[str, Any],
    signing_key: str | None = None,
    algorithm: str = "HS256",
) -> str:
    """Generate a valid cryptographically signed JWT with HS256 for testing or service authentication."""
    key = signing_key or get_settings().jwt_signing_key
    if not key:
        raise ValueError("Signing key must be provided or configured in settings.")

    header = {"alg": algorithm, "typ": "JWT"}
    header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64_encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    if algorithm == "HS256":
        sig = hmac.new(key.encode("utf-8"), signing_input, hashlib.sha256).digest()
        sig_b64 = _b64_encode(sig)
    else:
        sig_b64 = ""

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_and_verify_jwt(
    token: str,
    signing_key: str | None = None,
    expected_issuer: str | None = None,
    expected_audience: str | None = None,
) -> dict[str, Any]:
    """Cryptographically verify and decode a JWT token.

    Validates:
    1. Structure (header.payload.signature)
    2. Algorithm (must be HS256, rejects 'none' and algorithm-confusion)
    3. HMAC-SHA256 signature against signing_key
    4. Expiration ('exp') and Not-Before ('nbf') timestamps
    5. Issuer ('iss') and Audience ('aud') if configured
    """
    if not token or not token.strip():
        raise AccessDenied("Authentication token is missing.", status=401)

    parts = token.strip().split(".")
    if len(parts) != 3:
        raise AccessDenied("Malformed JWT token structure.", status=401)

    header_b64, payload_b64, sig_b64 = parts

    # 1. Parse and validate header
    try:
        header = json.loads(_b64_decode(header_b64))
    except Exception as ex:
        raise AccessDenied("Invalid JWT header encoding.", status=401) from ex

    alg = header.get("alg")
    if alg != "HS256":
        # Strictly reject 'none' and unsupported / asymmetric algorithms
        raise AccessDenied(
            f"Unsupported or insecure JWT algorithm: '{alg}'. Only HS256 is allowed.",
            status=401,
        )

    # 2. Cryptographic signature check
    key = signing_key or get_settings().jwt_signing_key
    if not key:
        # Fail closed when signing key is absent
        logger.error("JWT verification failed: JWT_SIGNING_KEY is not configured.")
        raise AccessDenied("Server authentication configuration error.", status=500)

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    expected_sig_b64 = _b64_encode(expected_sig)

    if not hmac.compare_digest(expected_sig_b64, sig_b64):
        logger.warning("Agent call rejected due to invalid cryptographic JWT signature.")
        raise AccessDenied("Invalid token signature.", status=401)

    # 3. Parse payload
    try:
        claims = json.loads(_b64_decode(payload_b64))
    except Exception as ex:
        raise AccessDenied("Invalid JWT payload encoding.", status=401) from ex

    # 4. Expiration and temporal validity checks
    now = time.time()
    if "exp" in claims and isinstance(claims["exp"], (int, float)):
        if now > claims["exp"]:
            raise AccessDenied("Token has expired. Please sign in again.", status=401)

    if "nbf" in claims and isinstance(claims["nbf"], (int, float)):
        if now < claims["nbf"]:
            raise AccessDenied("Token is not active yet.", status=401)

    # 5. Issuer check
    iss_check = expected_issuer if expected_issuer is not None else get_settings().jwt_issuer
    if iss_check and "iss" in claims:
        if claims["iss"] != iss_check:
            raise AccessDenied("Invalid token issuer.", status=401)

    # 6. Audience check
    aud_check = expected_audience if expected_audience is not None else get_settings().jwt_audience
    if aud_check and "aud" in claims:
        token_aud = claims["aud"]
        if isinstance(token_aud, str) and token_aud != aud_check:
            raise AccessDenied("Invalid token audience.", status=401)
        elif isinstance(token_aud, list) and aud_check not in token_aud:
            raise AccessDenied("Invalid token audience.", status=401)

    return claims


def roles_from_bearer(token: str) -> list[str]:
    """Cryptographically verify token and extract role claims. Returns empty list if invalid."""
    try:
        claims = decode_and_verify_jwt(token)
    except AccessDenied:
        return []

    # ASP.NET Core emits the long-form role claim URI by default.
    candidates = [
        claims.get("role"),
        claims.get("roles"),
        claims.get("http://schemas.microsoft.com/ws/2008/06/identity/claims/role"),
    ]

    roles: list[str] = []
    for candidate in candidates:
        if isinstance(candidate, str):
            roles.append(candidate)
        elif isinstance(candidate, list):
            roles.extend(role for role in candidate if isinstance(role, str))
    return roles


def normalise_roles(roles: list[str]) -> set[str]:
    """Lower-case and strip separators so 'Store Officer' matches 'storeofficer'."""
    return {role.strip().casefold().replace(" ", "").replace("-", "") for role in roles}


def require_role(
    token: str | None,
    allowed: frozenset[str],
    capability: str,
) -> dict[str, Any]:
    """Enforce that ``token`` is cryptographically valid and carries a role in ``allowed``."""
    if not token or not token.strip():
        raise AccessDenied(
            f"Authentication required: sign in to use {capability}.",
            status=401,
        )

    claims = decode_and_verify_jwt(token)
    candidates = [
        claims.get("role"),
        claims.get("roles"),
        claims.get("http://schemas.microsoft.com/ws/2008/06/identity/claims/role"),
    ]

    raw_roles: list[str] = []
    for candidate in candidates:
        if isinstance(candidate, str):
            raw_roles.append(candidate)
        elif isinstance(candidate, list):
            raw_roles.extend(role for role in candidate if isinstance(role, str))

    roles = normalise_roles(raw_roles)

    if not roles:
        raise AccessDenied(
            f"Access denied: your account has no assigned role, so {capability} is unavailable. "
            "Ask an administrator to assign one.",
            status=403,
        )

    if not roles & allowed:
        raise AccessDenied(
            f"Access denied: your role does not permit {capability}. "
            "Ask an administrator if you need this access.",
            status=403,
        )

    return claims
