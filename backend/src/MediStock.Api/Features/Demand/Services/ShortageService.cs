namespace MediStock.Api.Features.Demand.Services;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Features.Notifications.Services;
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
    private readonly INotificationService? _notificationService;

    public ShortageService(
        ApplicationDbContext db,
        ConsumptionService consumptionService,
        ForecastService forecastService,
        ILogger<ShortageService> logger,
        INotificationService? notificationService = null)
    {
        _db = db;
        _consumptionService = consumptionService;
        _forecastService = forecastService;
        _logger = logger;
        _notificationService = notificationService;
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

        var alerts = _db.ShortageAlerts
            .Include(x => x.StatusHistory)
            .AsNoTracking();

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
            .Include(x => x.StatusHistory)
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

        var expiredBatchesQty = await _db.MedicineBatches
            .AsNoTracking()
            .Where(b => b.FacilityId == facilityId && b.MedicineId == medicineId && b.ExpiryDateUtc <= DateTime.UtcNow)
            .SumAsync(b => (decimal)b.QuantityOnHand, cancellationToken);

        var usableOnHand = Math.Max(0, balance.QuantityOnHand - expiredBatchesQty);
        var available = Math.Max(0, usableOnHand - balance.QuantityReserved);

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
            var prevStock = alert.CurrentStock;
            var prevDays = alert.DaysRemaining;
            ApplyCalculation(alert, calculation);

            if (demandForecastId is not null)
            {
                alert.DemandForecastId = demandForecastId;
            }

            alert.UpdatedAt = DateTime.UtcNow;
            _db.ShortageStatusHistories.Add(new ShortageStatusHistory
            {
                Id = Guid.NewGuid(),
                ShortageAlertId = alert.Id,
                FromStatus = alert.Status,
                ToStatus = alert.Status,
                ChangedBy = "System:DemandForecast",
                ChangedAt = DateTime.UtcNow,
                Reason = "Refreshed live metrics",
                Notes = $"Updated stock from {prevStock} to {calculation.CurrentStock}, days remaining from {prevDays} to {calculation.DaysRemaining}."
            });

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
        _db.ShortageStatusHistories.Add(new ShortageStatusHistory
        {
            Id = Guid.NewGuid(),
            ShortageAlertId = alert.Id,
            FromStatus = "NONE",
            ToStatus = ShortageAlertStatuses.Open,
            ChangedBy = "System:DemandForecast",
            ChangedAt = DateTime.UtcNow,
            Reason = $"Projected stockout in {calculation.DaysRemaining} days (Lead time: {calculation.LeadTimeDays} days)",
            Notes = calculation.RequiresTransfer ? "High shortage risk requires replenishment." : "Medium shortage risk monitored."
        });

        await _db.SaveChangesAsync(cancellationToken);

        if (_notificationService != null)
        {
            try
            {
                var facility = await _db.Facilities.AsNoTracking().FirstOrDefaultAsync(f => f.Id == facilityId, cancellationToken);
                var medicine = await _db.Medicines.AsNoTracking().FirstOrDefaultAsync(m => m.Id == medicineId, cancellationToken);
                await _notificationService.NotifyShortageAlertAsync(
                    alert.Id,
                    facilityId,
                    medicineId,
                    facility?.Name,
                    medicine?.Name,
                    alert.CurrentStock,
                    alert.DaysRemaining,
                    alert.RiskLevel,
                    isNew: true,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send notification for shortage alert {AlertId}", alert.Id);
            }
        }

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
        var prevStatus = alert.Status;

        ApplyCalculation(alert, calculation);
        alert.Status = ShortageAlertStatuses.Resolved;
        alert.ResolvedAt = now;
        alert.ResolutionReason = reason;
        alert.ResolutionVerified = true;
        alert.VerifiedBy = "System:ShortageScan";
        alert.VerificationMethod = "AUTO_SCAN";
        alert.VerificationNotes = "Automated shortage scan verified available inventory covers lead time.";
        alert.UpdatedAt = now;

        _db.ShortageStatusHistories.Add(new ShortageStatusHistory
        {
            Id = Guid.NewGuid(),
            ShortageAlertId = alert.Id,
            FromStatus = prevStatus,
            ToStatus = ShortageAlertStatuses.Resolved,
            ChangedBy = "System:ShortageScan",
            ChangedAt = now,
            Reason = reason,
            Notes = alert.VerificationNotes,
            VerificationMethod = "AUTO_SCAN"
        });

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
        string? actor = null,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .Include(x => x.StatusHistory)
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

        var previousStatus = alert.Status;
        var statusChanged = false;

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var newStatus = request.Status.Trim().ToUpperInvariant();
            if (newStatus != alert.Status)
            {
                statusChanged = true;
                alert.Status = newStatus;

                if (alert.Status == ShortageAlertStatuses.Resolved)
                {
                    alert.ResolvedAt ??= DateTime.UtcNow;
                    alert.ResolutionReason = request.Notes ?? "Marked resolved via status update";
                }
                else if (alert.Status == ShortageAlertStatuses.Dismissed)
                {
                    alert.ResolvedAt ??= DateTime.UtcNow;
                    alert.ResolutionReason = request.Notes ?? "Dismissed by manager";
                }
                else
                {
                    // Re-opened: it is no longer resolved, so neither is the reason.
                    alert.ResolvedAt = null;
                    alert.ResolutionReason = null;
                }
            }
        }

        if (statusChanged || !string.IsNullOrWhiteSpace(request.Notes))
        {
            var history = new ShortageStatusHistory
            {
                Id = Guid.NewGuid(),
                ShortageAlertId = alert.Id,
                FromStatus = previousStatus,
                ToStatus = alert.Status,
                ChangedBy = actor ?? "FacilityManager",
                ChangedAt = DateTime.UtcNow,
                Reason = request.Notes ?? $"Status transitioned from {previousStatus} to {alert.Status}",
                Notes = request.Notes
            };
            alert.StatusHistory ??= new List<ShortageStatusHistory>();
            alert.StatusHistory.Add(history);
            _db.ShortageStatusHistories.Add(history);
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
    /// Marks an alert resolved with verification evidence. Returns null when it does not exist.
    ///
    /// Resolving is a status change, not a delete: the alert stays on record so the
    /// shortage history remains auditable.
    /// </summary>
    public async Task<ShortageResponse?> ResolveShortageAsync(
        Guid id,
        ShortageResolveRequest? request = null,
        string? actor = null,
        bool enforceVerification = false,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .Include(x => x.StatusHistory)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return null;
        }

        var isStockSufficient = false;
        var currentStock = request?.VerifiedCurrentStock;
        if (!currentStock.HasValue)
        {
            var stockBal = await GetCurrentStockAsync(alert.FacilityId, alert.MedicineId, cancellationToken);
            currentStock = stockBal?.AvailableQuantity;
        }

        if (currentStock.HasValue && alert.AverageDailyConsumption > 0)
        {
            var daysCovered = currentStock.Value / alert.AverageDailyConsumption;
            if (daysCovered >= alert.LeadTimeDays)
            {
                isStockSufficient = true;
            }
        }
        else if (currentStock.HasValue && alert.AverageDailyConsumption == 0 && currentStock.Value > 0)
        {
            isStockSufficient = true;
        }

        var isTransferDelivered = false;
        var transferId = request?.TransferId ?? alert.TransferId;
        if (transferId.HasValue)
        {
            var transfer = await _db.TransferRequests.AsNoTracking().FirstOrDefaultAsync(t => t.Id == transferId.Value, cancellationToken);
            if (transfer != null && transfer.Status == MediStock.Api.Domain.Enums.TransferStatus.Delivered)
            {
                isTransferDelivered = true;
                alert.TransferId = transferId;
            }
        }

        var isPoReceived = false;
        var poId = request?.PurchaseOrderId ?? alert.PurchaseOrderId;
        if (poId.HasValue)
        {
            var po = await _db.PurchaseOrders.AsNoTracking().FirstOrDefaultAsync(p => p.Id == poId.Value, cancellationToken);
            if (po != null && po.Status == MediStock.Api.Domain.Enums.PurchaseOrderStatus.Received)
            {
                isPoReceived = true;
                alert.PurchaseOrderId = poId;
            }
        }

        var isExplicitAuditVerified = !string.IsNullOrWhiteSpace(request?.VerificationNotes) &&
                                      !string.IsNullOrWhiteSpace(request?.VerificationMethod);

        if (enforceVerification && !isStockSufficient && !isTransferDelivered && !isPoReceived && !isExplicitAuditVerified)
        {
            throw new ShortageResolutionNotVerifiedException(
                $"Shortage {id} resolution cannot be marked resolved without verification. Current stock does not cover lead time, linked transfer/purchase order is not delivered/received, and no clinical verification notes were provided.");
        }

        var verificationMethod = isStockSufficient ? "STOCK_AUDIT"
            : isTransferDelivered ? "TRANSFER_RECEIPT"
            : isPoReceived ? "PROCUREMENT_RECEIPT"
            : request?.VerificationMethod ?? (enforceVerification ? "PHYSICAL_AUDIT" : "MANUAL_RECORD");

        var isVerified = isStockSufficient || isTransferDelivered || isPoReceived || isExplicitAuditVerified;

        var previousStatus = alert.Status;
        alert.Status = ShortageAlertStatuses.Resolved;
        alert.ResolvedAt ??= DateTime.UtcNow;
        alert.UpdatedAt = DateTime.UtcNow;
        alert.ResolutionVerified = isVerified;
        alert.VerifiedBy = actor ?? (isVerified ? "Authorized Officer" : null);
        alert.VerificationMethod = verificationMethod;
        alert.VerificationNotes = request?.VerificationNotes ?? (isStockSufficient
            ? $"Physically verified stock ({currentStock}) covers required lead time of {alert.LeadTimeDays} days."
            : null);

        if (!string.IsNullOrWhiteSpace(request?.VerificationNotes))
        {
            alert.ResolutionReason = request.VerificationNotes;
        }

        var history = new ShortageStatusHistory
        {
            Id = Guid.NewGuid(),
            ShortageAlertId = alert.Id,
            FromStatus = previousStatus,
            ToStatus = ShortageAlertStatuses.Resolved,
            ChangedBy = actor ?? "System",
            ChangedAt = DateTime.UtcNow,
            Reason = alert.ResolutionReason ?? "Shortage resolved",
            Notes = alert.VerificationNotes,
            VerificationMethod = verificationMethod
        };
        alert.StatusHistory ??= new List<ShortageStatusHistory>();
        alert.StatusHistory.Add(history);
        _db.ShortageStatusHistories.Add(history);

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Shortage alert {AlertId} resolved (verified: {Verified})", alert.Id, isVerified);

        if (_notificationService != null)
        {
            try
            {
                var facility = await _db.Facilities.AsNoTracking().FirstOrDefaultAsync(f => f.Id == alert.FacilityId, cancellationToken);
                var medicine = await _db.Medicines.AsNoTracking().FirstOrDefaultAsync(m => m.Id == alert.MedicineId, cancellationToken);
                await _notificationService.CreateNotificationAsync(
                    title: $"Shortage Resolved: {medicine?.Name ?? alert.MedicineId.ToString()}",
                    message: $"{facility?.Name ?? alert.FacilityId.ToString()}: Shortage marked resolved ({verificationMethod}).",
                    severity: "INFO",
                    linkUrl: $"/demand/shortages/{alert.Id}",
                    shortageAlertId: null,
                    facilityId: alert.FacilityId,
                    role: "FacilityManager",
                    userId: null,
                    cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send notification for resolved shortage {AlertId}", alert.Id);
            }
        }

        return ToResponse(alert);
    }

    /// <summary>
    /// Dismisses an active shortage alert as invalid with an auditable reason.
    /// </summary>
    public async Task<ShortageResponse?> DismissShortageAsync(
        Guid id,
        string reason,
        string? actor = null,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .Include(x => x.StatusHistory)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return null;
        }

        var prevStatus = alert.Status;
        alert.Status = ShortageAlertStatuses.Dismissed;
        alert.ResolvedAt ??= DateTime.UtcNow;
        alert.UpdatedAt = DateTime.UtcNow;
        alert.ResolutionReason = reason;

        var history = new ShortageStatusHistory
        {
            Id = Guid.NewGuid(),
            ShortageAlertId = alert.Id,
            FromStatus = prevStatus,
            ToStatus = ShortageAlertStatuses.Dismissed,
            ChangedBy = actor ?? "FacilityManager",
            ChangedAt = DateTime.UtcNow,
            Reason = "Dismissed by manager",
            Notes = reason
        };
        alert.StatusHistory ??= new List<ShortageStatusHistory>();
        alert.StatusHistory.Add(history);
        _db.ShortageStatusHistories.Add(history);

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Shortage alert {AlertId} dismissed by {Actor}. Reason: {Reason}", id, actor, reason);

        return ToResponse(alert);
    }

    /// <summary>
    /// Links an Inter-Hospital Transfer to an active shortage alert.
    /// </summary>
    public async Task<ShortageResponse?> LinkTransferAsync(
        Guid shortageId,
        Guid transferId,
        string? actor,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .Include(x => x.StatusHistory)
            .FirstOrDefaultAsync(x => x.Id == shortageId, cancellationToken);

        if (alert is null) return null;

        var prevStatus = alert.Status;
        alert.TransferId = transferId;
        if (alert.Status == ShortageAlertStatuses.Open)
        {
            alert.Status = ShortageAlertStatuses.Acknowledged;
        }
        alert.UpdatedAt = DateTime.UtcNow;

        var history = new ShortageStatusHistory
        {
            Id = Guid.NewGuid(),
            ShortageAlertId = alert.Id,
            FromStatus = prevStatus,
            ToStatus = alert.Status,
            ChangedBy = actor ?? "System",
            ChangedAt = DateTime.UtcNow,
            Reason = $"Linked inter-hospital transfer {transferId}",
            Notes = "Transfer initiated to alleviate shortage risk."
        };
        alert.StatusHistory ??= new List<ShortageStatusHistory>();
        alert.StatusHistory.Add(history);
        _db.ShortageStatusHistories.Add(history);

        await _db.SaveChangesAsync(cancellationToken);
        return ToResponse(alert);
    }

    /// <summary>
    /// Links a Purchase Order to an active shortage alert.
    /// </summary>
    public async Task<ShortageResponse?> LinkPurchaseOrderAsync(
        Guid shortageId,
        Guid purchaseOrderId,
        string? actor,
        CancellationToken cancellationToken = default)
    {
        var alert = await _db.ShortageAlerts
            .Include(x => x.StatusHistory)
            .FirstOrDefaultAsync(x => x.Id == shortageId, cancellationToken);

        if (alert is null) return null;

        var prevStatus = alert.Status;
        alert.PurchaseOrderId = purchaseOrderId;
        if (alert.Status == ShortageAlertStatuses.Open)
        {
            alert.Status = ShortageAlertStatuses.Acknowledged;
        }
        alert.UpdatedAt = DateTime.UtcNow;

        var poHistory = new ShortageStatusHistory
        {
            Id = Guid.NewGuid(),
            ShortageAlertId = alert.Id,
            FromStatus = prevStatus,
            ToStatus = alert.Status,
            ChangedBy = actor ?? "System",
            ChangedAt = DateTime.UtcNow,
            Reason = $"Linked purchase order {purchaseOrderId}",
            Notes = "Procurement PO created to alleviate shortage risk."
        };
        alert.StatusHistory ??= new List<ShortageStatusHistory>();
        alert.StatusHistory.Add(poHistory);
        _db.ShortageStatusHistories.Add(poHistory);

        await _db.SaveChangesAsync(cancellationToken);
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

    public static ShortageResponse ToResponse(ShortageAlert alert) => new()
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
        Status = alert.Status,
        UpdatedAt = alert.UpdatedAt,
        ResolvedAt = alert.ResolvedAt,
        ResolutionReason = alert.ResolutionReason,
        TransferId = alert.TransferId,
        PurchaseOrderId = alert.PurchaseOrderId,
        ResolutionVerified = alert.ResolutionVerified,
        VerifiedBy = alert.VerifiedBy,
        VerificationNotes = alert.VerificationNotes,
        VerificationMethod = alert.VerificationMethod,
        StatusHistory = alert.StatusHistory?
            .Select(h => new ShortageStatusHistoryResponse(
                h.Id,
                h.FromStatus,
                h.ToStatus,
                h.ChangedBy,
                h.ChangedAt,
                h.Reason,
                h.Notes,
                h.VerificationMethod))
            .OrderByDescending(h => h.ChangedAt)
            .ToList() ?? new List<ShortageStatusHistoryResponse>()
    };
}

/// <summary>
/// Thrown when attempting to mark a shortage resolved without required verification evidence.
/// </summary>
public sealed class ShortageResolutionNotVerifiedException(string message) : Exception(message);

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

