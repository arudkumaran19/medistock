from __future__ import annotations

import pytest

from medistock_agents.orchestration.coordinator import CoordinatorAgent
from medistock_agents.safety.loop_guard import LoopGuard


@pytest.fixture(autouse=True)
def mock_llm_for_coordinator(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("MEDISTOCK_API_BASE_URL", "http://127.0.0.1:59999")


@pytest.mark.asyncio
async def test_coordinator_redistribution_path():
    """Verifies that when a donor facility has surplus, coordinator proposes redistribution."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Resolve critical shortage of Paracetamol at Colombo General Hospital",
        facility_id="facility-colombo-1",
        medicine_id="med-paracetamol-500",
        parameters={
            "has_donor_surplus": True,
            "donor_facility": "Kandy Base Hospital",
            "transfer_quantity": 200,
        },
    )

    assert result["intent"] in ["ShortageResolution", "StockRedistribution"]
    assert len(result["plan"]) >= 4
    assert result["requires_approval"] is True
    assert result["approval_type"] == "StockTransferApproval"
    assert "transfer" in result["final_recommendation"].lower()
    assert result["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_coordinator_procurement_fallback_path():
    """Verifies that when no donor facility is available, coordinator falls back to procurement."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Stockout detected for Amoxicillin 500mg, no donor facilities within 50km",
        facility_id="facility-galle-1",
        medicine_id="med-amoxicillin-500",
        parameters={
            "has_donor_surplus": False,
            "procurement_quantity": 1000,
            "medicine_name": "Amoxicillin 500mg",
        },
    )

    assert result["requires_approval"] is True
    assert result["approval_type"] == "PurchaseOrderApproval"
    assert result["procurement_proposal"] is not None
    assert result["procurement_proposal"]["needed"] is True
    assert "purchase order" in result["final_recommendation"].lower()
    assert result["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_coordinator_safe_degradation():
    """Verifies that unexpected parameters or errors degrade gracefully into a safe manager review."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Malformed input handling test",
        parameters=None,
    )

    assert result["requires_approval"] is True
    assert result["status"] in ["SUCCESS", "PARTIAL"]
    assert len(result["plan"]) > 0


def test_loop_guard_halts_excess_iterations():
    """Verifies that LoopGuard halts execution beyond maximum permitted iterations."""
    guard = LoopGuard(max_iterations=3)
    assert guard.step("step1") is True
    assert guard.step("step2") is True
    assert guard.step("step3") is True
    assert guard.step("step4") is False


@pytest.mark.asyncio
async def test_coordinator_azithromycin_medicine_analysis():
    """Verifies that request for Azithromycin 250 mg preserves exact strength and grounded analysis."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="demand and shortage forecast on Azithromycin 250 mg",
    )

    inv = result["inventory_data"]
    dem = result["shortage_analysis"]
    assert "Azithromycin 250 mg" in inv["medicine"]
    assert inv["unit"] == "tablet"
    assert dem["daily_consumption_rate"] == 2.5
    assert "Azithromycin" in dem["agent_findings"]
    assert any("Azithromycin 250 mg" in step for step in result["plan"])


@pytest.mark.asyncio
async def test_coordinator_paracetamol_colombo_analysis():
    """Verifies that request for Paracetamol 500mg at Colombo General Hospital resolves exact entities."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Analyze the shortage of Paracetamol 500mg at Colombo General Hospital",
    )

    inv = result["inventory_data"]
    dem = result["shortage_analysis"]
    assert "Paracetamol 500mg" in inv["medicine"]
    assert "Colombo General Hospital" in inv["facility"]
    assert dem["daily_consumption_rate"] == 20.0
    assert any("Paracetamol 500mg" in step and "Colombo General Hospital" in step for step in result["plan"])


@pytest.mark.asyncio
async def test_coordinator_amoxicillin_60_day_horizon():
    """Verifies 60-day consumption and days of supply for Amoxicillin 500mg."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Forecast the 60-day consumption and days of supply for Amoxicillin 500mg",
    )

    inv = result["inventory_data"]
    dem = result["shortage_analysis"]
    assert "Amoxicillin 500mg" in inv["medicine"]
    assert dem["forecast_horizon_days"] == 60
    assert dem["60_day_forecast_demand"] == int(14.5 * 60)
    assert "60-day demand" in dem["agent_findings"]


@pytest.mark.asyncio
async def test_initial_shortage_inquiry_does_not_create_operational_action():
    """Phase 1 & 2: Shortage inquiry presents findings & choices without premature approval card."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Critical shortage of Paracetamol 500mg at Colombo General Hospital. Audit local inventory, check regional donor hospitals, and prepare an immediate emergency transfer proposal."
    )

    assert result["intent"] == "ShortageAnalysis"
    assert result["requires_approval"] is False
    assert result["approval_type"] is None
    assert result["available_strategies"] == ["Redistribution", "Procurement", "Both", "Neither"]
    assert "No transfer or purchase order has been authorized or executed" in result["final_recommendation"]
    assert "Colombo General Hospital currently has" in result["final_recommendation"]
    assert result["redistribution_proposal"] is None
    assert result["procurement_proposal"] is None


@pytest.mark.asyncio
async def test_user_selected_redistribution_strategy():
    """Phase 4 & 5: When user selects Redistribution, only transfer proposal is prepared with approval."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Apply strategy: Redistribution. Paracetamol 500mg at Colombo General Hospital",
        facility_id="facility-colombo-1",
        medicine_id="med-paracetamol-500",
    )

    assert result["intent"] == "StockRedistribution"
    assert result["requires_approval"] is True
    assert result["approval_type"] == "StockTransferApproval"
    assert result["redistribution_proposal"] is not None
    assert result["redistribution_proposal"]["feasible"] is True
    assert result["procurement_proposal"] is None
    assert "INTER-FACILITY REDISTRIBUTION PROPOSAL" in result["final_recommendation"]


@pytest.mark.asyncio
async def test_user_selected_procurement_strategy():
    """Phase 4 & 5: When user selects Procurement, only purchase order proposal is prepared with approval."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Apply strategy: Procurement. Paracetamol 500mg at Colombo General Hospital",
        facility_id="facility-colombo-1",
        medicine_id="med-paracetamol-500",
    )

    assert result["intent"] == "AutonomousProcurement"
    assert result["requires_approval"] is True
    assert result["approval_type"] == "PurchaseOrderApproval"
    assert result["procurement_proposal"] is not None
    assert result["procurement_proposal"]["needed"] is True
    assert result["redistribution_proposal"] is None
    assert "PURCHASE ORDER PROPOSAL" in result["final_recommendation"]


@pytest.mark.asyncio
async def test_user_selected_both_strategy_prevents_double_counting():
    """Phase 4 & 5: When user selects Both, complementary quantities are prepared without double-counting."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Apply strategy: Both. Paracetamol 500mg at Colombo General Hospital",
        facility_id="facility-colombo-1",
        medicine_id="med-paracetamol-500",
    )

    assert result["intent"] == "CombinedResolution"
    assert result["requires_approval"] is True
    assert result["approval_type"] == "HybridTransferAndProcurementApproval"
    assert result["redistribution_proposal"] is not None
    assert result["procurement_proposal"] is not None
    assert "COMBINED RESOLUTION PROPOSAL" in result["final_recommendation"]


@pytest.mark.asyncio
async def test_user_selected_neither_strategy_halts_operations():
    """Phase 4: When user selects Neither, operational proposals are stopped."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Apply strategy: Neither."
    )

    assert result["intent"] == "Neither"
    assert result["requires_approval"] is False
    assert result["approval_type"] is None
    assert result["redistribution_proposal"] is None
    assert result["procurement_proposal"] is None
    assert "SHORTAGE FINDINGS RETAINED" in result["final_recommendation"]


@pytest.mark.asyncio
async def test_simple_stock_query_does_not_trigger_shortage_workflow():
    """Regression: 'What is the current stock of Paracetamol 500 mg?' must NOT
    return strategy buttons, an approval card, or a full shortage report.
    It should route to InventoryAudit and return a concise factual answer."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="What is the current stock of Paracetamol 500 mg?",
    )

    # Must classify as InventoryAudit — NOT ShortageAnalysis
    assert result["intent"] == "InventoryAudit", (
        f"Expected InventoryAudit but got {result['intent']!r}. "
        "Simple factual stock queries must not trigger the full shortage workflow."
    )
    # No approval card, no strategy buttons
    assert result["requires_approval"] is False, "Simple stock query must NOT require approval."
    assert result["approval_type"] is None, "Simple stock query must NOT have an approval type."
    assert result["available_strategies"] is None, (
        "Simple stock query must NOT return strategy selection buttons."
    )
    # No operational proposals
    assert result["redistribution_proposal"] is None
    assert result["procurement_proposal"] is None
    # Response must be non-empty
    assert result["final_recommendation"], "Response must not be empty."
    assert result["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_how_much_stock_query_is_inventory_audit():
    """Regression: 'How much stock do we have of Ibuprofen?' must route to InventoryAudit."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="How much stock do we have of Ibuprofen 200 mg at the Central Facility?",
    )

    assert result["intent"] == "InventoryAudit", (
        f"Expected InventoryAudit but got {result['intent']!r}."
    )
    assert result["requires_approval"] is False
    assert result["available_strategies"] is None
    assert result["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_demand_forecast_query_does_not_trigger_shortage_workflow():
    """Regression: A pure consumption/forecast query must route to DemandForecast,
    not ShortageAnalysis, and must NOT return strategy buttons or approval cards."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="What is the 30-day forecast demand and consumption rate for Omeprazole 20 mg?",
    )

    assert result["intent"] == "DemandForecast", (
        f"Expected DemandForecast but got {result['intent']!r}. "
        "Pure forecast queries must not escalate to ShortageAnalysis."
    )
    assert result["requires_approval"] is False
    assert result["available_strategies"] is None
    assert result["redistribution_proposal"] is None
    assert result["procurement_proposal"] is None
    assert result["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_strategy_selection_not_confused_with_stock_query():
    """Regression: 'Apply strategy: Redistribution' must still route to StockRedistribution,
    not be misclassified as InventoryAudit because 'stock' appears in the phrase."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="Apply strategy: Redistribution. Paracetamol 500mg at Colombo General Hospital",
        facility_id="facility-colombo-1",
        medicine_id="med-paracetamol-500",
    )

    # Must not be classified as InventoryAudit
    assert result["intent"] == "StockRedistribution", (
        f"Expected StockRedistribution but got {result['intent']!r}. "
        "Explicit strategy selections must not be reclassified as InventoryAudit."
    )
    assert result["requires_approval"] is True
    assert result["approval_type"] == "StockTransferApproval"


@pytest.mark.asyncio
async def test_catalogue_query_multi_medicine_stocks():
    """User story: 'What medicines are available and what are their total stocks?'
    Must route to CatalogueQuery, return a table of available medicines without
    strategy buttons, approval gates, or shortage panic."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="What medicines are available and what are their total stocks?",
    )

    assert result["intent"] == "CatalogueQuery", (
        f"Expected CatalogueQuery but got {result['intent']!r}."
    )
    assert result["requires_approval"] is False
    assert result["approval_type"] is None
    assert result["available_strategies"] is None
    assert result["redistribution_proposal"] is None
    assert result["procurement_proposal"] is None
    assert "registered medicines" in result["final_recommendation"] or "|" in result["final_recommendation"]
    assert result["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_coordinator_records_observable_execution_events():
    """Verifies that plan execution generates observable, real steps in execution_events."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="What is the current stock of Paracetamol 500 mg?",
    )

    events = result.get("execution_events", [])
    assert len(events) >= 2, "Expected observable execution events for all plan steps."
    assert events[0]["step_order"] == 1
    assert events[0]["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_llm_intent_classifier_unit():
    """Tests the LLMIntentClassifier with mock responses."""
    from medistock_agents.orchestration.intent_classifier import LLMIntentClassifier

    class MockClassifierLLM:
        async def is_available(self):
            return True

        async def generate(self, prompt, system_prompt):
            return '{"intent": "InventoryAudit", "required_agents": ["InventoryAudit"], "required_tools": ["get_stock_balance"], "plan": ["Step 1: Check stock"], "response_detail": "concise"}'

    classifier = LLMIntentClassifier(MockClassifierLLM())
    decision = await classifier.classify("What is the stock of Paracetamol?")
    assert decision is not None
    assert decision.intent == "InventoryAudit"
    assert decision.response_detail == "concise"
    assert decision.llm_used is True


@pytest.mark.asyncio
async def test_inventory_audit_amoxicillin_500mg_differentiation():
    """Regression: 'I need what's the current stock of Amoxicillin 500 mg.'
    Must route to InventoryAudit and report Amoxicillin 500 mg stock,
    NEVER silently substituting 250 mg or reporting 250 mg stock."""
    agent = CoordinatorAgent()
    result = await agent.run(
        objective="I need what's the current stock of Amoxicillin 500 mg.",
    )

    assert result["intent"] == "InventoryAudit"
    assert result["requires_approval"] is False
    assert result["available_strategies"] is None
    # Must explicitly mention 500 mg or Amoxicillin 500, never 250 mg
    rec = result["final_recommendation"].lower()
    assert "250" not in rec
    assert "amoxicillin" in rec


@pytest.mark.asyncio
async def test_inventory_audit_unknown_strength_honest_rejection():
    """If a specific strength (e.g. Amoxicillin 1250 mg) is requested that does not exist,
    the coordinator must report it honestly rather than silently substituting another strength."""
    agent = CoordinatorAgent()
    # Mock backend catalogue to contain only 250mg
    class MockBackendWithOnly250:
        async def get_medicines(self):
            return [{"id": "m1", "name": "Amoxicillin 250 mg", "category": "Antibiotic"}]
        async def get_facilities(self):
            return [{"id": "f1", "name": "Central Facility", "type": "Hospital"}]
        async def get_inventory(self):
            return []
        async def get_batches(self):
            return []

    agent.inventory_backend = MockBackendWithOnly250()
    result = await agent.run(
        objective="What is the stock of Amoxicillin 1250 mg at Central Facility?",
    )

    assert result["intent"] == "InventoryAudit"
    rec = result["final_recommendation"].lower()
    assert "not registered" in rec or "not found" in rec
    assert "amoxicillin 250" not in rec


