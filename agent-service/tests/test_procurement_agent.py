import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from medistock_agents.agents.procurement_validation_agent import ProcurementValidationAgent
from medistock_agents.models.agent_models import ProcurementAction, ProcurementActionType
from medistock_agents.tools.procurement_tools import BackendUnavailableError
from medistock_agents.main import app


class FakeProcurementBackend:
    def __init__(self, include_violations: bool = False, include_stale: bool = False):
        self.approve_calls: list[str] = []
        self.reject_calls: list[tuple[str, str]] = []
        self.revise_calls: list[tuple[str, str]] = []
        self.include_violations = include_violations
        self.include_stale = include_stale

        now = datetime.now(timezone.utc)
        self.suppliers = [
            {"id": "sup-001", "name": "State Pharma", "isActive": True, "leadTimeDays": 5},
            {"id": "sup-002", "name": "Discontinued Meds", "isActive": False, "leadTimeDays": 10},
        ]

        stale_date = (now - timedelta(days=40)).isoformat()
        fresh_date = now.isoformat()

        self.purchase_orders = [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "supplierId": "sup-002" if include_violations else "sup-001",
                "facilityId": "fac-001",
                "status": "PendingApproval",
                "requestedAt": fresh_date,
                "items": [] if include_violations else [{"medicineId": "med-1", "requestedQuantity": 10, "unitPrice": 100.0}],
                "approvedById": None,
            },
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "supplierId": "sup-001",
                "facilityId": "fac-001",
                "status": "Draft",
                "requestedAt": stale_date if include_stale else fresh_date,
                "items": [{"medicineId": "med-2", "requestedQuantity": 50, "unitPrice": 20.0}],
                "approvedById": None,
            },
            {
                "id": "33333333-3333-3333-3333-333333333333",
                "supplierId": "sup-001",
                "facilityId": "fac-002",
                "status": "Approved",
                "requestedAt": fresh_date,
                "items": [{"medicineId": "med-3", "requestedQuantity": 5, "unitPrice": 15.0}],
                "approvedById": "user-admin",
            },
        ]

    async def get_suppliers(self):
        return self.suppliers

    async def get_purchase_orders(self):
        return self.purchase_orders

    async def get_pending_approvals(self):
        return [po for po in self.purchase_orders if po.get("status") == "PendingApproval"]

    async def get_purchase_order(self, po_id: str):
        for po in self.purchase_orders:
            if po.get("id") == po_id:
                return po
        return None

    async def get_authorization_rules(self):
        return [
            {"id": "rule-1", "name": "Facility Drug Authority", "isActive": True},
            {"id": "rule-2", "name": "Max Value Authority", "isActive": True},
        ]

    async def validate_procurement(self, payload: dict):
        if payload.get("force_violation"):
            return {
                "isValid": False,
                "violations": ["Item Paracetamol exceeds facility max stock limit."],
            }
        return {"isValid": True, "violations": []}

    async def approve_purchase_order(self, po_id: str):
        self.approve_calls.append(po_id)
        return {"id": po_id, "status": "Approved"}

    async def reject_purchase_order(self, po_id: str, reason: str):
        self.reject_calls.append((po_id, reason))
        return {"id": po_id, "status": "Rejected", "rejectionReason": reason}

    async def request_revision(self, po_id: str, reason: str):
        self.revise_calls.append((po_id, reason))
        return {"id": po_id, "status": "RevisionRequired", "revisionReason": reason}


class UnavailableProcurementBackend:
    async def get_suppliers(self):
        raise BackendUnavailableError("Backend offline")

    async def get_purchase_orders(self):
        raise BackendUnavailableError("Backend offline")

    async def get_pending_approvals(self):
        raise BackendUnavailableError("Backend offline")

    async def get_purchase_order(self, po_id: str):
        raise BackendUnavailableError("Backend offline")

    async def get_authorization_rules(self):
        raise BackendUnavailableError("Backend offline")

    async def validate_procurement(self, payload: dict):
        raise BackendUnavailableError("Backend offline")

    async def approve_purchase_order(self, po_id: str):
        raise BackendUnavailableError("Backend offline")

    async def reject_purchase_order(self, po_id: str, reason: str):
        raise BackendUnavailableError("Backend offline")

    async def request_revision(self, po_id: str, reason: str):
        raise BackendUnavailableError("Backend offline")


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------

def test_validation_rejects_missing_fields():
    agent = ProcurementValidationAgent()

    # ASK without question
    assert "question is required" in agent.validate(
        ProcurementAction(action_type=ProcurementActionType.ASK, payload={})
    )

    # APPROVE without purchaseOrderId
    assert "purchaseOrderId is required" in agent.validate(
        ProcurementAction(action_type=ProcurementActionType.APPROVE, payload={})
    )

    # REJECT without purchaseOrderId and reason
    reject_errors = agent.validate(
        ProcurementAction(action_type=ProcurementActionType.REJECT, payload={})
    )
    assert "purchaseOrderId is required" in reject_errors
    assert "reason is required for this workflow action" in reject_errors

    # REVISE without reason
    revise_errors = agent.validate(
        ProcurementAction(
            action_type=ProcurementActionType.REVISE,
            payload={"purchaseOrderId": "11111111-1111-1111-1111-111111111111", "reason": "   "},
        )
    )
    assert "reason is required for this workflow action" in revise_errors

    # VALIDATE without supplierId or facilityId
    val_errors = agent.validate(
        ProcurementAction(action_type=ProcurementActionType.VALIDATE, payload={})
    )
    assert "supplierId is required for validation" in val_errors
    assert "facilityId is required for validation" in val_errors


def test_plan_returns_steps():
    agent = ProcurementValidationAgent()
    for action_type in ProcurementActionType:
        plan = agent.plan(ProcurementAction(action_type=action_type, payload={}))
        assert isinstance(plan, list)
        assert len(plan) > 0


@pytest.mark.asyncio
async def test_ask_pending_approvals():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "What purchase orders are pending approval?"},
    )
    result = await agent.run(action, backend)
    assert "1 purchase order(s) pending approval" in result.answer
    assert "PO 11111111" in result.answer


@pytest.mark.asyncio
async def test_ask_pending_approvals_when_none():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()
    backend.purchase_orders = []

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "Are there any pending approvals?"},
    )
    result = await agent.run(action, backend)
    assert "no purchase orders currently awaiting approval" in result.answer


@pytest.mark.asyncio
async def test_ask_suppliers():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "List our suppliers."},
    )
    result = await agent.run(action, backend)
    assert "Supplier catalogue: 2 total (1 active, 1 inactive)" in result.answer
    assert "State Pharma" in result.answer


@pytest.mark.asyncio
async def test_ask_specific_purchase_order():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "Give me details on PO 11111111-1111-1111-1111-111111111111"},
    )
    result = await agent.run(action, backend)
    assert "Purchase Order 11111111" in result.answer
    assert "PendingApproval" in result.answer


@pytest.mark.asyncio
async def test_ask_unknown_purchase_order():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "Status of PO 99999999-9999-9999-9999-999999999999?"},
    )
    result = await agent.run(action, backend)
    assert "No purchase order with ID 99999999-9999-9999-9999-999999999999 was found" in result.answer


@pytest.mark.asyncio
async def test_ask_policy_rules():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "What are the procurement policy rules?"},
    )
    result = await agent.run(action, backend)
    assert "2 authorization rule(s) are configured" in result.answer


@pytest.mark.asyncio
async def test_ask_generic_summary():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "Give me an overview of orders"},
    )
    result = await agent.run(action, backend)
    assert "Purchase order summary: 3 total" in result.answer


@pytest.mark.asyncio
async def test_analyze_surfaces_violations_and_stale():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend(include_violations=True, include_stale=True)

    action = ProcurementAction(action_type=ProcurementActionType.ANALYZE, payload={})
    result = await agent.run(action, backend)

    assert len(result.insights) >= 2
    policy_violations = [i for i in result.insights if i.kind == "policy_violation"]
    stale_pos = [i for i in result.insights if i.kind == "stale_purchase_order"]

    assert len(policy_violations) >= 2  # inactive supplier + empty items
    assert len(stale_pos) >= 1  # 40 days old order
    assert "Procurement audit:" in result.answer


@pytest.mark.asyncio
async def test_validate_action_passing():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.VALIDATE,
        payload={"supplierId": "sup-001", "facilityId": "fac-001", "items": []},
    )
    result = await agent.run(action, backend)
    assert "complies with all configured policies" in result.answer
    assert len(result.insights) == 0


@pytest.mark.asyncio
async def test_validate_action_failing():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.VALIDATE,
        payload={"supplierId": "sup-001", "facilityId": "fac-001", "force_violation": True},
    )
    result = await agent.run(action, backend)
    assert "validation failed with 1 violation" in result.answer
    assert len(result.insights) == 1
    assert result.insights[0].kind == "policy_violation"


@pytest.mark.asyncio
async def test_mutation_requires_approval_and_does_not_mutate():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    # Unapproved APPROVE
    action = ProcurementAction(
        action_type=ProcurementActionType.APPROVE,
        payload={"purchaseOrderId": "11111111-1111-1111-1111-111111111111"},
    )
    result = await agent.run(action, backend, approved=False)
    assert result.approval_required is True
    assert result.executed is False
    assert backend.approve_calls == []
    assert "Set approved=true to confirm" in result.answer


@pytest.mark.asyncio
async def test_approve_executes_when_approved():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    po_id = "11111111-1111-1111-1111-111111111111"
    action = ProcurementAction(
        action_type=ProcurementActionType.APPROVE,
        payload={"purchaseOrderId": po_id},
    )
    result = await agent.run(action, backend, approved=True)
    assert result.approval_required is True
    assert result.executed is True
    assert po_id in backend.approve_calls
    assert "approved successfully" in result.answer


@pytest.mark.asyncio
async def test_reject_executes_when_approved():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    po_id = "11111111-1111-1111-1111-111111111111"
    reason = "Requested items out of policy budget."
    action = ProcurementAction(
        action_type=ProcurementActionType.REJECT,
        payload={"purchaseOrderId": po_id, "reason": reason},
    )
    result = await agent.run(action, backend, approved=True)
    assert result.executed is True
    assert (po_id, reason) in backend.reject_calls
    assert "has been rejected" in result.answer


@pytest.mark.asyncio
async def test_revise_executes_when_approved():
    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    po_id = "11111111-1111-1111-1111-111111111111"
    reason = "Adjust quantity from 100 to 50."
    action = ProcurementAction(
        action_type=ProcurementActionType.REVISE,
        payload={"purchaseOrderId": po_id, "reason": reason},
    )
    result = await agent.run(action, backend, approved=True)
    assert result.executed is True
    assert (po_id, reason) in backend.revise_calls
    assert "Revision requested" in result.answer


@pytest.mark.asyncio
async def test_backend_unavailable():
    agent = ProcurementValidationAgent()
    backend = UnavailableProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "What orders are pending?"},
    )
    result = await agent.run(action, backend)
    assert len(result.validation_errors) == 1
    assert "Backend offline" in result.validation_errors[0]


def test_api_endpoint_procurement_agent():
    client = TestClient(app)

    response = client.post(
        "/api/procurement-agent/run",
        json={
            "action_type": "ask",
            "payload": {"question": "What is the policy?"},
            "approved": False,
        },
    )
    # The real backend may be offline in pure unit testing, but FastAPI schema and routing will execute
    assert response.status_code == 200
    data = response.json()
    assert "plan" in data
    assert "answer" in data
    assert "insights" in data


# ---------------------------------------------------------------------------
# LLM Provider & Abstraction Tests
# ---------------------------------------------------------------------------

def test_llm_provider_selection_gemini():
    from medistock_agents.config import Settings
    from medistock_agents.llm.provider import GeminiProvider, get_llm_provider

    settings = Settings(llm_provider="gemini", gemini_api_key="test-key", gemini_model="gemini-1.5-flash")
    provider = get_llm_provider(settings)
    assert isinstance(provider, GeminiProvider)
    assert provider.provider_name == "gemini"
    assert provider.model_name == "gemini-1.5-flash"


def test_llm_provider_selection_ollama():
    from medistock_agents.config import Settings
    from medistock_agents.llm.provider import OllamaProvider, get_llm_provider

    settings = Settings(llm_provider="ollama", ollama_base_url="http://localhost:11434", ollama_model="llama3")
    provider = get_llm_provider(settings)
    assert isinstance(provider, OllamaProvider)
    assert provider.provider_name == "ollama"
    assert provider.model_name == "llama3"


@pytest.mark.asyncio
async def test_gemini_provider_availability():
    from medistock_agents.llm.provider import GeminiProvider

    unconfigured = GeminiProvider(api_key="")
    assert await unconfigured.is_available() is False

    configured = GeminiProvider(api_key="valid-test-key")
    assert await configured.is_available() is True


@pytest.mark.asyncio
async def test_ollama_provider_availability_mock():
    from medistock_agents.llm.provider import OllamaProvider
    from unittest.mock import patch, AsyncMock

    provider = OllamaProvider(base_url="http://localhost:11434")

    # Mock success (Ollama running with model installed)
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        import httpx
        mock_get.return_value = httpx.Response(200, json={"models": [{"name": f"{provider.model_name}:latest"}]})
        assert await provider.is_available() is True

    # Mock failure (Ollama offline)
    with patch("httpx.AsyncClient.get", side_effect=Exception("Connection refused")):
        assert await provider.is_available() is False


# ---------------------------------------------------------------------------
# Safe Fallback Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fallback_when_gemini_key_missing():
    """Agent seamlessly falls back to deterministic logic when LLM key is absent."""
    from medistock_agents.llm.provider import GeminiProvider

    unconfigured_gemini = GeminiProvider(api_key="")
    agent = ProcurementValidationAgent(llm_provider=unconfigured_gemini)
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "What purchase orders are pending approval?"},
    )
    result = await agent.run(action, backend)
    # Proves fallback succeeded without throwing exceptions
    assert "pending approval" in result.answer
    assert "PO 11111111" in result.answer


@pytest.mark.asyncio
async def test_fallback_when_llm_throws_error():
    """Agent falls back to deterministic logic if LLM throws API error or rate limits."""
    from medistock_agents.llm.provider import LLMProvider

    class FailingLLMProvider(LLMProvider):
        @property
        def provider_name(self): return "failing"
        @property
        def model_name(self): return "failing-model"
        async def is_available(self): return True
        async def generate(self, prompt: str, system_prompt: str | None = None):
            raise RuntimeError("API quota exceeded (HTTP 429)")

    agent = ProcurementValidationAgent(llm_provider=FailingLLMProvider())
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "List our suppliers."},
    )
    result = await agent.run(action, backend)
    # Proves fallback successfully caught the error and answered using deterministic engine
    assert "Supplier catalogue:" in result.answer
    assert "State Pharma" in result.answer


@pytest.mark.asyncio
async def test_fallback_when_llm_returns_malformed_json():
    """Agent falls back gracefully when LLM output is not valid JSON."""
    from medistock_agents.llm.provider import MockLLMProvider

    malformed_provider = MockLLMProvider(response_text="I am not a JSON object!")
    agent = ProcurementValidationAgent(llm_provider=malformed_provider)
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "What purchase orders are pending approval?"},
    )
    result = await agent.run(action, backend)
    assert "pending approval" in result.answer


# ---------------------------------------------------------------------------
# LangGraph Agentic Dynamic Tool Calling & Reasoning Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_langgraph_agentic_tool_selection_and_recommendation():
    """Verify genuine agentic flow: intent understanding, tool selection, backend invocation, recommendation."""
    from medistock_agents.llm.provider import MockLLMProvider
    import json

    plan_response = json.dumps({
        "intent": "Retrieve active suppliers and check lead times for restock",
        "plan": ["Query supplier directory", "Check lead times", "Synthesize recommendation"],
        "tool_calls": [
            {"tool": "get_suppliers", "args": {}},
            {"tool": "get_authorization_rules", "args": {}}
        ]
    })

    interpret_response = json.dumps({
        "recommendation": "State Pharma has a 5-day lead time and is recommended for the restock.",
        "insights": [
            {"kind": "recommendation", "message": "Select State Pharma for urgent orders", "severity": "info"}
        ],
        "execution_status": "success"
    })

    mock_llm = MockLLMProvider(responses=[plan_response, interpret_response])
    agent = ProcurementValidationAgent(llm_provider=mock_llm)
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.ASK,
        payload={"question": "Which supplier can deliver fastest?"},
    )

    result = await agent.run(action, backend)

    assert result.plan == ["Query supplier directory", "Check lead times", "Synthesize recommendation"]
    assert "State Pharma" in result.answer
    assert len(result.insights) == 1
    assert result.insights[0].kind == "recommendation"
    assert result.approval_required is False


@pytest.mark.asyncio
async def test_langgraph_blocks_mutation_when_unapproved():
    """Verify approval safety gate: LLM requesting mutation without approved=True is BLOCKED."""
    from medistock_agents.llm.provider import MockLLMProvider
    import json

    plan_response = json.dumps({
        "intent": "Approve purchase order 11111111-1111-1111-1111-111111111111",
        "plan": ["Verify PO status", "Execute approval"],
        "tool_calls": [
            {"tool": "approve_purchase_order", "args": {"purchaseOrderId": "11111111-1111-1111-1111-111111111111"}}
        ]
    })

    interpret_response = json.dumps({
        "recommendation": "PO approval requires human confirmation before execution.",
        "insights": [],
        "execution_status": "pending_approval"
    })

    mock_llm = MockLLMProvider(responses=[plan_response, interpret_response])
    agent = ProcurementValidationAgent(llm_provider=mock_llm)
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.APPROVE,
        payload={"purchaseOrderId": "11111111-1111-1111-1111-111111111111"},
    )

    result = await agent.run(action, backend, approved=False)

    assert result.approval_required is True
    assert result.executed is False
    assert backend.approve_calls == []  # Not called!
    assert "human approval" in result.answer.lower() or "approval" in result.answer.lower()


@pytest.mark.asyncio
async def test_langgraph_executes_mutation_when_approved():
    """Verify approval gate: mutation executes against backend when approved=True."""
    from medistock_agents.llm.provider import MockLLMProvider
    import json

    po_id = "11111111-1111-1111-1111-111111111111"
    plan_response = json.dumps({
        "intent": "Approve purchase order",
        "plan": ["Execute approval"],
        "tool_calls": [
            {"tool": "approve_purchase_order", "args": {"purchaseOrderId": po_id}}
        ]
    })

    interpret_response = json.dumps({
        "recommendation": f"PO {po_id[:8]} approved successfully.",
        "insights": [],
        "execution_status": "success"
    })

    mock_llm = MockLLMProvider(responses=[plan_response, interpret_response])
    agent = ProcurementValidationAgent(llm_provider=mock_llm)
    backend = FakeProcurementBackend()

    action = ProcurementAction(
        action_type=ProcurementActionType.APPROVE,
        payload={"purchaseOrderId": po_id},
    )

    result = await agent.run(action, backend, approved=True)

    assert result.approval_required is True
    assert result.executed is True
    assert po_id in backend.approve_calls


# ---------------------------------------------------------------------------
# Coordinator Agent Integration Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_handle_coordinator_task_delegation():
    """Verify Procurement Agent processes delegated task from Coordinator and returns machine-readable response."""
    from medistock_agents.models.agent_models import CoordinatorTaskRequest

    agent = ProcurementValidationAgent()
    backend = FakeProcurementBackend()

    coordinator_task = CoordinatorTaskRequest(
        task_id="coord-task-789",
        source_agent="coordinator",
        intent="Inventory Agent reports Facility A may fall below minimum stock. Determine whether procurement is required.",
        facility_id="fac-001",
        medicine_id="med-1",
        quantity=250,
        context={"urgency": "high", "trigger": "low_stock_event"}
    )

    response = await agent.handle_coordinator_task(coordinator_task, backend, approved=False)

    assert response.task_id == "coord-task-789"
    assert response.intent == coordinator_task.intent
    assert isinstance(response.plan, list)
    assert response.recommendation != ""
    assert response.execution_status in {"success", "pending_approval"}
    assert response.metadata["source_agent"] == "coordinator"


def test_coordinator_endpoint_via_api():
    """Verify FastAPI /coordinator-task endpoint returns CoordinatorTaskResponse."""
    client = TestClient(app)

    response = client.post(
        "/api/procurement-agent/coordinator-task",
        json={
            "task_id": "api-task-001",
            "source_agent": "coordinator",
            "intent": "Create a procurement recommendation for 500 units of Amoxicillin for Facility B.",
            "facility_id": "fac-002",
            "medicine_id": "med-amox",
            "quantity": 500,
            "context": {"priority": "normal"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "api-task-001"
    assert "recommendation" in data
    assert "plan" in data
    assert "execution_status" in data
