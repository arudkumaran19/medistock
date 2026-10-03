namespace MediStock.Api.Features.Demand.DTOs;

using MediStock.Api.Common;

/// <summary>
/// Response shape of the shortage endpoints - the end of the demonstration chain:
/// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public class ShortageResponse
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    public Guid? DemandForecastId { get; set; }

    public decimal CurrentStock { get; set; }

    public decimal AverageDailyConsumption { get; set; }

    /// <summary>
    /// Null when average daily consumption is zero, meaning no stockout is projected.
    /// </summary>
    public int? DaysRemaining { get; set; }

    public DateTime? ProjectedStockoutDate { get; set; }

    public int LeadTimeDays { get; set; }

    public string RiskLevel { get; set; } = string.Empty;

    public bool RequiresTransfer { get; set; }

    public DateTime GeneratedAt { get; set; }

    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// Body of POST /api/shortages/recalculate.
/// This is the non-CRUD business operation of the shortage sub-component: it derives
/// days of stock, the projected stockout date and the shortage risk level.
/// </summary>
public class ShortageRecalculateRequest
{
    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    /// <summary>
    /// Stock on hand at the facility. Supplied by the caller because inventory balances
    /// are owned by the Inventory vertical, not by Demand.
    /// </summary>
    public decimal CurrentStock { get; set; }

    /// <summary>
    /// Average daily consumption. When omitted it is derived from the stored
    /// consumption history over <see cref="WindowDays"/>.
    /// </summary>
    public decimal? AverageDailyConsumption { get; set; }

    /// <summary>
    /// Supplier lead time in days. When omitted, the facility's reorder rule is used.
    /// </summary>
    public int? LeadTimeDays { get; set; }

    /// <summary>
    /// Historical window in days used when average daily consumption is derived.
    /// </summary>
    public int WindowDays { get; set; } = 30;
}

/// <summary>
/// Body of POST /api/shortages - raise a shortage alert directly.
///
/// Used when a manager knows a shortage exists without waiting for a recalculation,
/// for example after a physical stock count. The derived figures (days of cover,
/// projected stockout, risk level) are still calculated by the backend, never supplied
/// by the caller.
/// </summary>
public class ShortageCreateRequest
{
    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    public decimal CurrentStock { get; set; }

    /// <summary>
    /// When omitted it is derived from the stored consumption history.
    /// </summary>
    public decimal? AverageDailyConsumption { get; set; }

    /// <summary>
    /// When omitted the facility's reorder rule supplies it.
    /// </summary>
    public int? LeadTimeDays { get; set; }

    public int WindowDays { get; set; } = 30;
}

/// <summary>
/// Body of PUT /api/shortages/{id} - update an alert's status and stock figure.
///
/// Changing the stock re-runs the deterministic calculation, so days of cover, the
/// projected stockout date and the risk level stay consistent with the new quantity.
/// A caller can never set those derived values directly.
/// </summary>
public class ShortageUpdateRequest
{
    /// <summary>OPEN, ACKNOWLEDGED or RESOLVED. Omit to leave unchanged.</summary>
    public string? Status { get; set; }

    /// <summary>Corrected stock on hand. Omit to leave unchanged.</summary>
    public decimal? CurrentStock { get; set; }

    /// <summary>Corrected lead time. Omit to leave unchanged.</summary>
    public int? LeadTimeDays { get; set; }
}

/// <summary>
/// Query string of GET /api/shortages.
/// </summary>
public class ShortageQuery
{
    public Guid? FacilityId { get; set; }

    public Guid? MedicineId { get; set; }

    public string? Status { get; set; }

    public string? RiskLevel { get; set; }

    public bool? RequiresTransfer { get; set; }

    public string? Search { get; set; }

    public string? SortBy { get; set; }

    public string? SortOrder { get; set; }

    public int Page { get; set; } = Constants.DefaultPage;

    public int PageSize { get; set; } = Constants.DefaultPageSize;
}
