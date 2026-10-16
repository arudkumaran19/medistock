"""MediStock Agent Service Configuration.

Loads environment-specific settings from environment variables or .env files.
Supports both Google Gemini (cloud) and Ollama (local) LLM providers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in agent-service root first, then project root
_CURRENT_DIR = Path(__file__).resolve().parent
_AGENT_SERVICE_DIR = _CURRENT_DIR.parent.parent  # agent-service/
_PROJECT_ROOT = _AGENT_SERVICE_DIR.parent

if (_AGENT_SERVICE_DIR / ".env").exists():
    load_dotenv(_AGENT_SERVICE_DIR / ".env")
elif (_PROJECT_ROOT / ".env").exists():
    load_dotenv(_PROJECT_ROOT / ".env")
else:
    load_dotenv()


def _resolve_backend_url() -> str:
    for key in ("MEDISTOCK_API_BASE_URL", "BACKEND_URL"):
        val = os.getenv(key)
        if val and "backend" in val:
            return val.rstrip("/")
    return (os.getenv("BACKEND_URL") or os.getenv("MEDISTOCK_API_BASE_URL") or "http://localhost:5050").rstrip("/")


@dataclass(frozen=True)
class Settings:
    """Runtime configuration for MediStock Agent Service."""

    environment: str = os.getenv("ENVIRONMENT", "development").lower()

    # Active LLM provider: 'gemini' | 'ollama'
    llm_provider: str = os.getenv("LLM_PROVIDER", "gemini").lower()

    # Google Gemini settings
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Ollama settings
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3")

    # ASP.NET Core Authoritative Backend API
    medistock_api_base_url: str = _resolve_backend_url()

    # Explicit backend client aliases
    BACKEND_URL: str = _resolve_backend_url()
    INTERNAL_TOKEN: str = os.getenv(
        "INTERNAL_TOKEN", os.getenv("AGENT_SERVICE_TOKEN", "medistock-internal-agent-token-2024")
    )

    # Timeouts
    agent_timeout_seconds: float = float(os.getenv("AGENT_TIMEOUT_SECONDS", "30"))
    llm_timeout_seconds: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "30"))

    @property
    def is_gemini_configured(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_api_key.strip())

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


_settings: Settings | None = None


def get_settings(reload: bool = False) -> Settings:
    """Return the active settings instance (singleton unless reload=True)."""
    global _settings
    if _settings is None or reload:
        backend_url = _resolve_backend_url()
        token = os.getenv(
            "INTERNAL_TOKEN", os.getenv("AGENT_SERVICE_TOKEN", "medistock-internal-agent-token-2024")
        )
        _settings = Settings(
            environment=os.getenv("ENVIRONMENT", "development").lower(),
            llm_provider=os.getenv("LLM_PROVIDER", "gemini").lower(),
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/"),
            ollama_model=os.getenv("OLLAMA_MODEL", "llama3"),
            medistock_api_base_url=backend_url,
            BACKEND_URL=backend_url,
            INTERNAL_TOKEN=token,
            agent_timeout_seconds=float(os.getenv("AGENT_TIMEOUT_SECONDS", "30")),
            llm_timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "30")),
        )
    return _settings


# Module-level settings instance for direct import
settings: Settings = get_settings()

