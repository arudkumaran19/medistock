"""Routing calculation tool utilizing deterministic Haversine distance with winding factor."""

from __future__ import annotations

import math
from typing import List, Tuple
from uuid import UUID
from medistock_agents.models.tool_models import DistanceCalculationResult


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> Tuple[float, float]:
    """
    Calculates road distance and duration using golden Haversine formula:
    - Earth radius: 6371.0 km
    - Road winding factor: 1.25x
    - Average transit speed: 45.0 km/h
    """
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    r_lat1 = math.radians(lat1)
    r_lat2 = math.radians(lat2)

    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(r_lat1) * math.cos(r_lat2) * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    crow_flies_km = earth_radius_km * c

    road_distance_km = round(crow_flies_km * 1.25, 2)
    duration_minutes = round((road_distance_km / 45.0) * 60.0, 1)

    return road_distance_km, duration_minutes


def compute_route_distance(
    source_facility_id: UUID,
    destination_facility_id: UUID,
    src_lat: float,
    src_lon: float,
    dst_lat: float,
    dst_lon: float,
) -> DistanceCalculationResult:
    """Computes transit distance and duration between two facilities."""
    dist_km, dur_min = calculate_haversine_distance(src_lat, src_lon, dst_lat, dst_lon)
    return DistanceCalculationResult(
        source_facility_id=source_facility_id,
        destination_facility_id=destination_facility_id,
        distance_km=dist_km,
        duration_minutes=dur_min,
        provider="DeterministicHaversine",
        route_points=[[src_lon, src_lat], [dst_lon, dst_lat]],
    )
