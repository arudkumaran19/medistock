namespace MediStock.Api.Features.Demand.DTOs;

using MediStock.Api.Common;

/// <summary>
/// Body of POST /api/consumption. Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public class ConsumptionRequest
{
    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    public decimal QuantityUsed { get; set; }

    /// <summary>ISO 8601 date the medicine was consumed.</summary>
    public DateTime ConsumptionDate { get; set; }

    public string Source { get; set; } = string.Empty;

    public string? Notes { get; set; }
}

/// <summary>
/// Response shape for a stored consumption record.
/// </summary>
public class ConsumptionResponse
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    public decimal QuantityUsed { get; set; }

    public DateTime ConsumptionDate { get; set; }

    public string Source { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Query string of GET /api/consumption, following the frozen convention:
/// ?page=1&amp;pageSize=20&amp;search=...&amp;sortBy=...&amp;sortOrder=asc&amp;facilityId=...
/// </summary>
public class ConsumptionQuery
{
    public Guid? FacilityId { get; set; }

    public Guid? MedicineId { get; set; }

    public DateTime? FromDate { get; set; }

    public DateTime? ToDate { get; set; }

    /// <summary>Free-text match against the record source and notes.</summary>
    public string? Search { get; set; }

    public string? SortBy { get; set; }

    public string? SortOrder { get; set; }

    public int Page { get; set; } = Constants.DefaultPage;

    public int PageSize { get; set; } = Constants.DefaultPageSize;
}
