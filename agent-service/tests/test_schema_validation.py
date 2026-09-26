"""Contract tests for frozen agent schemas and validation rules."""

import json
from uuid import UUID, uuid4
import pytest
from pydantic import ValidationError

from medistock_agents.api.schemas import (
    HealthResponse,
    RedistributionPlanRequest,
    RedistributionPlanResponse,
)
from medistock_agents.models.tool_models import (
    CandidateFacility,
    FacilityInventory,
    FacilityLocation,
    QuantityCalculationResult,
    ToolExecutionRecord,
)


def test_plan_request_valid_camel_case_deserialization():
    """Verify ASP.NET Core AgentGateway JSON payload matches request schema."""
    wf_id = str(uuid4())
    dst_id = str(uuid4())
    med_id = str(uuid4())

    json_payload = {
        "workflowRunId": wf_id,
        "destinationFacilityId": dst_id,
        "medicineId": med_id,
        "shortageQuantity": 150,
        "additionalContext": "Urgent ICU shortage",
    }

    req = RedistributionPlanRequest.model_validate(json_payload)
    assert req.workflow_run_id == UUID(wf_id)
    assert req.destination_facility_id == UUID(dst_id)
    assert req.medicine_id == UUID(med_id)
    assert req.shortage_quantity == 150
    assert req.additional_context == "Urgent ICU shortage"


def test_plan_request_rejects_non_uuid():
    """Verify invalid UUID strings are rejected."""
    with pytest.raises(ValidationError):
        RedistributionPlanRequest(
            workflow_run_id="not-a-valid-uuid",  # type: ignore
            destination_facility_id=uuid4(),
            medicine_id=uuid4(),
            shortage_quantity=10,
        )


def test_plan_request_rejects_negative_or_zero_shortage():
    """Verify non-positive shortage quantities are rejected."""
    with pytest.raises(ValidationError):
        RedistributionPlanRequest(
            workflow_run_id=uuid4(),
            destination_facility_id=uuid4(),
            medicine_id=uuid4(),
            shortage_quantity=0,
        )

    with pytest.raises(ValidationError):
        RedistributionPlanRequest(
            workflow_run_id=uuid4(),
            destination_facility_id=uuid4(),
            medicine_id=uuid4(),
            shortage_quantity=-25,
        )


def test_plan_response_serialization_matches_agent_gateway_contract():
    """Verify serialized response matches AgentGateway.cs JSON property names."""
    sel_id = uuid4()
    resp = RedistributionPlanResponse(
        success=True,
        selected_facility_id=sel_id,
        selected_facility_name="National Hospital Colombo",
        proposed_quantity=75,
        distance_km=14.8,
        duration_minutes=19.7,
        provider="LangGraphRedistributionAgent",
        reasoning="Optimal surplus source selected.",
        prompt_tokens=280,
        completion_tokens=95,
        execution_time_ms=42,
        tool_calls=[
            ToolExecutionRecord(
                tool_name="getCandidateFacilities",
                arguments='{"dest": "..."}',
                result='{"count": 3}',
                duration_ms=15,
                success=True,
            )
        ],
    )

    serialized = resp.model_dump(by_alias=True)
    json_str = resp.model_dump_json(by_alias=True)
    json_obj = json.loads(json_str)

    # Check required camelCase keys expected by AgentGateway.cs
    assert "selectedFacilityId" in json_obj
    assert json_obj["selectedFacilityId"] == str(sel_id)
    assert "selectedFacilityName" in json_obj
    assert json_obj["selectedFacilityName"] == "National Hospital Colombo"
    assert "proposedQuantity" in json_obj
    assert json_obj["proposedQuantity"] == 75
    assert "distanceKm" in json_obj
    assert json_obj["distanceKm"] == 14.8
    assert "durationMinutes" in json_obj
    assert json_obj["durationMinutes"] == 19.7
    assert "provider" in json_obj
    assert json_obj["provider"] == "LangGraphRedistributionAgent"
    assert "reasoning" in json_obj
    assert "promptTokens" in json_obj
    assert "completionTokens" in json_obj
    assert "executionTimeMs" in json_obj
    assert "toolCalls" in json_obj
    assert len(json_obj["toolCalls"]) == 1
    assert json_obj["toolCalls"][0]["toolName"] == "getCandidateFacilities"


def test_inventory_surplus_formula():
    """Surplus formula = max(0, stockOnHand - safetyStock - reservedStock)."""
    assert FacilityInventory.calculate_surplus(500, 100, 50) == 350
    assert FacilityInventory.calculate_surplus(100, 100, 0) == 0
    assert FacilityInventory.calculate_surplus(80, 100, 10) == 0  # Below safety stock
    assert FacilityInventory.calculate_surplus(150, 100, 70) == 0  # Exceeds surplus by reservations


def test_health_response_schema():
    """Verify health response format."""
    health = HealthResponse()
    assert health.status == "healthy"
    assert health.service == "medistock-agent-service"
    assert health.version == "1.0.0"
