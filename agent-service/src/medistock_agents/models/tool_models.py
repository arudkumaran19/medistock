"""Frozen tool data models for MediStock Redistribution Agent."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel


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

"""Frozen controlled-tool request and response contract.

SHARED CONTRACT - primary owner: ILHAM MM (IT24103530).

Placeholder created by the Demand & Shortage vertical (Sathurstiga S., IT24103156)
only so the demand tools can be implemented and tested against the frozen schema.
Replace with the owner's implementation on integration.

Tools never reach PostgreSQL directly. Every call goes through an ASP.NET Core
internal tool endpoint, which applies authorization and the authoritative business
rules before returning a structured result (blueprint section 38)::

    AI -> tool request -> ASP.NET -> authorization -> business service
       -> database -> structured result -> AI
"""

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class ToolCall(CamelModel):
    """A request from an agent to run one controlled tool."""

    tool: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolResult(CamelModel):
    """The outcome of one controlled tool call."""

    tool: str
    status: Literal["SUCCESS", "FAILURE"]
    data: dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None

    @property
    def succeeded(self) -> bool:
        return self.status == "SUCCESS"


# ---------------------------------------------------------------------------
# Demand & Shortage tool payloads - Sathurstiga S. (IT24103156)
# ---------------------------------------------------------------------------


class ConsumptionHistoryEntry(CamelModel):
    """One day of recorded consumption."""

    consumption_date: date
    quantity_used: float


class ConsumptionHistoryResult(CamelModel):
    """Result of getConsumptionHistory."""

    facility_id: str
    medicine_id: str
    window_days: int
    entries: list[ConsumptionHistoryEntry] = Field(default_factory=list)


class DailyConsumptionResult(CamelModel):
    """Result of calculateDailyConsumption."""

    facility_id: str
    medicine_id: str
    window_days: int
    average_daily_consumption: float


class ForecastResult(CamelModel):
    """Result of calculateForecast."""

    forecast_id: str | None = None
    facility_id: str
    medicine_id: str
    method: str
    window_days: int
    horizon_days: int
    average_daily_consumption: float
    predicted_demand: float
    confidence_score: float
    lead_time_days: int


class ProjectedStockoutResult(CamelModel):
    """Result of calculateProjectedStockout."""

    facility_id: str
    medicine_id: str
    current_stock: float
    average_daily_consumption: float
    days_remaining: int | None = None
    projected_stockout_date: datetime | None = None
    lead_time_days: int
    risk_level: str
    requires_transfer: bool
    # "REQUEST" when the agent supplied the stock, "INVENTORY" when the backend read
    # it from the Inventory balance. Optional so older payloads still validate.
    stock_source: str | None = None


class ShortageThresholdResult(CamelModel):
    """Result of getShortageThreshold."""

    facility_id: str
    medicine_id: str
    minimum_stock: float
    reorder_point: float
    safety_stock: float
    lead_time_days: int
    # "CONFIGURED" for a stored reorder rule, "DEFAULT" when none is configured and
    # the backend applied its default thresholds. Optional so older payloads validate.
    source: str | None = None
