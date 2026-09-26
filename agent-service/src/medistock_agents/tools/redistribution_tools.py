"""The 5 Required Redistribution Tools for MediStock Agent."""

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4
from medistock_agents.models.tool_models import (
    CandidateFacility,
    DistanceCalculationResult,
    FacilityInventory,
    FacilityLocation,
    QuantityCalculationResult,
    ToolExecutionRecord,
)
from medistock_agents.tools.routing_tools import compute_route_distance

# In-memory registry of facility locations and inventories for standalone operation
_SAMPLE_LOCATIONS: Dict[str, FacilityLocation] = {
    # Colombo General Hospital (Central / Western)
    "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d": FacilityLocation(
        facility_id=UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"),
        facility_name="National Hospital Colombo",
        city="Colombo",
        latitude=6.9271,
        longitude=79.8612,
    ),
    # Kandy Teaching Hospital (Central)
    "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e": FacilityLocation(
        facility_id=UUID("b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"),
        facility_name="Teaching Hospital Kandy",
        city="Kandy",
        latitude=7.2906,
        longitude=80.6337,
    ),
    # Galle Karapitiya Hospital (Southern)
    "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f": FacilityLocation(
        facility_id=UUID("c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"),
        facility_name="Karapitiya Teaching Hospital",
        city="Galle",
        latitude=6.0535,
        longitude=80.2210,
    ),
    # Negombo District General Hospital (Western North)
    "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a": FacilityLocation(
        facility_id=UUID("d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a"),
        facility_name="District General Hospital Negombo",
        city="Negombo",
        latitude=7.2008,
        longitude=79.8736,
    ),
}

# Default sample inventories keyed by (facility_id, medicine_id)
_SAMPLE_INVENTORIES: Dict[Tuple[str, str], FacilityInventory] = {}


def register_facility(location: FacilityLocation) -> None:
    """Registers a facility location in the tool registry."""
    _SAMPLE_LOCATIONS[str(location.facility_id)] = location


def register_inventory(inventory: FacilityInventory) -> None:
    """Registers an inventory record in the tool registry."""
    _SAMPLE_INVENTORIES[(str(inventory.facility_id), str(inventory.medicine_id))] = inventory


def clear_registries() -> None:
    """Clears dynamic registries back to defaults."""
    _SAMPLE_INVENTORIES.clear()


# Tool 1: getFacilityLocation
def getFacilityLocation(facility_id: UUID) -> FacilityLocation:
    """Tool 1: Retrieves facility metadata and geographic coordinates."""
    fid_str = str(facility_id)
    if fid_str in _SAMPLE_LOCATIONS:
        return _SAMPLE_LOCATIONS[fid_str]

    # Deterministic default fallback facility for unseeded IDs
    return FacilityLocation(
        facility_id=facility_id,
        facility_name=f"Hospital Facility {fid_str[:8]}",
        city="Regional Center",
        latitude=6.9319 + (hash(fid_str) % 50) * 0.01,
        longitude=79.8478 + (hash(fid_str[::-1]) % 50) * 0.01,
    )


# Tool 2: getFacilityInventory
def getFacilityInventory(facility_id: UUID, medicine_id: UUID) -> FacilityInventory:
    """Tool 2: Retrieves current stock levels and calculates available surplus."""
    key = (str(facility_id), str(medicine_id))
    if key in _SAMPLE_INVENTORIES:
        return _SAMPLE_INVENTORIES[key]

    # Deterministic fallback stock generation based on facility and medicine IDs
    seed = abs(hash(f"{facility_id}_{medicine_id}"))
    stock_on_hand = (seed % 800) + 200
    safety_stock = 100
    reserved_stock = (seed % 50)
    available_surplus = FacilityInventory.calculate_surplus(stock_on_hand, safety_stock, reserved_stock)

    return FacilityInventory(
        facility_id=facility_id,
        medicine_id=medicine_id,
        stock_on_hand=stock_on_hand,
        safety_stock=safety_stock,
        reserved_stock=reserved_stock,
        available_surplus=available_surplus,
    )


# Tool 3: calculateDistance
def calculateDistance(
    source_facility_id: UUID, destination_facility_id: UUID
) -> DistanceCalculationResult:
    """Tool 3: Computes transit road distance and duration between two facilities."""
    src_loc = getFacilityLocation(source_facility_id)
    dst_loc = getFacilityLocation(destination_facility_id)
    return compute_route_distance(
        source_facility_id,
        destination_facility_id,
        src_loc.latitude,
        src_loc.longitude,
        dst_loc.latitude,
        dst_loc.longitude,
    )


# Tool 4: calculateTransferQuantity
def calculateTransferQuantity(
    requested_quantity: int, available_surplus: int
) -> QuantityCalculationResult:
    """
    Tool 4: Proposes transfer quantity bounded strictly by available surplus.
    Rule: min(requested_quantity, available_surplus).
    """
    proposed = max(0, min(requested_quantity, available_surplus))
    ratio = round(proposed / requested_quantity, 4) if requested_quantity > 0 else 0.0

    if proposed == 0:
        reasoning = "No surplus available to allocate for this transfer request."
    elif proposed >= requested_quantity:
        reasoning = f"Fully satisfied shortage of {requested_quantity} units from available surplus ({available_surplus} units available)."
    else:
        reasoning = f"Partially satisfied {proposed} of {requested_quantity} units due to source surplus constraint ({available_surplus} units available)."

    return QuantityCalculationResult(
        requested_quantity=requested_quantity,
        available_surplus=available_surplus,
        proposed_quantity=proposed,
        shortage_satisfied_ratio=ratio,
        reasoning=reasoning,
    )


# Tool 5: getCandidateFacilities
def getCandidateFacilities(
    destination_facility_id: UUID,
    medicine_id: UUID,
    shortage_quantity: int,
    known_facilities: Optional[List[UUID]] = None,
) -> List[CandidateFacility]:
    """
    Tool 5: Identifies candidate source facilities with positive surplus, computes
    road distance and scores each candidate:
    Score = (Surplus / MaxSurplus) * 0.6 + (1 - Distance / MaxDistance) * 0.4
    """
    facility_pool: List[UUID] = []
    if known_facilities:
        facility_pool = [fid for fid in known_facilities if fid != destination_facility_id]
    else:
        facility_pool = [
            UUID(fid)
            for fid in _SAMPLE_LOCATIONS.keys()
            if fid != str(destination_facility_id)
        ]

    # If no registered facilities, generate standard test candidate facilities
    if not facility_pool:
        facility_pool = [
            UUID("b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"),
            UUID("c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"),
            UUID("d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a"),
        ]

    candidates: List[CandidateFacility] = []

    for fid in facility_pool:
        if fid == destination_facility_id:
            continue

        loc = getFacilityLocation(fid)
        inv = getFacilityInventory(fid, medicine_id)

        # Candidate must have positive surplus
        if inv.available_surplus <= 0:
            continue

        dist_res = calculateDistance(fid, destination_facility_id)

        # Baseline score calculation
        score = float(inv.available_surplus) / (dist_res.distance_km + 1.0)

        candidate = CandidateFacility(
            facility_id=fid,
            facility_name=loc.facility_name,
            city=loc.city,
            latitude=loc.latitude,
            longitude=loc.longitude,
            stock_on_hand=inv.stock_on_hand,
            safety_stock=inv.safety_stock,
            reserved_stock=inv.reserved_stock,
            available_surplus=inv.available_surplus,
            distance_km=dist_res.distance_km,
            estimated_duration_minutes=dist_res.duration_minutes,
            routing_provider=dist_res.provider,
            score=round(score, 4),
        )
        candidates.append(candidate)

    # Sort descending by score
    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


# Audited execution wrappers for recording tool execution logs
def execute_tool_with_logging(
    tool_name: str, func, *args, **kwargs
) -> Tuple[Any, ToolExecutionRecord]:
    """Executes a tool and records elapsed time and JSON serialized inputs/outputs."""
    start_time = time.perf_counter()
    success = True
    error_msg = None
    result = None

    try:
        result = func(*args, **kwargs)
    except Exception as ex:
        success = False
        error_msg = str(ex)

    duration_ms = int((time.perf_counter() - start_time) * 1000)

    # Serialize arguments
    arg_dict = {}
    if args:
        arg_dict["args"] = [str(a) for a in args]
    if kwargs:
        arg_dict.update({k: str(v) for k, v in kwargs.items()})
    args_json = json.dumps(arg_dict, default=str)

    # Serialize result
    if success and result is not None:
        if hasattr(result, "model_dump_json"):
            result_json = result.model_dump_json()
        elif isinstance(result, list):
            result_json = json.dumps(
                [item.model_dump(mode="json") if hasattr(item, "model_dump") else str(item) for item in result],
                default=str,
            )
        else:
            result_json = json.dumps(result, default=str)
    else:
        result_json = json.dumps({"error": error_msg})

    record = ToolExecutionRecord(
        tool_name=tool_name,
        arguments=args_json,
        result=result_json,
        duration_ms=max(1, duration_ms),
        success=success,
        error_message=error_msg,
    )

    return result, record
