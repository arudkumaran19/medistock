namespace MediStock.Api.Features.Redistribution.Services;

using MediStock.Api.Common;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Domain.Rules;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Redistribution.Validators;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Security;
using Microsoft.EntityFrameworkCore;

/// <summary>A rule broken by a transfer request; mapped to 400/404/409 by the controller.</summary>
public sealed class TransferException(string code, string message, int statusCode = 400) : Exception(message)
{
    public string Code { get; } = code;

    public int StatusCode { get; } = statusCode;
}

/// <summary>
/// Transfer CRUD and lifecycle. Redistribution vertical (Member 3).
///
/// Stock is never edited here directly except to release a reservation: reserving,
/// deducting and receiving all go through the Inventory vertical's InventoryService, so
/// a transfer produces the same batches, balances and stock transactions as any other
/// movement and the two can never disagree.
///
/// Authority: the redistribution agent only recommends a source. Approval is a manager's
/// decision, and reservation is gated by the shared deterministic TransferPolicy.
/// </summary>
public sealed class TransferService
{
    private readonly ApplicationDbContext _db;
    private readonly InventoryService _inventory;
    private readonly CandidateFacilityService _candidates;
    private readonly RoutingService _routing;
    private readonly CurrentUserService _currentUser;

    public TransferService(
        ApplicationDbContext db,
        InventoryService inventory,
        CandidateFacilityService candidates,
        RoutingService routing,
        CurrentUserService currentUser)
    {
        _db = db;
        _inventory = inventory;
        _candidates = candidates;
        _routing = routing;
        _currentUser = currentUser;
    }

    // ------------------------------------------------------------------
    // Read
    // ------------------------------------------------------------------

    public async Task<PagedResponse<TransferResponse>> ListAsync(
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.TransferRequests.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TransferStatus>(status, true, out var parsed))
        {
            query = query.Where(x => x.Status == parsed);
        }

        var all = await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
        var names = await LoadNamesAsync(cancellationToken);
        var mapped = all.Select(x => Map(x, names, includeHistory: false)).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            mapped = mapped.Where(x =>
                    x.TransferNumber.Contains(term, StringComparison.OrdinalIgnoreCase)
                    || x.MedicineName.Contains(term, StringComparison.OrdinalIgnoreCase)
                    || x.DestinationFacilityName.Contains(term, StringComparison.OrdinalIgnoreCase)
                    || (x.SourceFacilityName ?? string.Empty).Contains(term, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var items = mapped.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return new PagedResponse<TransferResponse>(items, mapped.Count, page, pageSize);
    }

    public async Task<TransferSummaryResponse> SummaryAsync(CancellationToken cancellationToken = default)
    {
        var counts = await _db.TransferRequests.AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        int Count(TransferStatus s) => counts.TryGetValue(s, out var n) ? n : 0;

        return new TransferSummaryResponse
        {
            PendingApproval = Count(TransferStatus.Requested) + Count(TransferStatus.Proposed),
            ApprovedOrReserved = Count(TransferStatus.Approved) + Count(TransferStatus.Reserved),
            InTransit = Count(TransferStatus.InTransit),
            Delivered = Count(TransferStatus.Delivered),
        };
    }

    public async Task<TransferResponse> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        return Map(transfer, await LoadNamesAsync(cancellationToken), includeHistory: true);
    }

    public async Task<IReadOnlyList<CandidateFacilityResponse>> CandidatesAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        return await _candidates.RankAsync(transfer.MedicineId, transfer.DestinationFacilityId, transfer.Quantity, cancellationToken);
    }

    public async Task<TransferRouteResponse> RouteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);

        if (transfer.SourceFacilityId is not { } sourceId)
        {
            throw new TransferException("TRANSFER_NO_SOURCE", "No source facility has been proposed yet.");
        }

        var names = await LoadNamesAsync(cancellationToken);
        var (sLat, sLon, _) = _routing.LocationOf(sourceId);
        var (dLat, dLon, _) = _routing.LocationOf(transfer.DestinationFacilityId);
        var (km, minutes) = _routing.Estimate(sourceId, transfer.DestinationFacilityId);

        return new TransferRouteResponse
        {
            SourceFacilityId = sourceId,
            SourceFacilityName = names.Facility(sourceId),
            SourceLatitude = sLat,
            SourceLongitude = sLon,
            DestinationFacilityId = transfer.DestinationFacilityId,
            DestinationFacilityName = names.Facility(transfer.DestinationFacilityId),
            DestinationLatitude = dLat,
            DestinationLongitude = dLon,
            DistanceKm = km,
            DurationMinutes = minutes,
            Provider = RoutingService.Provider,
        };
    }

    // ------------------------------------------------------------------
    // Create / update / cancel
    // ------------------------------------------------------------------

    public async Task<TransferResponse> CreateAsync(CreateTransferRequest request, CancellationToken cancellationToken = default)
    {
        if (TransferValidator.ValidateCreate(request) is { } error)
        {
            throw new TransferException("TRANSFER_VALIDATION_ERROR", error);
        }

        var medicine = await _db.Medicines.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.MedicineId, cancellationToken)
                       ?? throw new TransferException("MEDICINE_NOT_FOUND", "Medicine was not found.", 404);

        if (!medicine.IsActive)
        {
            throw new TransferException("MEDICINE_INACTIVE", "Archived medicines cannot be transferred.");
        }

        if (!await _db.Facilities.AnyAsync(x => x.Id == request.DestinationFacilityId && x.IsActive, cancellationToken))
        {
            throw new TransferException("FACILITY_NOT_FOUND", "Destination facility was not found.", 404);
        }

        var now = DateTime.UtcNow;
        var transfer = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = await NextTransferNumberAsync(now, cancellationToken),
            MedicineId = request.MedicineId,
            DestinationFacilityId = request.DestinationFacilityId,
            Quantity = request.Quantity,
            Priority = request.Priority,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Status = TransferStatus.Draft,
            RequestedByUserId = _currentUser.UserId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        AddHistory(transfer, null, TransferStatus.Draft, "Transfer request created.");

        if (request.Submit)
        {
            Move(transfer, TransferStatus.Requested, "Submitted for approval.");
        }

        _db.TransferRequests.Add(transfer);
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(transfer.Id, cancellationToken);
    }

    public async Task<TransferResponse> UpdateAsync(Guid id, UpdateTransferRequest request, CancellationToken cancellationToken = default)
    {
        if (TransferValidator.ValidateUpdate(request) is { } error)
        {
            throw new TransferException("TRANSFER_VALIDATION_ERROR", error);
        }

        var transfer = await LoadAsync(id, cancellationToken);

        if (!TransferValidator.IsEditable(transfer.Status))
        {
            throw new TransferException(
                "TRANSFER_NOT_EDITABLE",
                $"A transfer can only be edited while Draft or Requested. This one is {transfer.Status}.",
                409);
        }

        transfer.Quantity = request.Quantity;
        transfer.Priority = request.Priority;
        transfer.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        transfer.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    /// <summary>
    /// The DELETE of the CRUD set: a soft delete. The record and its audit trail are
    /// kept and the status becomes Cancelled. A reservation already taken is released.
    /// </summary>
    public async Task<TransferResponse> CancelAsync(Guid id, string? reason, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, TransferStatus.Cancelled);

        await using var tx = await BeginAsync(cancellationToken);

        if (transfer.Status == TransferStatus.Reserved && transfer.SourceFacilityId is { } sourceId)
        {
            await ReleaseReservationAsync(transfer, sourceId, $"Transfer {transfer.TransferNumber} cancelled", cancellationToken);
        }

        Move(transfer, TransferStatus.Cancelled, string.IsNullOrWhiteSpace(reason) ? "Cancelled." : reason.Trim());
        await _db.SaveChangesAsync(cancellationToken);
        if (tx is not null) await tx.CommitAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    public Task<TransferResponse> SubmitAsync(Guid id, CancellationToken cancellationToken = default) =>
        TransitionAsync(id, TransferStatus.Requested, "Submitted for approval.", null, cancellationToken);

    public async Task<TransferResponse> ProposeAsync(Guid id, ProposeSourceRequest request, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, TransferStatus.Proposed);

        var candidates = await _candidates.RankAsync(transfer.MedicineId, transfer.DestinationFacilityId, transfer.Quantity, cancellationToken);
        var chosen = candidates.FirstOrDefault(x => x.FacilityId == request.SourceFacilityId)
                     ?? throw new TransferException(
                         "SOURCE_NOT_ELIGIBLE",
                         "That facility has no stock above its minimum level to give.");

        if (!chosen.CanFulfil)
        {
            throw new TransferException(
                "SOURCE_INSUFFICIENT_SURPLUS",
                $"{chosen.FacilityName} can spare only {chosen.AvailableSurplus} units; {transfer.Quantity} were requested.");
        }

        transfer.SourceFacilityId = chosen.FacilityId;
        transfer.EstimatedDistanceKm = chosen.DistanceKm;
        transfer.EstimatedDurationMinutes = chosen.DurationMinutes;
        transfer.RoutingProvider = RoutingService.Provider;

        var reason = string.IsNullOrWhiteSpace(request.Reason)
            ? $"Proposed {chosen.FacilityName} as source ({chosen.DistanceKm} km, surplus {chosen.AvailableSurplus})."
            : request.Reason.Trim();

        Move(transfer, TransferStatus.Proposed, reason);
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    public async Task<TransferResponse> ApproveAsync(Guid id, string? reason, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, TransferStatus.Approved);

        if (transfer.SourceFacilityId is null)
        {
            throw new TransferException("TRANSFER_NO_SOURCE", "Propose a source facility before approving.");
        }

        transfer.ApprovedByUserId = _currentUser.UserId;
        Move(transfer, TransferStatus.Approved, string.IsNullOrWhiteSpace(reason) ? "Approved by manager." : reason.Trim());
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    public async Task<TransferResponse> RejectAsync(Guid id, string? reason, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new TransferException("REASON_REQUIRED", "A rejection reason is required.");
        }

        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, TransferStatus.Rejected);

        transfer.RejectionReason = reason.Trim();
        Move(transfer, TransferStatus.Rejected, $"Rejected: {reason.Trim()}");
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    /// <summary>
    /// Locks the stock at the source. Gated by the shared deterministic TransferPolicy
    /// (minimum stock, expiry, authorisation) before InventoryService reserves it.
    /// </summary>
    public async Task<TransferResponse> ReserveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, TransferStatus.Reserved);

        var sourceId = transfer.SourceFacilityId
                       ?? throw new TransferException("TRANSFER_NO_SOURCE", "No source facility has been proposed.");

        var balance = await _db.InventoryBalances.AsNoTracking()
                          .Include(x => x.Medicine)
                          .FirstOrDefaultAsync(x => x.MedicineId == transfer.MedicineId && x.FacilityId == sourceId, cancellationToken)
                      ?? throw new TransferException("SOURCE_NO_STOCK", "The source facility holds none of this medicine.");

        var today = DateTime.UtcNow.Date;

        // Earliest expiry first, and never an expired batch.
        var batch = await _db.MedicineBatches.AsNoTracking()
                        .Where(x => x.MedicineId == transfer.MedicineId && x.FacilityId == sourceId
                                    && x.QuantityOnHand > 0 && x.ExpiryDateUtc > today)
                        .OrderBy(x => x.ExpiryDateUtc)
                        .FirstOrDefaultAsync(cancellationToken)
                    ?? throw new TransferException("SOURCE_NO_VALID_BATCH", "The source has no unexpired batch of this medicine.");

        var policy = TransferPolicy.Validate(
            sourceStock: balance.QuantityOnHand,
            reservedStock: balance.QuantityReserved,
            minimumStock: balance.Medicine.MinimumStockLevel,
            transferQuantity: transfer.Quantity,
            expiryDate: DateOnly.FromDateTime(batch.ExpiryDateUtc),
            currentDate: DateOnly.FromDateTime(today),
            storageCompatible: true);

        if (!policy.IsValid)
        {
            throw new TransferException(policy.Code, $"Deterministic validation failed: {policy.Message}", 409);
        }

        await using var tx = await BeginAsync(cancellationToken);

        await _inventory.ReserveAsync(
            new ReserveStockRequest(transfer.MedicineId, sourceId, transfer.Quantity, $"Reserved for transfer {transfer.TransferNumber}"),
            cancellationToken);

        transfer.BatchNumber = batch.BatchNumber;
        Move(transfer, TransferStatus.Reserved, $"Stock reserved at source from batch {batch.BatchNumber}.");
        await _db.SaveChangesAsync(cancellationToken);
        if (tx is not null) await tx.CommitAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    public async Task<TransferResponse> DispatchAsync(Guid id, string? reason, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, TransferStatus.InTransit);

        transfer.DispatchedAtUtc = DateTime.UtcNow;
        Move(transfer, TransferStatus.InTransit, string.IsNullOrWhiteSpace(reason) ? "Picked up and dispatched." : reason.Trim());
        await _db.SaveChangesAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    /// <summary>
    /// Completes the transfer: the reservation is released and the stock deducted at the
    /// source, and the same batch is received at the destination - all in one database
    /// transaction, so stock is never deducted without arriving.
    /// </summary>
    public async Task<TransferResponse> DeliverAsync(Guid id, string? reason, CancellationToken cancellationToken = default)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, TransferStatus.Delivered);

        var sourceId = transfer.SourceFacilityId!.Value;
        var label = $"Transfer {transfer.TransferNumber}";

        var batch = await _db.MedicineBatches.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.MedicineId == transfer.MedicineId && x.FacilityId == sourceId
                                                  && x.BatchNumber == transfer.BatchNumber, cancellationToken)
                    ?? throw new TransferException("SOURCE_BATCH_MISSING", $"Batch {transfer.BatchNumber} is no longer at the source.");

        var destinationBatch = await DestinationBatchNumberAsync(transfer, batch, cancellationToken);

        await using var tx = await BeginAsync(cancellationToken);

        await ReleaseReservationAsync(transfer, sourceId, label, cancellationToken);
        await _inventory.AdjustAsync(new AdjustStockRequest(transfer.MedicineId, sourceId, -transfer.Quantity, $"{label} dispatched"), cancellationToken);
        await _inventory.ReceiveAsync(
            new ReceiveStockRequest(transfer.MedicineId, transfer.DestinationFacilityId, destinationBatch, transfer.Quantity, batch.ExpiryDateUtc, batch.ManufacturingDateUtc),
            cancellationToken);

        transfer.DeliveredAtUtc = DateTime.UtcNow;

        var deliveredNote = string.IsNullOrWhiteSpace(reason) ? "Received and verified at destination." : reason.Trim();
        if (destinationBatch != batch.BatchNumber)
        {
            deliveredNote += $" Source batch {batch.BatchNumber} received as {destinationBatch}.";
        }

        Move(transfer, TransferStatus.Delivered, deliveredNote);
        await _db.SaveChangesAsync(cancellationToken);
        if (tx is not null) await tx.CommitAsync(cancellationToken);

        return await GetAsync(id, cancellationToken);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private async Task<TransferResponse> TransitionAsync(Guid id, TransferStatus to, string reason, Action<TransferRequest>? apply, CancellationToken cancellationToken)
    {
        var transfer = await LoadAsync(id, cancellationToken);
        Guard(transfer, to);
        apply?.Invoke(transfer);
        Move(transfer, to, reason);
        await _db.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    private static void Guard(TransferRequest transfer, TransferStatus to)
    {
        if (!TransferValidator.CanTransition(transfer.Status, to))
        {
            throw new TransferException(
                "INVALID_TRANSFER_TRANSITION",
                $"A transfer cannot move from {transfer.Status} to {to}.",
                409);
        }
    }

    private void Move(TransferRequest transfer, TransferStatus to, string reason)
    {
        var from = transfer.Status;
        transfer.Status = to;
        transfer.UpdatedAtUtc = DateTime.UtcNow;
        AddHistory(transfer, from, to, reason);
    }

    private void AddHistory(TransferRequest transfer, TransferStatus? from, TransferStatus to, string reason)
    {
        var entry = new TransferStatusHistory
        {
            Id = Guid.NewGuid(),
            TransferRequestId = transfer.Id,
            FromStatus = from,
            ToStatus = to,
            ChangedByUserId = _currentUser.UserId,
            ChangedByEmail = _currentUser.Email,
            ChangedAtUtc = DateTime.UtcNow,
            Reason = reason,
        };

        // A new transfer is added with its history; an existing one is tracked, so the
        // entry has to be added to the context explicitly.
        if (_db.Entry(transfer).State == EntityState.Detached)
        {
            transfer.StatusHistory.Add(entry);
        }
        else
        {
            _db.TransferStatusHistory.Add(entry);
        }
    }

    private static readonly System.Text.RegularExpressions.Regex ValidBatch = new("^BATCH-\\d{3}$");

    /// <summary>
    /// The batch number the destination receives under. Inventory accepts only BATCH-###,
    /// but some seeded source batches predate that rule (e.g. DEMO-PARA-CENTRAL-001), and
    /// receiving one under its own name would be rejected. A valid source number is kept;
    /// otherwise an existing destination batch with the same dates is reused, or the
    /// lowest free BATCH-### is taken. The mapping is written to the audit trail.
    /// </summary>
    private async Task<string> DestinationBatchNumberAsync(TransferRequest transfer, MedicineBatch source, CancellationToken cancellationToken)
    {
        if (ValidBatch.IsMatch(source.BatchNumber))
        {
            return source.BatchNumber;
        }

        var existing = await _db.MedicineBatches.AsNoTracking()
            .Where(x => x.MedicineId == transfer.MedicineId && x.FacilityId == transfer.DestinationFacilityId)
            .Select(x => new { x.BatchNumber, x.ExpiryDateUtc, x.ManufacturingDateUtc })
            .ToListAsync(cancellationToken);

        var sameDates = existing.FirstOrDefault(x =>
            ValidBatch.IsMatch(x.BatchNumber)
            && x.ExpiryDateUtc == source.ExpiryDateUtc
            && x.ManufacturingDateUtc == source.ManufacturingDateUtc);

        if (sameDates is not null)
        {
            return sameDates.BatchNumber;
        }

        var taken = existing.Select(x => x.BatchNumber).ToHashSet(StringComparer.OrdinalIgnoreCase);

        for (var n = 1; n <= 999; n++)
        {
            var candidate = $"BATCH-{n:000}";
            if (!taken.Contains(candidate))
            {
                return candidate;
            }
        }

        throw new TransferException("NO_FREE_BATCH_NUMBER", "The destination has no free batch number for this medicine.", 409);
    }

    /// <summary>Gives back a reservation taken for this transfer, recording a Release transaction.</summary>
    private async Task ReleaseReservationAsync(TransferRequest transfer, Guid sourceId, string label, CancellationToken cancellationToken)
    {
        var balance = await _db.InventoryBalances
                          .FirstOrDefaultAsync(x => x.MedicineId == transfer.MedicineId && x.FacilityId == sourceId, cancellationToken)
                      ?? throw new TransferException("SOURCE_NO_STOCK", "The source balance is missing.");

        balance.QuantityReserved = Math.Max(0, balance.QuantityReserved - transfer.Quantity);
        balance.UpdatedAtUtc = DateTime.UtcNow;

        _db.StockTransactions.Add(new StockTransaction
        {
            Id = Guid.NewGuid(),
            MedicineId = transfer.MedicineId,
            FacilityId = sourceId,
            Type = StockTransactionType.Release,
            Quantity = transfer.Quantity,
            BalanceAfter = balance.QuantityOnHand,
            Reason = $"{label}: reservation released",
            CreatedAtUtc = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction?> BeginAsync(CancellationToken cancellationToken) =>
        _db.Database.IsRelational() ? await _db.Database.BeginTransactionAsync(cancellationToken) : null;

    private async Task<TransferRequest> LoadAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.TransferRequests.Include(x => x.StatusHistory).FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
        ?? throw new TransferException("TRANSFER_NOT_FOUND", "Transfer was not found.", 404);

    private async Task<string> NextTransferNumberAsync(DateTime now, CancellationToken cancellationToken)
    {
        var prefix = $"TR-{now:yyyyMMdd}-";
        var today = await _db.TransferRequests.CountAsync(x => x.TransferNumber.StartsWith(prefix), cancellationToken);
        return $"{prefix}{today + 1:0000}";
    }

    private sealed record Names(
        IReadOnlyDictionary<Guid, (string Name, string Unit)> Medicines,
        IReadOnlyDictionary<Guid, string> Facilities)
    {
        public string Facility(Guid id) => Facilities.TryGetValue(id, out var name) ? name : id.ToString()[..8];
    }

    private async Task<Names> LoadNamesAsync(CancellationToken cancellationToken)
    {
        var medicines = await _db.Medicines.AsNoTracking().ToDictionaryAsync(x => x.Id, x => (x.Name, x.Unit), cancellationToken);
        var facilities = await _db.Facilities.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        return new Names(medicines, facilities);
    }

    private static TransferResponse Map(TransferRequest x, Names names, bool includeHistory)
    {
        var medicine = names.Medicines.TryGetValue(x.MedicineId, out var m) ? m : (x.MedicineId.ToString()[..8], "unit");

        return new TransferResponse
        {
            Id = x.Id,
            TransferNumber = x.TransferNumber,
            MedicineId = x.MedicineId,
            MedicineName = medicine.Item1,
            Unit = medicine.Item2,
            SourceFacilityId = x.SourceFacilityId,
            SourceFacilityName = x.SourceFacilityId is { } s ? names.Facility(s) : null,
            DestinationFacilityId = x.DestinationFacilityId,
            DestinationFacilityName = names.Facility(x.DestinationFacilityId),
            Quantity = x.Quantity,
            Priority = x.Priority.ToString(),
            Status = x.Status.ToString(),
            BatchNumber = x.BatchNumber,
            EstimatedDistanceKm = x.EstimatedDistanceKm,
            EstimatedDurationMinutes = x.EstimatedDurationMinutes,
            RoutingProvider = x.RoutingProvider,
            Notes = x.Notes,
            RejectionReason = x.RejectionReason,
            CreatedAtUtc = x.CreatedAtUtc,
            UpdatedAtUtc = x.UpdatedAtUtc,
            DispatchedAtUtc = x.DispatchedAtUtc,
            DeliveredAtUtc = x.DeliveredAtUtc,
            AllowedNextStatuses = TransferValidator.NextStatuses(x.Status).Select(s => s.ToString()).ToList(),
            History = includeHistory
                ? x.StatusHistory.OrderBy(h => h.ChangedAtUtc).Select(h => new TransferHistoryResponse
                {
                    FromStatus = h.FromStatus?.ToString(),
                    ToStatus = h.ToStatus.ToString(),
                    ChangedBy = h.ChangedByEmail,
                    ChangedAtUtc = h.ChangedAtUtc,
                    Reason = h.Reason,
                }).ToList()
                : Array.Empty<TransferHistoryResponse>(),
        };
    }
}
