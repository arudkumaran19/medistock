namespace MediStock.Api.Features.Demand.Services;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Outcome of a deterministic shortage calculation, before it is persisted.
/// </summary>
/// <param name="CurrentStock">Stock on hand used for the projection.</param>
/// <param name="AverageDailyConsumption">Daily consumption rate applied.</param>
/// <param name="DaysRemaining">Whole days of stock left, null when nothing is consumed.</param>
/// <param name="ProjectedStockoutDate">Date stock reaches zero, null when no stockout is projected.</param>
/// <param name="LeadTimeDays">Supplier lead time compared against days remaining.</param>
/// <param name="RiskLevel">HIGH when days remaining is below lead time, otherwise MEDIUM.</param>
/// <param name="RequiresTransfer">True when replenishment will not arrive in time.</param>
public readonly record struct ShortageCalculation(
    decimal CurrentStock,
    decimal AverageDailyConsumption,
    int? DaysRemaining,
    DateTime? ProjectedStockoutDate,
    int LeadTimeDays,
    string RiskLevel,
    bool RequiresTransfer);

/// <summary>
/// Projected stockout and shortage risk for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// Implements the blueprint rule directly:
///
///   Stock = 120, average consumption = 20/day  =&gt;  days remaining = 6
///   Lead time = 10 days,  6 &lt; 10               =&gt;  SHORTAGE RISK
///
/// The arithmetic is deterministic backend code. The agent may request this
/// calculation and explain its operational meaning, but never produces the number.
///
/// Final stage of the demonstration chain:
/// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
/// </summary>
public class ShortageService
{
    private readonly ApplicationDbContext _db;
    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly ILogger<ShortageService> _logger;

    public ShortageService(
        ApplicationDbContext db,
        ConsumptionService consumptionService,
        ForecastService forecastService,
        ILogger<ShortageService> logger)
    {
        _db = db;
        _consumptionService = consumptionService;
        _forecastService = forecastService;
        _logger = logger;
    }

    /// <summary>
    /// Paged, searchable, sortable, filterable shortage alert list.
    /// Backs the React shortage dashboard and the Flutter shortage alerts screen.
    /// </summary>
    public async Task<PagedResponse<ShortageResponse>> GetShortagesAsync(
        ShortageQuery query,
        CancellationToken cancellationToken = default)
    {
        var (page, pageSize) = DemandValidator.NormalisePaging(query.Page, query.PageSize);

        var alerts = _db.ShortageAlerts.AsNoTracking();

        if (query.FacilityId is { } facilityId && facilityId != Guid.Empty)
        {
            alerts = alerts.Where(x => x.FacilityId == facilityId);
        }

        if (query.MedicineId is { } medicineId && medicineId != Guid.Empty)
        {
            alerts = alerts.Where(x => x.MedicineId == medicineId);
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim().ToLowerInvariant();
            alerts = alerts.Where(x => x.Status.ToLower() == status);
        }

        if (!string.IsNullOrWhiteSpace(query.RiskLevel))
        {
            var riskLevel = query.RiskLevel.Trim().ToLowerInvariant();
            alerts = alerts.Where(x => x.RiskLevel.ToLower() == riskLevel);
        }

        if (query.RequiresTransfer is { } requiresTransfer)
        {
            alerts = alerts.Where(x => x.RequiresTransfer == requiresTransfer);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            alerts = alerts.Where(x =>
                x.RiskLevel.ToLower().Contains(term) ||
                x.Status.ToLower().Contains(term));
        }

        alerts = ApplySort(alerts, query.SortBy, query.SortOrder);

        var totalCount = await alerts.CountAsync(cancellationToken);

        var items = await alerts
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToResponse(x))
            .ToListAsync(cancellationToken);

        return new PagedResponse<ShortageResponse>(items, totalCount, page, pageSize);
    }

    public async Task<ShortageResponse?> GetShortageByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return alert is null ? null : ToResponse(alert);
    }

    /// <summary>
    /// Stock available at a facility for a medicine, read-only from the Inventory
    /// vertical's InventoryBalances table (owner: Vaisnavi L.). Available is on hand
    /// minus reserved, floored at zero. Null when Inventory holds no balance row.
    /// </summary>
    public async Task<CurrentStockResponse?> GetCurrentStockAsync(
        Guid facilityId,
        Guid medicineId,
        CancellationToken cancellationToken = default)
    {
        var balance = await _db.InventoryBalances
            .AsNoTracking()
            .Where(x => x.FacilityId == facilityId && x.MedicineId == medicineId)
            .Select(x => new { x.QuantityOnHand, x.QuantityReserved })
            .FirstOrDefaultAsync(cancellationToken);

        if (balance is null)
        {
            return null;
        }

        var available = Math.Max(0, balance.QuantityOnHand - balance.QuantityReserved);

        return new CurrentStockResponse(
            facilityId,
            medicineId,
            balance.QuantityOnHand,
            balance.QuantityReserved,
            available);
    }

    /// <summary>
    /// Raises a shortage alert directly, without waiting for a recalculation.
    ///
    /// The caller may supply the observed stock; when it does not, the Inventory
    /// balance is used. Every derived figure is still computed here, so a manually
    /// raised alert is arithmetically identical to a derived one.
    ///
    /// Only one OPEN or ACKNOWLEDGED alert is kept per facility and medicine. Raising
    /// it again recalculates that alert and flags ExistingAlertUpdated instead of
    /// creating a duplicate.
    /// </summary>
    /// <exception cref="ShortageStockNotFoundException">
    /// No stock was supplied and Inventory holds no balance for the pair.
    /// </exception>
    public async Task<ShortageResponse> CreateShortageAsync(
        ShortageCreateRequest request,
        CancellationToken cancellationToken = default)
    {
        var currentStock = await ResolveCurrentStockAsync(
            request.CurrentStock,
            request.FacilityId,
            request.MedicineId,
            cancellationToken);

        var averageDaily = request.AverageDailyConsumption
                           ?? await _consumptionService.GetAverageDailyConsumptionAsync(
                               request.FacilityId,
                               request.MedicineId,
                               request.WindowDays,
                               cancellationToken);

        var leadTimeDays = request.LeadTimeDays
                           ?? await _forecastService.GetLeadTimeDaysAsync(
                               request.FacilityId,
                               request.MedicineId,
                               cancellationToken);

        var calculation = Calculate(
            currentStock,
            averageDaily,
            leadTimeDays,
            DateTime.UtcNow.Date);

        var (alert, existingUpdated) = await UpsertActiveAlertAsync(
            request.FacilityId,
            request.MedicineId,
            calculation,
            demandForecastId: null,
            cancellationToken);

        _logger.LogInformation(
            existingUpdated
                ? "Shortage alert {AlertId} refreshed manually for facility {FacilityId} medicine {MedicineId}"
                : "Shortage alert {AlertId} raised manually for facility {FacilityId} medicine {MedicineId}",
            alert.Id,
            alert.FacilityId,
            alert.MedicineId);

        var response = ToResponse(alert);
        response.ExistingAlertUpdated = existingUpdated;

        return response;
    }

    /// <summary>
    /// Writes a calculation to the single active alert for a facility and medicine.
    ///
    /// When an OPEN or ACKNOWLEDGED alert already exists its figures are recalculated in
    /// place and its status is kept, so a manager's acknowledgement is not lost. Otherwise
    /// a new OPEN alert is raised. Returns the alert and whether it already existed.
    /// </summary>
    public async Task<(ShortageAlert Alert, bool ExistingUpdated)> UpsertActiveAlertAsync(
        Guid facilityId,
        Guid medicineId,
        ShortageCalculation calculation,
        Guid? demandForecastId,
        CancellationToken cancellationToken = default)
    {
        var alert = await FindActiveAlertAsync(facilityId, medicineId, cancellationToken);

        if (alert is not null)
        {
            ApplyCalculation(alert, calculation);

            if (demandForecastId is not null)
            {
                alert.DemandForecastId = demandForecastId;
            }

            alert.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);

            return (alert, true);
        }

        alert = new ShortageAlert
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            MedicineId = medicineId,
            DemandForecastId = demandForecastId,
            GeneratedAt = DateTime.UtcNow,
            Status = ShortageAlertStatuses.Open
        };
        ApplyCalculation(alert, calculation);

        _db.ShortageAlerts.Add(alert);
        await _db.SaveChangesAsync(cancellationToken);

        return (alert, false);
    }

    /// <summary>
    /// Resolves the active alert for a facility and medicine with a recorded reason,
    /// storing the figures that cleared it. Null when there is no active alert.
    /// </summary>
    public async Task<ShortageAlert?> AutoResolveActiveAlertAsync(
        Guid facilityId,
        Guid medicineId,
        ShortageCalculation calculation,
        string reason,
        CancellationToken cancellationToken = default)
    {
        var alert = await FindActiveAlertAsync(facilityId, medicineId, cancellationToken);

        if (alert is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;

        ApplyCalculation(alert, calculation);
        alert.Status = ShortageAlertStatuses.Resolved;
        alert.ResolvedAt = now;
        alert.ResolutionReason = reason;
        alert.UpdatedAt = now;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Shortage alert {AlertId} auto-resolved: {Reason}",
            alert.Id,
            reason);

        return alert;
    }

    /// <summary>
    /// The newest OPEN or ACKNOWLEDGED alert for a facility and medicine, tracked.
    /// </summary>
    private Task<ShortageAlert?> FindActiveAlertAsync(
        Guid facilityId,
        Guid medicineId,
        CancellationToken cancellationToken)
    {
        return _db.ShortageAlerts
            .Where(x => x.FacilityId == facilityId
                        && x.MedicineId == medicineId
                        && ShortageAlertStatuses.Active.Contains(x.Status))
            .OrderByDescending(x => x.GeneratedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<decimal> ResolveCurrentStockAsync(
        decimal? suppliedStock,
        Guid facilityId,
        Guid medicineId,
        CancellationToken cancellationToken)
    {
        if (suppliedStock is { } supplied)
        {
            return supplied;
        }

        var stock = await GetCurrentStockAsync(facilityId, medicineId, cancellationToken);

        return stock?.AvailableQuantity
               ?? throw new ShortageStockNotFoundException(facilityId, medicineId);
    }

    private static void ApplyCalculation(ShortageAlert alert, ShortageCalculation calculation)
    {
        alert.CurrentStock = calculation.CurrentStock;
        alert.AverageDailyConsumption = calculation.AverageDailyConsumption;
        alert.DaysRemaining = calculation.DaysRemaining;
        alert.ProjectedStockoutDate = calculation.ProjectedStockoutDate;
        alert.LeadTimeDays = calculation.LeadTimeDays;
        alert.RiskLevel = calculation.RiskLevel;
        alert.RequiresTransfer = calculation.RequiresTransfer;
    }

    /// <summary>
    /// Updates an alert's status, stock figure or lead time.
    ///
    /// Returns null when the alert does not exist. Changing stock or lead time re-runs
    /// the deterministic calculation so the derived figures never drift out of step
    /// with the quantity they came from.
    /// </summary>
    public async Task<ShortageResponse?> UpdateShortageAsync(
        Guid id,
        ShortageUpdateRequest request,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return null;
        }

        var recalculate = request.CurrentStock.HasValue || request.LeadTimeDays.HasValue;

        if (recalculate)
        {
            var calculation = Calculate(
                request.CurrentStock ?? alert.CurrentStock,
                alert.AverageDailyConsumption,
                request.LeadTimeDays ?? alert.LeadTimeDays,
                DateTime.UtcNow.Date);

            alert.CurrentStock = calculation.CurrentStock;
            alert.DaysRemaining = calculation.DaysRemaining;
            alert.ProjectedStockoutDate = calculation.ProjectedStockoutDate;
            alert.LeadTimeDays = calculation.LeadTimeDays;
            alert.RiskLevel = calculation.RiskLevel;
            alert.RequiresTransfer = calculation.RequiresTransfer;
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            alert.Status = request.Status.Trim().ToUpperInvariant();

            if (alert.Status == ShortageAlertStatuses.Resolved)
            {
                alert.ResolvedAt ??= DateTime.UtcNow;
            }
            else
            {
                // Re-opened: it is no longer resolved, so neither is the reason.
                alert.ResolvedAt = null;
                alert.ResolutionReason = null;
            }
        }

        alert.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Shortage alert {AlertId} updated: status {Status} stock {CurrentStock} risk {RiskLevel}",
            alert.Id,
            alert.Status,
            alert.CurrentStock,
            alert.RiskLevel);

        return ToResponse(alert);
    }

    /// <summary>
    /// Marks an alert resolved. Returns null when it does not exist.
    ///
    /// Resolving is a status change, not a delete: the alert stays on record so the
    /// shortage history remains auditable.
    /// </summary>
    public async Task<ShortageResponse?> ResolveShortageAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return null;
        }

        alert.Status = ShortageAlertStatuses.Resolved;
        alert.ResolvedAt ??= DateTime.UtcNow;
        alert.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Shortage alert {AlertId} resolved", alert.Id);

        return ToResponse(alert);
    }

    /// <summary>
    /// Permanently removes an alert. Returns false when it does not exist.
    ///
    /// Prefer resolving over deleting: deleting loses the record that the shortage ever
    /// happened. This exists for alerts raised in error.
    /// </summary>
    public async Task<bool> DeleteShortageAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return false;
        }

        _db.ShortageAlerts.Remove(alert);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogWarning("Shortage alert {AlertId} deleted", alert.Id);

        return true;
    }

    /// <summary>
    /// Non-CRUD business operation. Runs the whole chain: derives average daily
    /// consumption from stored history through a persisted forecast when the caller does
    /// not supply one, projects the stockout, classifies the risk and stores the alert.
    ///
    /// Backs the agent tools calculateProjectedStockout and getShortageThreshold.
    ///
    /// When no stock is supplied the Inventory balance is used. Unlike a manual raise,
    /// every recalculation is stored as its own record: it is the auditable output of a
    /// forecast run, and the frozen contract returns the newly stored alert.
    /// </summary>
    /// <exception cref="ShortageStockNotFoundException">
    /// No stock was supplied and Inventory holds no balance for the pair.
    /// </exception>
    public async Task<ShortageResponse> RecalculateShortageAsync(
        ShortageRecalculateRequest request,
        CancellationToken cancellationToken = default)
    {
        var currentStock = await ResolveCurrentStockAsync(
            request.CurrentStock,
            request.FacilityId,
            request.MedicineId,
            cancellationToken);

        decimal averageDailyConsumption;
        Guid? forecastId = null;

        if (request.AverageDailyConsumption is { } supplied)
        {
            // An explicit rate was given, for example by a what-if from the management app.
            averageDailyConsumption = supplied;
        }
        else
        {
            // Derive it from stored consumption via a persisted forecast, so the
            // shortage alert is traceable back to the forecast it came from.
            var forecast = await _forecastService.CreateForecastAsync(
                new ForecastRequest
                {
                    FacilityId = request.FacilityId,
                    MedicineId = request.MedicineId,
                    WindowDays = request.WindowDays,
                    HorizonDays = request.WindowDays,
                    Method = ForecastMethods.MovingAverage,
                    LeadTimeDays = request.LeadTimeDays
                },
                cancellationToken);

            averageDailyConsumption = forecast.AverageDailyConsumption;
            forecastId = forecast.Id;
        }

        var leadTimeDays = request.LeadTimeDays
                           ?? await _forecastService.GetLeadTimeDaysAsync(
                               request.FacilityId,
                               request.MedicineId,
                               cancellationToken);

        var calculation = Calculate(
            currentStock,
            averageDailyConsumption,
            leadTimeDays,
            DateTime.UtcNow.Date);

        var alert = new ShortageAlert
        {
            Id = Guid.NewGuid(),
            FacilityId = request.FacilityId,
            MedicineId = request.MedicineId,
            DemandForecastId = forecastId,
            CurrentStock = calculation.CurrentStock,
            AverageDailyConsumption = calculation.AverageDailyConsumption,
            DaysRemaining = calculation.DaysRemaining,
            ProjectedStockoutDate = calculation.ProjectedStockoutDate,
            LeadTimeDays = calculation.LeadTimeDays,
            RiskLevel = calculation.RiskLevel,
            RequiresTransfer = calculation.RequiresTransfer,
            GeneratedAt = DateTime.UtcNow,
            Status = ShortageAlertStatuses.Open
        };

        _db.ShortageAlerts.Add(alert);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Shortage alert {AlertId} facility {FacilityId} medicine {MedicineId} " +
            "stock {CurrentStock} averageDailyConsumption {AverageDailyConsumption} " +
            "daysRemaining {DaysRemaining} leadTime {LeadTimeDays} risk {RiskLevel}",
            alert.Id,
            alert.FacilityId,
            alert.MedicineId,
            alert.CurrentStock,
            alert.AverageDailyConsumption,
            alert.DaysRemaining,
            alert.LeadTimeDays,
            alert.RiskLevel);

        return ToResponse(alert);
    }

    // -----------------------------------------------------------------------
    // Deterministic calculation. Pure function, free of the database, so the
    // stockout and risk arithmetic is directly unit-testable - this is the required
    // individual testing evidence for the Demand vertical.
    // -----------------------------------------------------------------------

    /// <summary>
    /// Projects the stockout and classifies the shortage risk.
    ///
    /// days remaining  = floor(currentStock / averageDailyConsumption)
    /// stockout date   = today + days remaining
    /// SHORTAGE RISK   = days remaining &lt; lead time
    /// </summary>
    public static ShortageCalculation Calculate(
        decimal currentStock,
        decimal averageDailyConsumption,
        int leadTimeDays,
        DateTime today)
    {
        if (currentStock < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(currentStock), "currentStock cannot be negative.");
        }

        if (averageDailyConsumption < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(averageDailyConsumption),
                "averageDailyConsumption cannot be negative.");
        }

        if (leadTimeDays < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(leadTimeDays), "leadTimeDays cannot be negative.");
        }

        // Nothing is being consumed, so stock is never projected to run out. Reporting
        // zero days here would raise a false shortage on every dormant medicine.
        if (averageDailyConsumption == 0m)
        {
            return new ShortageCalculation(
                currentStock,
                averageDailyConsumption,
                DaysRemaining: null,
                ProjectedStockoutDate: null,
                leadTimeDays,
                ShortageRiskLevels.Medium,
                RequiresTransfer: false);
        }

        var daysRemaining = (int)Math.Floor(currentStock / averageDailyConsumption);
        var projectedStockoutDate = DateTime.SpecifyKind(today.Date.AddDays(daysRemaining), DateTimeKind.Utc);

        // The blueprint rule: stock will not last until replenishment arrives.
        var requiresTransfer = daysRemaining < leadTimeDays;

        return new ShortageCalculation(
            currentStock,
            averageDailyConsumption,
            daysRemaining,
            projectedStockoutDate,
            leadTimeDays,
            requiresTransfer ? ShortageRiskLevels.High : ShortageRiskLevels.Medium,
            requiresTransfer);
    }

    private static IQueryable<ShortageAlert> ApplySort(
        IQueryable<ShortageAlert> alerts,
        string? sortBy,
        string? sortOrder)
    {
        var descending = !string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase);

        return (sortBy?.Trim().ToLowerInvariant()) switch
        {
            "daysremaining" => descending
                ? alerts.OrderByDescending(x => x.DaysRemaining)
                : alerts.OrderBy(x => x.DaysRemaining),
            "projectedstockoutdate" => descending
                ? alerts.OrderByDescending(x => x.ProjectedStockoutDate)
                : alerts.OrderBy(x => x.ProjectedStockoutDate),
            "currentstock" => descending
                ? alerts.OrderByDescending(x => x.CurrentStock)
                : alerts.OrderBy(x => x.CurrentStock),
            "risklevel" => descending
                ? alerts.OrderByDescending(x => x.RiskLevel)
                : alerts.OrderBy(x => x.RiskLevel),
            _ => descending
                ? alerts.OrderByDescending(x => x.GeneratedAt)
                : alerts.OrderBy(x => x.GeneratedAt)
        };
    }

    /// <summary>
    /// Marks an alert acknowledged. Returns null when it does not exist.
    /// </summary>
    public async Task<ShortageResponse?> AcknowledgeShortageAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return null;
        }

        alert.Status = ShortageAlertStatuses.Acknowledged;
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Shortage alert {AlertId} acknowledged", alert.Id);

        return ToResponse(alert);
    }

    private static ShortageResponse ToResponse(ShortageAlert alert) => new()
    {
        Id = alert.Id,
        FacilityId = alert.FacilityId,
        MedicineId = alert.MedicineId,
        DemandForecastId = alert.DemandForecastId,
        CurrentStock = alert.CurrentStock,
        AverageDailyConsumption = alert.AverageDailyConsumption,
        DaysRemaining = alert.DaysRemaining,
        ProjectedStockoutDate = alert.ProjectedStockoutDate,
        LeadTimeDays = alert.LeadTimeDays,
        RiskLevel = alert.RiskLevel,
        RequiresTransfer = alert.RequiresTransfer,
        GeneratedAt = alert.GeneratedAt,
        RelatedTransferId = alert.RelatedTransferId,
        Status = alert.Status
    };
}

/// <summary>
/// No stock was supplied and the Inventory vertical holds no balance for the facility
/// and medicine. Reported as DEMAND_STOCK_NOT_FOUND; zero is never assumed.
/// </summary>
public sealed class ShortageStockNotFoundException(Guid facilityId, Guid medicineId)
    : Exception($"No inventory balance exists for medicine {medicineId} at facility {facilityId}. Supply currentStock.")
{
    public Guid FacilityId { get; } = facilityId;

    public Guid MedicineId { get; } = medicineId;
}
