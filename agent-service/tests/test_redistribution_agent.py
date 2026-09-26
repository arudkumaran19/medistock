"""Unit, integration, and contract tests for Redistribution Agent and its 5 tools."""

from uuid import UUID, uuid4
import pytest
from starlette.testclient import TestClient

from medistock_agents.agents.redistribution_agent import RedistributionAgent
from medistock_agents.api.schemas import RedistributionPlanRequest
from medistock_agents.main import app
from medistock_agents.models.tool_models import FacilityInventory, FacilityLocation
from medistock_agents.tools.redistribution_tools import (
    calculateDistance,
    calculateTransferQuantity,
    clear_registries,
    getCandidateFacilities,
    getFacilityInventory,
    getFacilityLocation,
    register_facility,
    register_inventory,
)


@pytest.fixture(autouse=True)
def reset_registries():
    """Reset registry before each test."""
    clear_registries()
    yield
    clear_registries()


# ---------------------------------------------------------
# Test the 5 Required Tools Independently
# ---------------------------------------------------------


def test_tool_1_get_facility_location():
    """Tool 1: getFacilityLocation returns coordinates and metadata."""
    colombo_id = UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
    loc = getFacilityLocation(colombo_id)

    assert loc.facility_id == colombo_id
    assert loc.city == "Colombo"
    assert loc.latitude == pytest.approx(6.9271, 0.001)
    assert loc.longitude == pytest.approx(79.8612, 0.001)


def test_tool_2_get_facility_inventory():
    """Tool 2: getFacilityInventory computes available surplus correctly."""
    fid = uuid4()
    mid = uuid4()

    # Register specific stock
    inv = FacilityInventory(
        facility_id=fid,
        medicine_id=mid,
        stock_on_hand=600,
        safety_stock=100,
        reserved_stock=50,
        available_surplus=450,
    )
    register_inventory(inv)

    fetched = getFacilityInventory(fid, mid)
    assert fetched.available_surplus == 450
    assert fetched.stock_on_hand == 600
    assert fetched.safety_stock == 100
    assert fetched.reserved_stock == 50


def test_tool_3_calculate_distance():
    """Tool 3: calculateDistance computes road distance using golden Haversine."""
    colombo_id = UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
    kandy_id = UUID("b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e")

    dist_res = calculateDistance(colombo_id, kandy_id)
    assert dist_res.distance_km > 50.0  # Colombo to Kandy is ~100-130 km road distance
    assert dist_res.duration_minutes > 60.0
    assert dist_res.provider == "DeterministicHaversine"
    assert len(dist_res.route_points) == 2


def test_tool_4_calculate_transfer_quantity_caps_at_surplus():
    """Tool 4: calculateTransferQuantity caps proposed quantity at available surplus."""
    # Case 1: Shortage exceeds surplus -> capped at surplus
    res1 = calculateTransferQuantity(requested_quantity=100, available_surplus=40)
    assert res1.proposed_quantity == 40
    assert res1.shortage_satisfied_ratio == 0.4
    assert "Partially satisfied" in res1.reasoning

    # Case 2: Surplus exceeds shortage -> fully satisfied
    res2 = calculateTransferQuantity(requested_quantity=50, available_surplus=200)
    assert res2.proposed_quantity == 50
    assert res2.shortage_satisfied_ratio == 1.0
    assert "Fully satisfied" in res2.reasoning

    # Case 3: Zero surplus -> proposed 0
    res3 = calculateTransferQuantity(requested_quantity=80, available_surplus=0)
    assert res3.proposed_quantity == 0
    assert res3.shortage_satisfied_ratio == 0.0
    assert "No surplus available" in res3.reasoning


def test_tool_5_get_candidate_facilities_filters_zero_surplus():
    """Tool 5: getCandidateFacilities returns sorted candidates with surplus."""
    dest_fid = UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
    kandy_fid = UUID("b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e")
    galle_fid = UUID("c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f")
    med_id = uuid4()

    # Seed Kandy with positive surplus
    register_inventory(
        FacilityInventory(
            facility_id=kandy_fid,
            medicine_id=med_id,
            stock_on_hand=500,
            safety_stock=100,
            reserved_stock=0,
            available_surplus=400,
        )
    )

    # Seed Galle with 0 surplus
    register_inventory(
        FacilityInventory(
            facility_id=galle_fid,
            medicine_id=med_id,
            stock_on_hand=80,
            safety_stock=100,
            reserved_stock=0,
            available_surplus=0,
        )
    )

    candidates = getCandidateFacilities(
        destination_facility_id=dest_fid,
        medicine_id=med_id,
        shortage_quantity=50,
        known_facilities=[kandy_fid, galle_fid],
    )

    # Galle must be excluded because available_surplus is 0
    assert len(candidates) == 1
    assert candidates[0].facility_id == kandy_fid
    assert candidates[0].available_surplus == 400


# ---------------------------------------------------------
# Test LangGraph Redistribution Agent Workflow
# ---------------------------------------------------------


@pytest.mark.asyncio
async def test_langgraph_redistribution_agent_full_cycle():
    """Verify LangGraph StateGraph executes all nodes and logs tool calls."""
    agent = RedistributionAgent()

    dest_id = UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
    med_id = uuid4()

    request = RedistributionPlanRequest(
        workflow_run_id=uuid4(),
        destination_facility_id=dest_id,
        medicine_id=med_id,
        shortage_quantity=60,
        additional_context="Urgent oncology shortage",
    )

    response = await agent.plan_redistribution(request)

    assert response.success is True
    assert response.selected_facility_id is not None
    assert response.proposed_quantity > 0
    assert response.distance_km > 0.0
    assert response.duration_minutes > 0.0
    assert len(response.reasoning) > 10

    # Ensure all required tools were logged in the audit trail
    tool_names = [tc.tool_name for tc in response.tool_calls]
    assert "getFacilityLocation" in tool_names
    assert "getCandidateFacilities" in tool_names
    assert "getFacilityInventory" in tool_names
    assert "calculateDistance" in tool_names
    assert "calculateTransferQuantity" in tool_names


# ---------------------------------------------------------
# Test FastAPI Endpoints (Standalone & Gateway Contract)
# ---------------------------------------------------------


def test_api_health_endpoint():
    """Verify GET /health returns 200 and healthy status."""
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "medistock-agent-service"


def test_api_plan_endpoint_consumable_by_agent_gateway():
    """Verify POST /api/agents/redistribution/plan returns camelCase JSON for AgentGateway."""
    client = TestClient(app)
    dest_id = str(uuid4())
    med_id = str(uuid4())
    wf_id = str(uuid4())

    payload = {
        "workflowRunId": wf_id,
        "destinationFacilityId": dest_id,
        "medicineId": med_id,
        "shortageQuantity": 75,
        "additionalContext": "Routine restocking",
    }

    res = client.post("/api/agents/redistribution/plan", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Verify AgentGateway.cs contract properties
    assert "success" in data and data["success"] is True
    assert "selectedFacilityId" in data and data["selectedFacilityId"] is not None
    assert "selectedFacilityName" in data and isinstance(data["selectedFacilityName"], str)
    assert "proposedQuantity" in data and data["proposedQuantity"] > 0
    assert "distanceKm" in data and isinstance(data["distanceKm"], (int, float))
    assert "durationMinutes" in data and isinstance(data["durationMinutes"], (int, float))
    assert "provider" in data
    assert "reasoning" in data
    assert "toolCalls" in data and len(data["toolCalls"]) >= 4


@pytest.mark.asyncio
async def test_langgraph_redistribution_agent_partial_allocation():
    """Verify proposed quantity is capped when shortage exceeds available surplus."""
    agent = RedistributionAgent()
    dest_fid = UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
    src_fid = UUID("b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e")
    med_id = uuid4()

    # Seed source facility with only 35 units available surplus
    register_inventory(
        FacilityInventory(
            facility_id=src_fid,
            medicine_id=med_id,
            stock_on_hand=135,
            safety_stock=100,
            reserved_stock=0,
            available_surplus=35,
        )
    )
    # Seed remaining facilities with zero surplus
    for other_fid_str in ["c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f", "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a"]:
        register_inventory(
            FacilityInventory(
                facility_id=UUID(other_fid_str),
                medicine_id=med_id,
                stock_on_hand=100,
                safety_stock=100,
                reserved_stock=0,
                available_surplus=0,
            )
        )

    request = RedistributionPlanRequest(
        workflow_run_id=uuid4(),
        destination_facility_id=dest_fid,
        medicine_id=med_id,
        shortage_quantity=100,  # Shortage exceeds surplus
    )

    response = await agent.plan_redistribution(request)
    assert response.success is True
    assert response.proposed_quantity == 35  # Strictly capped at 35
    assert "partial allocation" in response.reasoning.lower()


def test_internal_cors_origin_boundary():
    """Verify service strictly permits internal backend and restricts untrusted origins."""
    client = TestClient(app)
    # Permitted internal ASP.NET Core origin
    allowed_resp = client.options(
        "/api/agents/redistribution/plan",
        headers={"Origin": "http://localhost:5000", "Access-Control-Request-Method": "POST"},
    )
    assert allowed_resp.headers.get("access-control-allow-origin") == "http://localhost:5000"

    # Untrusted external client origin (e.g., direct web client)
    untrusted_resp = client.options(
        "/api/agents/redistribution/plan",
        headers={"Origin": "http://untrusted-client.com", "Access-Control-Request-Method": "POST"},
    )
    assert untrusted_resp.headers.get("access-control-allow-origin") is None

