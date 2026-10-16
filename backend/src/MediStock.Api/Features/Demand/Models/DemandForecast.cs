namespace MediStock.Api.Features.Demand.Models;

/// <summary>
/// DemandForecasts table. Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// Deterministic statistical forecast (blueprint section 96: moving average, weighted
/// moving average, simple trend). No machine-learning model is used.
/// </summary>
public class DemandForecast
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    /// <summary>
    /// End of the forecast horizon the predicted demand covers.
    /// </summary>
    public DateTime ForecastDate { get; set; }

    /// <summary>
    /// Predicted total demand across the horizon.
    /// </summary>
    public decimal PredictedDemand { get; set; }

    /// <summary>
    /// Average daily consumption derived from the historical window.
    /// </summary>
    public decimal AverageDailyConsumption { get; set; }

    /// <summary>
    /// Forecasting method applied. See <see cref="ForecastMethods"/>.
    /// </summary>
    public string Method { get; set; } = ForecastMethods.MovingAverage;

    /// <summary>
    /// Size in days of the historical consumption window used as input.
    /// </summary>
    public int WindowDays { get; set; }

    /// <summary>
    /// Size in days of the forward horizon.
    /// </summary>
    public int HorizonDays { get; set; }

    public decimal ConfidenceScore { get; set; }

    public int LeadTimeDays { get; set; }

    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    public string Status { get; set; } = "ACTIVE";
}

/// <summary>
/// The deterministic forecasting methods sanctioned by blueprint section 96.
/// </summary>
public static class ForecastMethods
{
    public const string MovingAverage = "MOVING_AVERAGE";
    public const string WeightedMovingAverage = "WEIGHTED_MOVING_AVERAGE";
    public const string SimpleTrend = "SIMPLE_TREND";

    public static bool IsSupported(string? method) =>
        method is MovingAverage or WeightedMovingAverage or SimpleTrend;
}
