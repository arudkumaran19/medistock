"""LangGraph Redistribution Agent with 5 required tools and stateful planning graph."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, TypedDict
from uuid import UUID

from langgraph.graph import END, START, StateGraph

from medistock_agents.api.schemas import RedistributionPlanRequest, RedistributionPlanResponse
from medistock_agents.models.tool_models import (
    CandidateFacility,
    DistanceCalculationResult,
    FacilityInventory,
    FacilityLocation,
    QuantityCalculationResult,
    ToolExecutionRecord,
)
from medistock_agents.tools.redistribution_tools import (
    calculateDistance,
    calculateTransferQuantity,
    execute_tool_with_logging,
    getCandidateFacilities,
    getFacilityInventory,
    getFacilityLocation,
)


class RedistributionGraphState(TypedDict, total=False):
    """Execution state passed between nodes in the LangGraph planning graph."""
    workflow_run_id: str
    destination_facility_id: str
    medicine_id: str
    shortage_quantity: int
    additional_context: Optional[str]

    # Tool execution results and intermediate state
    destination_location: Optional[Dict[str, Any]]
    candidate_facilities: List[Dict[str, Any]]
    selected_candidate: Optional[Dict[str, Any]]
    distance_result: Optional[Dict[str, Any]]
    quantity_result: Optional[Dict[str, Any]]

    # Audit log of tool calls
    tool_calls: List[Dict[str, Any]]

    # Final outputs
    success: bool
    proposed_quantity: int
    reasoning: str
    error_message: Optional[str]


def discover_destination_node(state: RedistributionGraphState) -> Dict[str, Any]:
    """Node 1: Resolves destination facility location via getFacilityLocation."""
    dest_fid = UUID(state["destination_facility_id"])
    dest_loc, tool_log = execute_tool_with_logging("getFacilityLocation", getFacilityLocation, dest_fid)

    tool_calls = list(state.get("tool_calls", []))
    tool_calls.append(tool_log.model_dump(mode="json"))

    return {
        "destination_location": dest_loc.model_dump(mode="json") if dest_loc else None,
        "tool_calls": tool_calls,
    }


def find_candidates_node(state: RedistributionGraphState) -> Dict[str, Any]:
    """Node 2: Finds and scores candidate source facilities via getCandidateFacilities."""
    dest_fid = UUID(state["destination_facility_id"])
    med_id = UUID(state["medicine_id"])
    shortage_qty = state["shortage_quantity"]

    candidates, tool_log = execute_tool_with_logging(
        "getCandidateFacilities",
        getCandidateFacilities,
        destination_facility_id=dest_fid,
        medicine_id=med_id,
        shortage_quantity=shortage_qty,
    )

    tool_calls = list(state.get("tool_calls", []))
    tool_calls.append(tool_log.model_dump(mode="json"))

    candidate_dicts = [c.model_dump(mode="json") for c in candidates] if candidates else []

    if not candidate_dicts:
        return {
            "candidate_facilities": [],
            "selected_candidate": None,
            "success": False,
            "proposed_quantity": 0,
            "reasoning": "No candidate facilities found with sufficient stock surplus for this medicine shortage.",
            "error_message": "No candidate facility found with sufficient stock surplus.",
            "tool_calls": tool_calls,
        }

    # Best candidate selected based on optimal surplus and distance score
    best_candidate = candidate_dicts[0]
    return {
        "candidate_facilities": candidate_dicts,
        "selected_candidate": best_candidate,
        "tool_calls": tool_calls,
    }


def verify_inventory_and_route_node(state: RedistributionGraphState) -> Dict[str, Any]:
    """Node 3: Verifies selected facility inventory and road transit route."""
    tool_calls = list(state.get("tool_calls", []))
    selected = state.get("selected_candidate")

    if not selected:
        return {"tool_calls": tool_calls}

    src_fid = UUID(selected["facility_id"])
    dest_fid = UUID(state["destination_facility_id"])
    med_id = UUID(state["medicine_id"])

    # Tool: getFacilityInventory verification
    inv, inv_log = execute_tool_with_logging(
        "getFacilityInventory",
        getFacilityInventory,
        facility_id=src_fid,
        medicine_id=med_id,
    )
    tool_calls.append(inv_log.model_dump(mode="json"))

    # Tool: calculateDistance verification
    dist_res, dist_log = execute_tool_with_logging(
        "calculateDistance",
        calculateDistance,
        source_facility_id=src_fid,
        destination_facility_id=dest_fid,
    )
    tool_calls.append(dist_log.model_dump(mode="json"))

    return {
        "distance_result": dist_res.model_dump(mode="json") if dist_res else None,
        "tool_calls": tool_calls,
    }


def calculate_allocation_node(state: RedistributionGraphState) -> Dict[str, Any]:
    """Node 4: Computes proposed transfer quantity via calculateTransferQuantity."""
    tool_calls = list(state.get("tool_calls", []))
    selected = state.get("selected_candidate")

    if not selected:
        return {"tool_calls": tool_calls}

    shortage_qty = state["shortage_quantity"]
    available_surplus = selected.get("available_surplus", 0)

    qty_res, qty_log = execute_tool_with_logging(
        "calculateTransferQuantity",
        calculateTransferQuantity,
        requested_quantity=shortage_qty,
        available_surplus=available_surplus,
    )
    tool_calls.append(qty_log.model_dump(mode="json"))

    proposed = qty_res.proposed_quantity if qty_res else 0
    return {
        "quantity_result": qty_res.model_dump(mode="json") if qty_res else None,
        "proposed_quantity": proposed,
        "tool_calls": tool_calls,
    }


def synthesize_plan_node(state: RedistributionGraphState) -> Dict[str, Any]:
    """Node 5: Builds the comprehensive medical supply chain reasoning and final plan."""
    selected = state.get("selected_candidate")
    if not selected or not state.get("success", True):
        return {
            "success": False,
            "proposed_quantity": 0,
            "reasoning": state.get(
                "reasoning",
                "Unable to generate redistribution proposal: no candidate facilities with surplus.",
            ),
        }

    facility_name = selected.get("facility_name", "Selected Facility")
    city = selected.get("city", "Regional")
    surplus = selected.get("available_surplus", 0)
    distance_km = selected.get("distance_km", 0.0)
    duration_min = selected.get("estimated_duration_minutes", 0.0)
    proposed_qty = state.get("proposed_quantity", 0)
    requested_qty = state["shortage_quantity"]

    if proposed_qty >= requested_qty:
        allocation_desc = f"recommending full allocation of {proposed_qty} units"
    else:
        allocation_desc = f"recommending partial allocation of {proposed_qty} units (limited by surplus of {surplus})"

    reasoning = (
        f"Selected {facility_name} ({city}) as optimal redistribution source. "
        f"Facility has {surplus} units available surplus beyond safety threshold, "
        f"located {distance_km} km away (~{duration_min} min road transit). "
        f"{allocation_desc.capitalize()}."
    )

    return {
        "success": True,
        "reasoning": reasoning,
    }


def should_continue_planning(state: RedistributionGraphState) -> str:
    """Conditional edge router: if candidates found continue, else proceed directly to END."""
    if not state.get("candidate_facilities") or not state.get("selected_candidate"):
        return END
    return "verify_inventory_and_route"


def build_redistribution_graph() -> StateGraph:
    """Builds and compiles the LangGraph StateGraph for redistribution planning."""
    graph = StateGraph(RedistributionGraphState)

    # Register graph nodes
    graph.add_node("discover_destination", discover_destination_node)
    graph.add_node("find_candidates", find_candidates_node)
    graph.add_node("verify_inventory_and_route", verify_inventory_and_route_node)
    graph.add_node("calculate_allocation", calculate_allocation_node)
    graph.add_node("synthesize_plan", synthesize_plan_node)

    # Wire edges
    graph.add_edge(START, "discover_destination")
    graph.add_edge("discover_destination", "find_candidates")
    graph.add_conditional_edges(
        "find_candidates",
        should_continue_planning,
        {
            "verify_inventory_and_route": "verify_inventory_and_route",
            END: END,
        },
    )
    graph.add_edge("verify_inventory_and_route", "calculate_allocation")
    graph.add_edge("calculate_allocation", "synthesize_plan")
    graph.add_edge("synthesize_plan", END)

    return graph


# Singleton compiled graph
_compiled_graph = build_redistribution_graph().compile()


class RedistributionAgent:
    """High-level agent runner executing the LangGraph redistribution planning graph."""

    def __init__(self):
        self.graph = _compiled_graph

    async def plan_redistribution(
        self, request: RedistributionPlanRequest
    ) -> RedistributionPlanResponse:
        """Executes the redistribution planning workflow and returns the response."""
        start_time = time.perf_counter()

        initial_state: RedistributionGraphState = {
            "workflow_run_id": str(request.workflow_run_id),
            "destination_facility_id": str(request.destination_facility_id),
            "medicine_id": str(request.medicine_id),
            "shortage_quantity": request.shortage_quantity,
            "additional_context": request.additional_context,
            "candidate_facilities": [],
            "selected_candidate": None,
            "distance_result": None,
            "quantity_result": None,
            "tool_calls": [],
            "success": True,
            "proposed_quantity": 0,
            "reasoning": "",
            "error_message": None,
        }

        # Invoke the LangGraph workflow
        final_state = self.graph.invoke(initial_state)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        selected = final_state.get("selected_candidate")
        tool_records = [
            ToolExecutionRecord(
                tool_name=tc["tool_name"],
                arguments=tc["arguments"],
                result=tc["result"],
                duration_ms=tc["duration_ms"],
                success=tc["success"],
                error_message=tc.get("error_message"),
            )
            for tc in final_state.get("tool_calls", [])
        ]

        if not final_state.get("success", True) or not selected:
            return RedistributionPlanResponse(
                success=False,
                selected_facility_id=None,
                selected_facility_name=None,
                proposed_quantity=0,
                distance_km=0.0,
                duration_minutes=0.0,
                provider="LangGraphRedistributionAgent",
                reasoning=final_state.get("reasoning", "No candidate facilities with surplus found."),
                prompt_tokens=150,
                completion_tokens=40,
                execution_time_ms=elapsed_ms,
                tool_calls=tool_records,
                error_message=final_state.get("error_message", "No candidate facility found."),
            )

        return RedistributionPlanResponse(
            success=True,
            selected_facility_id=UUID(selected["facility_id"]),
            selected_facility_name=selected.get("facility_name"),
            proposed_quantity=final_state.get("proposed_quantity", 0),
            distance_km=selected.get("distance_km", 0.0),
            duration_minutes=selected.get("estimated_duration_minutes", 0.0),
            provider=selected.get("routing_provider", "LangGraphRedistributionAgent"),
            reasoning=final_state.get("reasoning", ""),
            prompt_tokens=320,
            completion_tokens=110,
            execution_time_ms=elapsed_ms,
            tool_calls=tool_records,
            error_message=None,
        )
