namespace MediStock.Api.Features.Demand.DTOs;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.Models;

/// <summary>
/// Response shape of the demand forecast endpoints.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public class ForecastResponse
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    public DateTime ForecastDate { get; set; }

    public decimal PredictedDemand { get; set; }

    public decimal AverageDailyConsumption { get; set; }

    public string Method { get; set; } = string.Empty;

    public int WindowDays { get; set; }

    public int HorizonDays { get; set; }

    public decimal ConfidenceScore { get; set; }

    public int LeadTimeDays { get; set; }

    public DateTime GeneratedAt { get; set; }

    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// Body of POST /api/demand/forecast.
/// This is the non-CRUD business operation of the Demand component: it reads the
/// historical consumption window and computes a deterministic forecast.
/// </summary>
public class ForecastRequest
{
    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    /// <summary>
    /// Historical window in days used as forecast input. Defaults to 30.
    /// </summary>
    public int WindowDays { get; set; } = 30;

    /// <summary>
    /// Forward horizon in days the forecast covers. Defaults to 30.
    /// </summary>
    public int HorizonDays { get; set; } = 30;

    /// <summary>
    /// One of MOVING_AVERAGE, WEIGHTED_MOVING_AVERAGE or SIMPLE_TREND.
    /// Defaults to MOVING_AVERAGE.
    /// </summary>
    public string Method { get; set; } = ForecastMethods.MovingAverage;

    /// <summary>
    /// Supplier lead time in days. When omitted, the facility's reorder rule is used.
    /// </summary>
    public int? LeadTimeDays { get; set; }
}

/// <summary>
/// Query string of GET /api/demand/forecasts.
/// </summary>
public class ForecastQuery
{
    public Guid? FacilityId { get; set; }

    public Guid? MedicineId { get; set; }

    public string? Status { get; set; }

    public string? Method { get; set; }

    public string? Search { get; set; }

    public string? SortBy { get; set; }

    public string? SortOrder { get; set; }

    public int Page { get; set; } = Constants.DefaultPage;

    public int PageSize { get; set; } = Constants.DefaultPageSize;
}
