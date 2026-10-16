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

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


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
