"""Frozen tool data models for MediStock Redistribution Agent."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class FacilityLocation(BaseModel):
    """Geographic location and metadata of a healthcare facility."""
    model_config = ConfigDict(populate_by_name=True)

    facility_id: UUID = Field(..., alias="facilityId")
    facility_name: str = Field(..., alias="facilityName")
    city: str
    latitude: float
    longitude: float


class FacilityInventory(BaseModel):
    """Stock levels and calculated surplus for a medicine at a facility."""
    model_config = ConfigDict(populate_by_name=True)

    facility_id: UUID = Field(..., alias="facilityId")
    medicine_id: UUID = Field(..., alias="medicineId")
    stock_on_hand: int = Field(..., ge=0, alias="stockOnHand")
    safety_stock: int = Field(..., ge=0, alias="safetyStock")
    reserved_stock: int = Field(..., ge=0, alias="reservedStock")
    available_surplus: int = Field(..., alias="availableSurplus")

    @classmethod
    def calculate_surplus(cls, stock_on_hand: int, safety_stock: int, reserved_stock: int) -> int:
        """Surplus is stock beyond safety threshold and active reservations."""
        return max(0, stock_on_hand - safety_stock - reserved_stock)


class CandidateFacility(BaseModel):
    """A scored candidate source facility for redistribution."""
    model_config = ConfigDict(populate_by_name=True)

    facility_id: UUID = Field(..., alias="facilityId")
    facility_name: str = Field(..., alias="facilityName")
    city: str
    latitude: float
    longitude: float
    stock_on_hand: int = Field(..., alias="stockOnHand")
    safety_stock: int = Field(..., alias="safetyStock")
    reserved_stock: int = Field(..., alias="reservedStock")
    available_surplus: int = Field(..., alias="availableSurplus")
    distance_km: float = Field(..., alias="distanceKm")
    estimated_duration_minutes: float = Field(..., alias="estimatedDurationMinutes")
    routing_provider: str = Field("DeterministicHaversine", alias="routingProvider")
    score: float = Field(..., alias="score")


class DistanceCalculationResult(BaseModel):
    """Calculated transit distance and duration between two facilities."""
    model_config = ConfigDict(populate_by_name=True)

    source_facility_id: UUID = Field(..., alias="sourceFacilityId")
    destination_facility_id: UUID = Field(..., alias="destinationFacilityId")
    distance_km: float = Field(..., ge=0.0, alias="distanceKm")
    duration_minutes: float = Field(..., ge=0.0, alias="durationMinutes")
    provider: str
    route_points: List[List[float]] = Field(default_factory=list, alias="routePoints")


class QuantityCalculationResult(BaseModel):
    """Transfer quantity recommendation bounded strictly by surplus."""
    model_config = ConfigDict(populate_by_name=True)

    requested_quantity: int = Field(..., gt=0, alias="requestedQuantity")
    available_surplus: int = Field(..., ge=0, alias="availableSurplus")
    proposed_quantity: int = Field(..., ge=0, alias="proposedQuantity")
    shortage_satisfied_ratio: float = Field(..., alias="shortageSatisfiedRatio")
    reasoning: str


class ToolExecutionRecord(BaseModel):
    """Audit log of an individual tool execution by the agent."""
    model_config = ConfigDict(populate_by_name=True)

    tool_name: str = Field(..., alias="toolName")
    arguments: str
    result: str
    duration_ms: int = Field(..., ge=0, alias="durationMs")
    success: bool
    error_message: Optional[str] = Field(None, alias="errorMessage")
