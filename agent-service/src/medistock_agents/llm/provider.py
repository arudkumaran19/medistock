"""LLM Provider Abstraction for MediStock Agents.

Provides a unified interface supporting both:
1. Google Gemini API (Cloud) - primary if LLM_PROVIDER=gemini
2. Ollama (Local, self-hosted LLMs) - primary if LLM_PROVIDER=ollama
3. Auto-fallback: if the primary provider is unavailable or fails, the other is tried automatically
4. MockLLMProvider (Deterministic offline testing)
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
    """Google Gemini API provider using langchain-google-genai with auto-fallback."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 30.0,
        fallback_provider: LLMProvider | None = None,
    ) -> None:
        settings = get_settings()
        self._api_key = api_key if api_key is not None else settings.gemini_api_key
        self._model = (model or settings.gemini_model or "gemini-3.8-flash").strip()
        self._timeout = timeout
        self._fallback_provider = fallback_provider
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
            logger.info("Initialising Gemini client with model=%s", self._model)
            self._client = ChatGoogleGenerativeAI(
                model=self._model,
                google_api_key=self._api_key,
                temperature=0.1,
                timeout=self._timeout,
            )
        return self._client

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        if not await self.is_available():
            if self._fallback_provider and await self._fallback_provider.is_available():
                logger.warning("Gemini API key unconfigured; auto-falling back to %s", self._fallback_provider.provider_name)
                return await self._fallback_provider.generate(prompt, system_prompt)
            raise RuntimeError("Gemini API key is not configured and no fallback is available.")

        try:
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
        except Exception as ex:
            if self._fallback_provider and await self._fallback_provider.is_available():
                logger.warning("Gemini generation failed (%s); auto-falling back to %s", ex, self._fallback_provider.provider_name)
                return await self._fallback_provider.generate(prompt, system_prompt)
            raise


# ---------------------------------------------------------------------------
# Ollama Provider (Local)
# ---------------------------------------------------------------------------

class OllamaProvider(LLMProvider):
    """Local Ollama provider using Ollama's HTTP API with auto-fallback."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 30.0,
        fallback_provider: LLMProvider | None = None,
    ) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.ollama_base_url or "http://localhost:11434").rstrip("/")
        self._model = model or settings.ollama_model or "llama3.2"
        self._timeout = timeout
        self._fallback_provider = fallback_provider

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model

    async def is_available(self) -> bool:
        """Verify if local Ollama daemon is reachable."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self._base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        if not await self.is_available():
            if self._fallback_provider and await self._fallback_provider.is_available():
                logger.warning("Ollama daemon unavailable; auto-falling back to %s", self._fallback_provider.provider_name)
                return await self._fallback_provider.generate(prompt, system_prompt)
            raise RuntimeError(f"Ollama local LLM is unreachable at {self._base_url}")

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
            if self._fallback_provider and await self._fallback_provider.is_available():
                logger.warning("Ollama call failed (%s); auto-falling back to %s", ex, self._fallback_provider.provider_name)
                return await self._fallback_provider.generate(prompt, system_prompt)
            logger.warning("Ollama call failed: %s", ex)
            raise RuntimeError(f"Ollama local LLM invocation failed: {ex}") from ex


# ---------------------------------------------------------------------------
# Auto-Fallback Provider
# ---------------------------------------------------------------------------

class AutoFallbackProvider(LLMProvider):
    """Explicit composite provider: tries primary, falls back to secondary."""

    def __init__(self, primary: LLMProvider, secondary: LLMProvider) -> None:
        self._primary = primary
        self._secondary = secondary
        self._active: LLMProvider | None = None

    @property
    def provider_name(self) -> str:
        if self._active:
            return self._active.provider_name
        return self._primary.provider_name

    @property
    def model_name(self) -> str:
        if self._active:
            return self._active.model_name
        return self._primary.model_name

    async def is_available(self) -> bool:
        return await self._primary.is_available() or await self._secondary.is_available()

    async def _resolve_active(self) -> LLMProvider:
        if await self._primary.is_available():
            self._active = self._primary
            return self._primary
        logger.warning(
            "LLM: Primary provider '%s' unavailable -- falling back to '%s'.",
            self._primary.provider_name,
            self._secondary.provider_name,
        )
        self._active = self._secondary
        return self._secondary

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        provider = await self._resolve_active()
        try:
            return await provider.generate(prompt, system_prompt)
        except Exception as primary_ex:
            if provider is self._primary:
                logger.warning(
                    "LLM: Primary '%s' failed during generation (%s). Switching to secondary '%s'.",
                    self._primary.provider_name, primary_ex, self._secondary.provider_name,
                )
                self._active = self._secondary
                return await self._secondary.generate(prompt, system_prompt)
            raise


# ---------------------------------------------------------------------------
# Mock Provider (Offline / CI testing)
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
    """Instantiate the active LLM provider with automatic Gemini <-> Ollama fallback.

    - LLM_PROVIDER=gemini  -> GeminiProvider primary (with Ollama fallback)
    - LLM_PROVIDER=ollama  -> OllamaProvider primary (with Gemini fallback)
    - LLM_PROVIDER=mock    -> MockLLMProvider (tests only)
    """
    cfg = settings or get_settings()
    provider_type = (cfg.llm_provider or "gemini").lower().strip()

    if provider_type == "mock":
        return MockLLMProvider()

    gemini = GeminiProvider(
        api_key=cfg.gemini_api_key,
        model=cfg.gemini_model,
        timeout=cfg.llm_timeout_seconds,
    )
    ollama = OllamaProvider(
        base_url=cfg.ollama_base_url,
        model=cfg.ollama_model,
        timeout=cfg.llm_timeout_seconds,
    )

    if provider_type == "ollama":
        ollama._fallback_provider = gemini
        return ollama
    else:
        gemini._fallback_provider = ollama
        return gemini
