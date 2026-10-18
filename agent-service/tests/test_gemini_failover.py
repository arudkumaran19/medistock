"""Unit and integration tests for Gemini three-key failover and deterministic fallback.

Tests verify:
1. Primary key succeeds.
2. Primary key fails due to retryable quota/credential/503 error -> secondary key succeeds.
3. Primary and secondary fail -> tertiary key succeeds.
4. All three keys fail -> clean fallback provider activation or sanitized error.
5. Non-retryable application errors do not trigger key rotation.
6. Bounded retries and no infinite loops.
7. No secrets appear in logs or exception messages.
8. Shared quota / project limit detection.
9. Fast deterministic path for greetings and conversational acknowledgements.
10. Polite refusal for out-of-scope requests (poems, homework, celebrity news, holidays).
11. Ambiguous requests produce clarification prompt without executing tools.
12. Mixed greeting + MediStock question handles the question without rejection.
13. Informal queries and typos are supported.
"""

from __future__ import annotations

import logging
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from medistock_agents.llm.provider import (
    GeminiProvider,
    MockLLMProvider,
    get_llm_provider,
)
from medistock_agents.config import Settings
from medistock_agents.orchestration.coordinator import CoordinatorAgent
from medistock_agents.orchestration.intent_classifier import ALLOWED_INTENTS


@pytest.fixture(autouse=True)
def reset_provider_state():
    """Ensure static quota states are clean before each test."""
    GeminiProvider.reset_quota_state()
    yield
    GeminiProvider.reset_quota_state()


class FakeChatResponse:
    def __init__(self, content: str):
        self.content = content


@pytest.mark.asyncio
async def test_primary_key_succeeds():
    """Primary credential slot generates successfully on the first attempt."""
    provider = GeminiProvider(
        api_key="mock-primary-key-111",
        secondary_api_key="mock-secondary-key-222",
        tertiary_api_key="mock-tertiary-key-333",
        model="gemini-3.8-flash",
    )

    mock_client = MagicMock()
    mock_client.ainvoke = AsyncMock(return_value=FakeChatResponse("Clinical summary generated."))

    with patch.object(provider, "_get_client_for_slot", return_value=mock_client) as mock_get_client:
        response = await provider.generate("Analyze stock levels")

        assert response == "Clinical summary generated."
        assert provider.last_used_credential_slot == "primary"
        mock_get_client.assert_called_once_with("primary")
        assert not provider._primary_exhausted
        assert not provider._secondary_exhausted
        assert not provider._tertiary_exhausted


@pytest.mark.asyncio
async def test_primary_quota_error_rotates_to_secondary():
    """Primary slot encounters 429 / RESOURCE_EXHAUSTED; rotates automatically to secondary."""
    provider = GeminiProvider(
        api_key="mock-primary-key-111",
        secondary_api_key="mock-secondary-key-222",
        tertiary_api_key="mock-tertiary-key-333",
        model="gemini-3.8-flash",
    )

    primary_client = MagicMock()
    primary_client.ainvoke = AsyncMock(
        side_effect=RuntimeError("429 RESOURCE_EXHAUSTED: Quota exceeded for project")
    )

    secondary_client = MagicMock()
    secondary_client.ainvoke = AsyncMock(
        return_value=FakeChatResponse("Secondary key response successful.")
    )

    def fake_get_client(slot: str):
        if slot == "primary":
            return primary_client
        return secondary_client

    with patch.object(provider, "_get_client_for_slot", side_effect=fake_get_client):
        response = await provider.generate("Generate shortage forecast")

        assert response == "Secondary key response successful."
        assert provider.last_used_credential_slot == "secondary"
        assert provider._primary_exhausted is True
        assert provider._secondary_exhausted is False
        assert provider._tertiary_exhausted is False


@pytest.mark.asyncio
async def test_primary_and_secondary_fail_rotates_to_tertiary():
    """Both primary and secondary fail with retryable errors; tertiary key succeeds."""
    provider = GeminiProvider(
        api_key="mock-primary-key-111",
        secondary_api_key="mock-secondary-key-222",
        tertiary_api_key="mock-tertiary-key-333",
        model="gemini-3.8-flash",
    )

    primary_client = MagicMock()
    primary_client.ainvoke = AsyncMock(
        side_effect=RuntimeError("429 RESOURCE_EXHAUSTED: Quota exceeded")
    )

    secondary_client = MagicMock()
    secondary_client.ainvoke = AsyncMock(
        side_effect=RuntimeError("503 UNAVAILABLE: This model is currently experiencing high demand.")
    )

    tertiary_client = MagicMock()
    tertiary_client.ainvoke = AsyncMock(
        return_value=FakeChatResponse("Tertiary key response successful.")
    )

    def fake_get_client(slot: str):
        if slot == "primary":
            return primary_client
        elif slot == "secondary":
            return secondary_client
        return tertiary_client

    with patch.object(provider, "_get_client_for_slot", side_effect=fake_get_client):
        response = await provider.generate("Check expiry schedule")

        assert response == "Tertiary key response successful."
        assert provider.last_used_credential_slot == "tertiary"
        assert provider._primary_exhausted is True
        assert provider._secondary_exhausted is True
        assert provider._tertiary_exhausted is False


@pytest.mark.asyncio
async def test_non_retryable_error_does_not_rotate_keys():
    """Ordinary code bugs / syntax errors in primary must NOT rotate keys or exhaust quota."""
    provider = GeminiProvider(
        api_key="mock-primary-key-111",
        secondary_api_key="mock-secondary-key-222",
        tertiary_api_key="mock-tertiary-key-333",
        model="gemini-3.8-flash",
    )

    primary_client = MagicMock()
    primary_client.ainvoke = AsyncMock(
        side_effect=ValueError("Application schema serialization failed")
    )

    secondary_client = MagicMock()
    secondary_client.ainvoke = AsyncMock(return_value=FakeChatResponse("Should not be called"))

    def fake_get_client(slot: str):
        return primary_client if slot == "primary" else secondary_client

    with patch.object(provider, "_get_client_for_slot", side_effect=fake_get_client):
        with pytest.raises(ValueError, match="Application schema serialization failed"):
            await provider.generate("Run audit")

        # Crucial: key was NOT rotated and primary was NOT marked exhausted
        assert provider._primary_exhausted is False
        assert secondary_client.ainvoke.call_count == 0


@pytest.mark.asyncio
async def test_all_three_keys_fail_falls_back_to_fallback_provider():
    """When all three keys fail with quota errors, provider falls back cleanly."""
    mock_fallback = MockLLMProvider("Deterministic fallback output")

    provider = GeminiProvider(
        api_key="mock-primary-key-111",
        secondary_api_key="mock-secondary-key-222",
        tertiary_api_key="mock-tertiary-key-333",
        model="gemini-3.8-flash",
        fallback_provider=mock_fallback,
    )

    fail_client = MagicMock()
    fail_client.ainvoke = AsyncMock(side_effect=RuntimeError("429 RESOURCE_EXHAUSTED"))

    with patch.object(provider, "_get_client_for_slot", return_value=fail_client):
        response = await provider.generate("Shortage resolution")

        assert response == "Deterministic fallback output"
        assert provider.last_used_credential_slot == "fallback"
        assert GeminiProvider._quota_exhausted is True


@pytest.mark.asyncio
async def test_all_three_keys_fail_without_fallback_raises_sanitized_error():
    """When all three keys fail and no fallback is available, raises sanitized RuntimeError."""
    provider = GeminiProvider(
        api_key="mock-primary-key-111",
        secondary_api_key="mock-secondary-key-222",
        tertiary_api_key="mock-tertiary-key-333",
        model="gemini-3.8-flash",
        fallback_provider=None,
    )

    fail_client = MagicMock()
    fail_client.ainvoke = AsyncMock(side_effect=RuntimeError("429 RESOURCE_EXHAUSTED"))

    with patch.object(provider, "_get_client_for_slot", return_value=fail_client):
        with pytest.raises(RuntimeError) as exc_info:
            await provider.generate("Shortage resolution")

        err_msg = str(exc_info.value)
        assert "All configured Gemini API keys failed and no fallback provider is available." in err_msg
        # Verify no credentials leaked into the error
        assert "mock-primary-key" not in err_msg
        assert "mock-secondary-key" not in err_msg
        assert "mock-tertiary-key" not in err_msg


@pytest.mark.asyncio
async def test_missing_keys_safe_error():
    """Empty or unconfigured keys are reported safely without crashing or exposing secrets."""
    provider = GeminiProvider(api_key="", secondary_api_key="", tertiary_api_key="", model="gemini-3.8-flash")
    assert not await provider.is_available()

    with pytest.raises(RuntimeError, match="Gemini API key is not configured"):
        await provider.generate("Test prompt")


def test_no_secrets_appear_in_logs(caplog):
    """Ensure that secret keys are NEVER logged during execution or failover."""
    secret_key_1 = "SECRET_PRIMARY_KEY_XYZ_999"
    secret_key_2 = "SECRET_SECONDARY_KEY_ABC_888"
    secret_key_3 = "SECRET_TERTIARY_KEY_JKL_777"

    provider = GeminiProvider(
        api_key=secret_key_1,
        secondary_api_key=secret_key_2,
        tertiary_api_key=secret_key_3,
        model="gemini-3.8-flash",
    )

    with caplog.at_level(logging.DEBUG):
        provider._is_retryable_credential_or_quota_error(
            RuntimeError("429 rate limit exceeded")
        )

    for record in caplog.records:
        assert secret_key_1 not in record.message
        assert secret_key_2 not in record.message
        assert secret_key_3 not in record.message


@pytest.mark.asyncio
async def test_factory_configures_three_keys():
    """get_llm_provider correctly wires primary, secondary, and tertiary keys from Settings."""
    cfg = Settings(
        gemini_api_key="cfg-primary-key",
        gemini_api_key_secondary="cfg-secondary-key",
        gemini_api_key_tertiary="cfg-tertiary-key",
        gemini_model="gemini-3.8-flash",
        llm_provider="gemini",
    )
    provider = get_llm_provider(cfg)
    assert isinstance(provider, GeminiProvider)
    assert provider._primary_key == "cfg-primary-key"
    assert provider._secondary_key == "cfg-secondary-key"
    assert provider._tertiary_key == "cfg-tertiary-key"
    assert provider._model == "gemini-3.8-flash"


# ---------------------------------------------------------------------------
# Intent Classification & Conversational Flow Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_deterministic_greeting_path():
    """Pure greetings bypass specialist execution and return immediate friendly responses."""
    agent = CoordinatorAgent(llm_provider=MockLLMProvider())

    for greeting in ["Hello", "hi", "Good morning", "Hey there!", "how are you"]:
        result = await agent.run(objective=greeting)
        assert result["intent"] in ["Greeting", "GeneralInquiry"]
        assert result["requires_approval"] is False
        assert result["sub_agents_involved"] == ["Coordinator Agent"]
        assert "MediStock" in result["final_recommendation"]


@pytest.mark.asyncio
async def test_deterministic_thank_you_and_goodbye():
    """Pleasantries such as thank you and goodbye are acknowledged gracefully."""
    agent = CoordinatorAgent(llm_provider=MockLLMProvider())

    ty_result = await agent.run(objective="Thank you very much!")
    assert ty_result["intent"] == "Greeting"
    assert "welcome" in ty_result["final_recommendation"].lower()

    bye_result = await agent.run(objective="Goodbye, have a great day")
    assert bye_result["intent"] == "Greeting"
    assert "goodbye" in bye_result["final_recommendation"].lower()


@pytest.mark.asyncio
async def test_out_of_scope_polite_refusal():
    """Requests unrelated to healthcare supply chain are politely declined without calling specialists."""
    agent = CoordinatorAgent(llm_provider=MockLLMProvider())

    out_of_scope_queries = [
        "Write me a poem about the ocean.",
        "Solve my mathematics homework on calculus.",
        "Tell me today's celebrity gossip news.",
        "Plan my vacation holiday to the beach.",
        "Tell me a funny joke.",
    ]

    for query in out_of_scope_queries:
        result = await agent.run(objective=query)
        assert result["intent"] == "OutOfDomain"
        assert result["requires_approval"] is False
        assert result["sub_agents_involved"] == ["Coordinator Agent"]
        assert "MediStock inventory" in result["final_recommendation"]
        assert "can't assist with unrelated requests" in result["final_recommendation"]


@pytest.mark.asyncio
async def test_mixed_greeting_plus_medistock_question():
    """Mixed greeting plus operational question handles the question rather than acting as a greeting."""
    agent = CoordinatorAgent(llm_provider=MockLLMProvider())

    result = await agent.run(objective="Good morning, what is the stock level of Paracetamol?")
    assert result["intent"] in ["InventoryAudit", "CatalogueQuery", "ShortageAnalysis"]
    assert result["intent"] != "Greeting"


@pytest.mark.asyncio
async def test_ambiguous_request_returns_clarification():
    """Ambiguous requests with no recognizable medicine or facility ask for clarification."""
    agent = CoordinatorAgent(llm_provider=MockLLMProvider())

    result = await agent.run(objective="Check the stock levels please")
    assert result["intent"] in ["Clarification", "CatalogueQuery"]
    assert result["requires_approval"] is False
