namespace MediStock.Api.Features.Demand.Services;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Outcome of a deterministic forecast calculation, before it is persisted.
/// </summary>
public readonly record struct ForecastCalculation(
    decimal AverageDailyConsumption,
    decimal PredictedDemand,
    decimal ConfidenceScore,
    string Method);

/// <summary>
/// Demand forecasting for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// The forecast is deterministic statistics, not a machine-learning model and not LLM
/// arithmetic (blueprint section 96). The agent may choose which forecast to request and
/// may interpret the result, but this code produces the number.
///
/// Second stage of the demonstration chain:
/// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
/// </summary>
public class ForecastService
{
    private readonly ApplicationDbContext _db;
    private readonly ConsumptionService _consumptionService;
    private readonly ILogger<ForecastService> _logger;

    public ForecastService(
        ApplicationDbContext db,
        ConsumptionService consumptionService,
        ILogger<ForecastService> logger)
    {
        _db = db;
        _consumptionService = consumptionService;
        _logger = logger;
    }

    /// <summary>
    /// Paged, searchable, sortable, filterable forecast list.
    /// </summary>
    public async Task<PagedResponse<ForecastResponse>> GetForecastsAsync(
        ForecastQuery query,
        CancellationToken cancellationToken = default)
    {
        var (page, pageSize) = DemandValidator.NormalisePaging(query.Page, query.PageSize);

        var forecasts = _db.DemandForecasts.AsNoTracking();

        if (query.FacilityId is { } facilityId && facilityId != Guid.Empty)
        {
            forecasts = forecasts.Where(x => x.FacilityId == facilityId);
        }

        if (query.MedicineId is { } medicineId && medicineId != Guid.Empty)
        {
            forecasts = forecasts.Where(x => x.MedicineId == medicineId);
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim().ToLowerInvariant();
            forecasts = forecasts.Where(x => x.Status.ToLower() == status);
        }

        if (!string.IsNullOrWhiteSpace(query.Method))
        {
            var method = query.Method.Trim().ToLowerInvariant();
            forecasts = forecasts.Where(x => x.Method.ToLower() == method);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            forecasts = forecasts.Where(x =>
                x.Method.ToLower().Contains(term) ||
                x.Status.ToLower().Contains(term));
        }

        forecasts = ApplySort(forecasts, query.SortBy, query.SortOrder);

        var totalCount = await forecasts.CountAsync(cancellationToken);

        var items = await forecasts
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToResponse(x))
            .ToListAsync(cancellationToken);

        return new PagedResponse<ForecastResponse>(items, totalCount, page, pageSize);
    }

    /// <summary>
    /// Non-CRUD business operation: reads the historical consumption window, computes a
    /// deterministic forecast and persists it.
    /// Backs the agent tool calculateForecast.
    /// </summary>
    public async Task<ForecastResponse> CreateForecastAsync(
        ForecastRequest request,
        CancellationToken cancellationToken = default)
    {
        var history = await _consumptionService.GetHistoryAsync(
            request.FacilityId,
            request.MedicineId,
            request.WindowDays,
            cancellationToken);

        var dailySeries = BuildDailySeries(history, request.WindowDays, DateTime.UtcNow.Date);

        var calculation = Calculate(dailySeries, request.HorizonDays, request.Method);

        var leadTimeDays = request.LeadTimeDays
                           ?? await GetLeadTimeDaysAsync(request.FacilityId, request.MedicineId, cancellationToken);

        var forecast = new DemandForecast
        {
            Id = Guid.NewGuid(),
            FacilityId = request.FacilityId,
            MedicineId = request.MedicineId,
            ForecastDate = DateTime.SpecifyKind(
                DateTime.UtcNow.Date.AddDays(request.HorizonDays),
                DateTimeKind.Utc),
            PredictedDemand = calculation.PredictedDemand,
            AverageDailyConsumption = calculation.AverageDailyConsumption,
            Method = calculation.Method,
            WindowDays = request.WindowDays,
            HorizonDays = request.HorizonDays,
            ConfidenceScore = calculation.ConfidenceScore,
            LeadTimeDays = leadTimeDays,
            GeneratedAt = DateTime.UtcNow,
            Status = "ACTIVE"
        };

        _db.DemandForecasts.Add(forecast);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Forecast {ForecastId} method {Method} facility {FacilityId} medicine {MedicineId} " +
            "averageDailyConsumption {AverageDailyConsumption} predictedDemand {PredictedDemand}",
            forecast.Id,
            forecast.Method,
            forecast.FacilityId,
            forecast.MedicineId,
            forecast.AverageDailyConsumption,
            forecast.PredictedDemand);

        return ToResponse(forecast);
    }

    /// <summary>
    /// A single forecast. Null when it does not exist.
    /// </summary>
    public async Task<ForecastResponse?> GetForecastByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var forecast = await _db.DemandForecasts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return forecast is null ? null : ToResponse(forecast);
    }

    /// <summary>
    /// Removes a stored forecast. False when it does not exist.
    ///
    /// There is deliberately no update: a forecast is a derived record of what the
    /// calculation produced from a given window. Editing one would make it a claim
    /// nobody can reproduce. To get a different answer, generate a new forecast.
    ///
    /// Any shortage alert derived from this forecast keeps its own figures; its
    /// DemandForecastId is set to null by the database rather than cascading.
    /// </summary>
    public async Task<bool> DeleteForecastAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var forecast = await _db.DemandForecasts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (forecast is null)
        {
            return false;
        }

        _db.DemandForecasts.Remove(forecast);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogWarning("Forecast {ForecastId} deleted", forecast.Id);

        return true;
    }

    /// <summary>
    /// Lead time from the facility's reorder rule.
    /// Backs the agent tool getShortageThreshold.
    /// </summary>
    public async Task<int> GetLeadTimeDaysAsync(
        Guid facilityId,
        Guid medicineId,
        CancellationToken cancellationToken = default)
    {
        var rule = await _db.ReorderRules
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.FacilityId == facilityId && x.MedicineId == medicineId,
                cancellationToken);

        return rule?.LeadTimeDays ?? 0;
    }

    public async Task<ReorderRule?> GetReorderRuleAsync(
        Guid facilityId,
        Guid medicineId,
        CancellationToken cancellationToken = default)
    {
        return await _db.ReorderRules
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.FacilityId == facilityId && x.MedicineId == medicineId,
                cancellationToken);
    }

    // -----------------------------------------------------------------------
    // Deterministic calculation. Pure functions, kept free of the database so the
    // forecast arithmetic is directly unit-testable - this is the required
    // individual testing evidence for the Demand vertical.
    // -----------------------------------------------------------------------

    /// <summary>
    /// Expands consumption rows into one value per day across the window, oldest first.
    /// Days with no recorded consumption become zero, so gaps lower the average rather
    /// than being silently skipped.
    /// </summary>
    public static IReadOnlyList<decimal> BuildDailySeries(
        IEnumerable<ConsumptionRecord> history,
        int windowDays,
        DateTime today)
    {
        if (windowDays <= 0)
        {
            return Array.Empty<decimal>();
        }

        var totalsByDate = history
            .GroupBy(x => x.ConsumptionDate.Date)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.QuantityUsed));

        var series = new decimal[windowDays];

        for (var i = 0; i < windowDays; i++)
        {
            // i = 0 is the oldest day in the window, i = windowDays - 1 is yesterday.
            var date = today.Date.AddDays(-(windowDays - i));
            series[i] = totalsByDate.TryGetValue(date, out var total) ? total : 0m;
        }

        return series;
    }

    /// <summary>
    /// Applies the requested deterministic forecasting method to a daily series.
    /// </summary>
    public static ForecastCalculation Calculate(
        IReadOnlyList<decimal> dailySeries,
        int horizonDays,
        string method)
    {
        if (horizonDays <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(horizonDays), "horizonDays must be greater than zero.");
        }

        if (!ForecastMethods.IsSupported(method))
        {
            throw new ArgumentException(
                "method must be one of MOVING_AVERAGE, WEIGHTED_MOVING_AVERAGE or SIMPLE_TREND.",
                nameof(method));
        }

        if (dailySeries.Count == 0)
        {
            return new ForecastCalculation(0m, 0m, 0m, method);
        }

        var averageDaily = method switch
        {
            ForecastMethods.WeightedMovingAverage => WeightedMovingAverage(dailySeries),
            ForecastMethods.SimpleTrend => TrendAverage(dailySeries, horizonDays),
            _ => MovingAverage(dailySeries)
        };

        averageDaily = decimal.Round(Math.Max(0m, averageDaily), 4, MidpointRounding.AwayFromZero);

        var predictedDemand = decimal.Round(averageDaily * horizonDays, 2, MidpointRounding.AwayFromZero);

        return new ForecastCalculation(
            averageDaily,
            predictedDemand,
            CalculateConfidence(dailySeries),
            method);
    }

    /// <summary>
    /// Unweighted mean of the daily series.
    /// </summary>
    public static decimal MovingAverage(IReadOnlyList<decimal> dailySeries)
    {
        if (dailySeries.Count == 0)
        {
            return 0m;
        }

        return dailySeries.Sum() / dailySeries.Count;
    }

    /// <summary>
    /// Linearly weighted mean: the oldest day carries weight 1 and the newest day
    /// carries weight n, so recent usage dominates.
    /// </summary>
    public static decimal WeightedMovingAverage(IReadOnlyList<decimal> dailySeries)
    {
        if (dailySeries.Count == 0)
        {
            return 0m;
        }

        decimal weightedTotal = 0m;
        decimal weightSum = 0m;

        for (var i = 0; i < dailySeries.Count; i++)
        {
            var weight = i + 1;
            weightedTotal += dailySeries[i] * weight;
            weightSum += weight;
        }

        return weightSum == 0m ? 0m : weightedTotal / weightSum;
    }

    /// <summary>
    /// Least-squares linear trend fitted to the daily series and projected across the
    /// horizon. Returns the mean projected daily consumption, floored at zero so a
    /// falling trend never predicts negative usage.
    /// </summary>
    public static decimal TrendAverage(IReadOnlyList<decimal> dailySeries, int horizonDays)
    {
        var n = dailySeries.Count;

        if (n == 0 || horizonDays <= 0)
        {
            return 0m;
        }

        if (n == 1)
        {
            return dailySeries[0];
        }

        double sumX = 0, sumY = 0, sumXy = 0, sumXx = 0;

        for (var i = 0; i < n; i++)
        {
            var x = (double)i;
            var y = (double)dailySeries[i];

            sumX += x;
            sumY += y;
            sumXy += x * y;
            sumXx += x * x;
        }

        var denominator = (n * sumXx) - (sumX * sumX);

        if (Math.Abs(denominator) < double.Epsilon)
        {
            return MovingAverage(dailySeries);
        }

        var slope = ((n * sumXy) - (sumX * sumY)) / denominator;
        var intercept = (sumY - (slope * sumX)) / n;

        // Project the days immediately after the observed window and average them.
        double projectedTotal = 0;

        for (var step = 0; step < horizonDays; step++)
        {
            var x = n + step;
            projectedTotal += Math.Max(0d, intercept + (slope * x));
        }

        return (decimal)(projectedTotal / horizonDays);
    }

    /// <summary>
    /// Confidence is the proportion of days in the window that actually carry a
    /// consumption observation, so a sparse history yields a visibly lower score.
    ///
    /// Not specified in the final blueprint: how the forecast confidence score is
    /// derived. The blueprint requires the field but does not define its formula. This
    /// coverage-ratio definition is deterministic and explainable, and must be confirmed
    /// at team level before it is treated as a shared contract.
    /// </summary>
    public static decimal CalculateConfidence(IReadOnlyList<decimal> dailySeries)
    {
        if (dailySeries.Count == 0)
        {
            return 0m;
        }

        var observedDays = dailySeries.Count(x => x > 0m);

        return decimal.Round(
            (decimal)observedDays / dailySeries.Count,
            4,
            MidpointRounding.AwayFromZero);
    }

    private static IQueryable<DemandForecast> ApplySort(
        IQueryable<DemandForecast> forecasts,
        string? sortBy,
        string? sortOrder)
    {
        var descending = !string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase);

        return (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "forecastdate" => descending
                ? forecasts.OrderByDescending(x => x.ForecastDate)
                : forecasts.OrderBy(x => x.ForecastDate),
            "predicteddemand" => descending
                ? forecasts.OrderByDescending(x => x.PredictedDemand)
                : forecasts.OrderBy(x => x.PredictedDemand),
            "confidencescore" => descending
                ? forecasts.OrderByDescending(x => x.ConfidenceScore)
                : forecasts.OrderBy(x => x.ConfidenceScore),
            _ => descending
                ? forecasts.OrderByDescending(x => x.GeneratedAt)
                : forecasts.OrderBy(x => x.GeneratedAt)
        };
    }

    private static ForecastResponse ToResponse(DemandForecast forecast) => new()
    {
        Id = forecast.Id,
        FacilityId = forecast.FacilityId,
        MedicineId = forecast.MedicineId,
        ForecastDate = forecast.ForecastDate,
        PredictedDemand = forecast.PredictedDemand,
        AverageDailyConsumption = forecast.AverageDailyConsumption,
        Method = forecast.Method,
        WindowDays = forecast.WindowDays,
        HorizonDays = forecast.HorizonDays,
        ConfidenceScore = forecast.ConfidenceScore,
        LeadTimeDays = forecast.LeadTimeDays,
        GeneratedAt = forecast.GeneratedAt,
        Status = forecast.Status
    };
}
