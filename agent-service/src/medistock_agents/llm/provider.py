"""LLM Provider Abstraction for MediStock Agents.

Provides a unified interface supporting both:
1. Google Gemini API (Cloud, free tier)
2. Ollama (Local, self-hosted LLMs)
3. MockLLMProvider (Deterministic offline testing)
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from medistock_agents.config import Settings, get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Base Provider
# ---------------------------------------------------------------------------

class LLMProvider(ABC):
    """Abstract base class for all LLM providers in MediStock."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g. 'gemini', 'ollama', 'mock')."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Name of the model in use."""

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is currently reachable and configured."""

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        """Generate a response text from the LLM given a user prompt and optional system instructions."""


# ---------------------------------------------------------------------------
# Google Gemini Provider
# ---------------------------------------------------------------------------

class GeminiProvider(LLMProvider):
    """Google Gemini API provider using langchain-google-genai / HTTP API."""

    def __init__(self, api_key: str | None = None, model: str | None = None, timeout: float = 30.0) -> None:
        settings = get_settings()
        self._api_key = api_key if api_key is not None else settings.gemini_api_key
        self._model = model or settings.gemini_model
        self._timeout = timeout
        self._client: Any = None

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model

    async def is_available(self) -> bool:
        return bool(self._api_key and self._api_key.strip())

    def _get_client(self) -> Any:
        if self._client is None:
            from langchain_google_genai import ChatGoogleGenerativeAI

            active_model = self._model
            if active_model == "gemini-1.5-flash":
                active_model = "gemini-3.8-flash"

            self._client = ChatGoogleGenerativeAI(
                model=active_model,
                google_api_key=self._api_key,
                temperature=0.1,
                timeout=self._timeout,
            )
        return self._client


    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        if not await self.is_available():
            raise RuntimeError("Gemini API key is not configured.")

        from langchain_core.messages import HumanMessage, SystemMessage

        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        client = self._get_client()
        response = await client.ainvoke(messages)
        content = response.content
        if isinstance(content, list):
            return "".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in content)
        return str(content)


# ---------------------------------------------------------------------------
# Ollama Provider (Local)
# ---------------------------------------------------------------------------

class OllamaProvider(LLMProvider):
    """Local Ollama provider using Ollama's HTTP API."""

    def __init__(self, base_url: str | None = None, model: str | None = None, timeout: float = 30.0) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._model = model or settings.ollama_model
        self._timeout = timeout

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model

    async def is_available(self) -> bool:
        """Verify if local Ollama daemon is reachable, responding, and has models installed."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self._base_url}/api/tags")
                if res.status_code != 200:
                    return False
                models = res.json().get("models", [])
                if not models:
                    return False
                installed_names = [m.get("name", "").casefold() for m in models]
                target = self._model.casefold()
                target_base = target.split(":")[0]
                return any(
                    name == target or name.split(":")[0] == target_base
                    for name in installed_names
                )
        except Exception:
            return False

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.1},
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.post(f"{self._base_url}/api/chat", json=payload)
                res.raise_for_status()
                data = res.json()
                return str(data.get("message", {}).get("content", ""))
        except Exception as ex:
            logger.warning("Ollama call failed: %s", ex)
            raise RuntimeError(f"Ollama local LLM invocation failed: {ex}") from ex


# ---------------------------------------------------------------------------
# Mock Provider (Offline testing)
# ---------------------------------------------------------------------------

class MockLLMProvider(LLMProvider):
    """Deterministic Mock LLM for automated tests without network calls."""

    def __init__(self, response_text: str = "", responses: list[str] | None = None) -> None:
        self.default_response = response_text
        self.responses = list(responses) if responses else []
        self.call_history: list[dict[str, Any]] = []

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return "mock-model"

    async def is_available(self) -> bool:
        return True

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        self.call_history.append({"prompt": prompt, "system_prompt": system_prompt})
        if self.responses:
            return self.responses.pop(0)
        return self.default_response


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    """Instantiate the active LLM provider based on settings."""
    cfg = settings or get_settings()
    provider_type = cfg.llm_provider.lower().strip()

    if provider_type == "ollama":
        return OllamaProvider(
            base_url=cfg.ollama_base_url,
            model=cfg.ollama_model,
            timeout=cfg.llm_timeout_seconds,
        )
    elif provider_type == "mock":
        return MockLLMProvider()
    else:
        # Default to Gemini
        return GeminiProvider(
            api_key=cfg.gemini_api_key,
            model=cfg.gemini_model,
            timeout=cfg.llm_timeout_seconds,
        )
