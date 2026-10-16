namespace MediStock.Api.Features.Demand.Services;

using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Automatic shortage detection for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// Re-runs the blueprint rule for one facility and medicine using live figures:
///
///   stock       = Inventory balance (on hand - reserved), read-only
///   consumption = 30-day average from recorded consumption
///   lead time   = the facility's reorder rule, or the default rule
///                 (ReorderRuleDefaults) for a known medicine without one
///
///   days remaining &lt; lead time  =&gt;  raise or refresh the single active alert
///   otherwise                    =&gt;  resolve the active alert, if any,
///                                    with "Stock now covers lead time"
///
/// Called after every consumption create, update and delete, and by
/// POST /api/shortages/scan. An alert is only a warning: nothing here moves stock,
/// creates a transfer or a purchase order, or approves anything.
///
/// Not specified in the final blueprint: raising and resolving alerts automatically.
/// Do not assume or introduce a new decision without team-level confirmation.
/// </summary>
public class ShortageEvaluationService
{
    /// <summary>Consumption window used for the average, matching the forecast default.</summary>
    public const int WindowDays = 30;

    public const string NoReorderRuleReason =
        "No reorder rule is configured and the medicine or facility is not in Inventory, so no default applies.";
    public const string NoInventoryBalanceReason = "Inventory holds no balance for this facility and medicine.";

    private readonly ApplicationDbContext _db;
    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly ShortageService _shortageService;
    private readonly ILogger<ShortageEvaluationService> _logger;

    public ShortageEvaluationService(
        ApplicationDbContext db,
        ConsumptionService consumptionService,
        ForecastService forecastService,
        ShortageService shortageService,
        ILogger<ShortageEvaluationService> logger)
    {
        _db = db;
        _consumptionService = consumptionService;
        _forecastService = forecastService;
        _shortageService = shortageService;
        _logger = logger;
    }

    /// <summary>
    /// Evaluates one facility and medicine and creates, refreshes or resolves its alert.
    /// </summary>
    public async Task<ShortageEvaluationResult> EvaluateAsync(
        Guid facilityId,
        Guid medicineId,
        CancellationToken cancellationToken = default)
    {
        // The configured rule, or the default for a known medicine and facility.
        var effectiveRule = await _forecastService.GetEffectiveReorderRuleAsync(
            facilityId,
            medicineId,
            cancellationToken);

        if (effectiveRule is null)
        {
            return Skipped(facilityId, medicineId, NoReorderRuleReason);
        }

        var rule = effectiveRule.Rule;

        var stock = await _shortageService.GetCurrentStockAsync(facilityId, medicineId, cancellationToken);

        if (stock is null)
        {
            // Zero is never assumed: a missing balance is not an empty shelf.
            return Skipped(facilityId, medicineId, NoInventoryBalanceReason);
        }

        var averageDaily = await _consumptionService.GetAverageDailyConsumptionAsync(
            facilityId,
            medicineId,
            WindowDays,
            cancellationToken);

        var calculation = ShortageService.Calculate(
            stock.AvailableQuantity,
            averageDaily,
            rule.LeadTimeDays,
            DateTime.UtcNow.Date);

        if (calculation.RequiresTransfer)
        {
            var (alert, existingUpdated) = await _shortageService.UpsertActiveAlertAsync(
                facilityId,
                medicineId,
                calculation,
                demandForecastId: null,
                cancellationToken);

            _logger.LogInformation(
                "Auto shortage check {Outcome} alert {AlertId} facility {FacilityId} medicine {MedicineId}: " +
                "{DaysRemaining} days < {LeadTimeDays} lead time",
                existingUpdated ? ShortageEvaluationOutcomes.Updated : ShortageEvaluationOutcomes.Created,
                alert.Id,
                facilityId,
                medicineId,
                calculation.DaysRemaining,
                calculation.LeadTimeDays);

            var response = ShortageService.ToResponse(alert);
            response.ExistingAlertUpdated = existingUpdated;

            return new ShortageEvaluationResult(
                facilityId,
                medicineId,
                existingUpdated ? ShortageEvaluationOutcomes.Updated : ShortageEvaluationOutcomes.Created,
                null,
                response);
        }

        var resolved = await _shortageService.AutoResolveActiveAlertAsync(
            facilityId,
            medicineId,
            calculation,
            ShortageAlertStatuses.StockCoversLeadTimeReason,
            cancellationToken);

        return resolved is null
            ? new ShortageEvaluationResult(facilityId, medicineId, ShortageEvaluationOutcomes.NoChange, null, null)
            : new ShortageEvaluationResult(
                facilityId,
                medicineId,
                ShortageEvaluationOutcomes.Resolved,
                ShortageAlertStatuses.StockCoversLeadTimeReason,
                ShortageService.ToResponse(resolved));
    }

    /// <summary>
    /// Evaluates without ever throwing. Used after a consumption save, which has
    /// already succeeded and must not be reported as failed because the follow-up
    /// shortage check did.
    /// </summary>
    public async Task<ShortageEvaluationResult> TryEvaluateAsync(
        Guid facilityId,
        Guid medicineId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await EvaluateAsync(facilityId, medicineId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Auto shortage check failed for facility {FacilityId} medicine {MedicineId}",
                facilityId,
                medicineId);

            // Drop whatever the failed check left pending so it cannot leak into a
            // later save on this request's context. The context itself may be the
            // thing that failed, so this cleanup must not throw either.
            try
            {
                _db.ChangeTracker.Clear();
            }
            catch (Exception cleanupError)
            {
                _logger.LogDebug(cleanupError, "Change tracker could not be cleared after a failed shortage check.");
            }

            return new ShortageEvaluationResult(
                facilityId,
                medicineId,
                ShortageEvaluationOutcomes.Failed,
                ex.Message,
                null);
        }
    }

    /// <summary>
    /// Evaluates every facility and medicine that has consumption history. A pair
    /// with no configured rule uses the default rule when its medicine and facility
    /// exist, and is reported as skipped otherwise. Backs POST /api/shortages/scan.
    /// One failing pair does not stop the rest.
    /// </summary>
    public async Task<ShortageScanResponse> ScanAsync(CancellationToken cancellationToken = default)
    {
        var consumed = await _db.ConsumptionRecords
            .AsNoTracking()
            .Select(x => new { x.FacilityId, x.MedicineId })
            .Distinct()
            .ToListAsync(cancellationToken);

        var pairs = consumed
            .Select(x => (x.FacilityId, x.MedicineId))
            .OrderBy(x => x.FacilityId)
            .ThenBy(x => x.MedicineId)
            .ToList();

        var results = new List<ShortageEvaluationResult>(pairs.Count);

        foreach (var (facilityId, medicineId) in pairs)
        {
            results.Add(await TryEvaluateAsync(facilityId, medicineId, cancellationToken));
        }

        int Count(string outcome) => results.Count(x => x.Outcome == outcome);

        var scan = new ShortageScanResponse(
            Evaluated: results.Count,
            Created: Count(ShortageEvaluationOutcomes.Created),
            Updated: Count(ShortageEvaluationOutcomes.Updated),
            Resolved: Count(ShortageEvaluationOutcomes.Resolved),
            Unchanged: Count(ShortageEvaluationOutcomes.NoChange),
            Skipped: Count(ShortageEvaluationOutcomes.Skipped),
            Failed: Count(ShortageEvaluationOutcomes.Failed),
            Results: results);

        _logger.LogInformation(
            "Shortage scan evaluated {Evaluated}: created {Created} updated {Updated} resolved {Resolved} " +
            "unchanged {Unchanged} skipped {Skipped} failed {Failed}",
            scan.Evaluated,
            scan.Created,
            scan.Updated,
            scan.Resolved,
            scan.Unchanged,
            scan.Skipped,
            scan.Failed);

        return scan;
    }

    private static ShortageEvaluationResult Skipped(Guid facilityId, Guid medicineId, string reason) =>
        new(facilityId, medicineId, ShortageEvaluationOutcomes.Skipped, reason, null);
}
