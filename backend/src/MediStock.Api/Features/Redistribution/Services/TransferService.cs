using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Redistribution.Validators;

namespace MediStock.Api.Features.Redistribution.Services;

public class TransferService : ITransferService
{
    private readonly MediStockDbContext _dbContext;
    private readonly IRoutingService _routingService;
    private readonly ICandidateFacilityService _candidateFacilityService;
    private readonly TransferValidator _validator;
    private readonly ILogger<TransferService> _logger;

    public TransferService(
        MediStockDbContext dbContext,
        IRoutingService routingService,
        ICandidateFacilityService candidateFacilityService,
        TransferValidator validator,
        ILogger<TransferService> logger)
    {
        _dbContext = dbContext;
        _routingService = routingService;
        _candidateFacilityService = candidateFacilityService;
        _validator = validator;
        _logger = logger;
    }

    public async Task<PagedResponse<TransferResponse>> GetTransfersAsync(
        int page,
        int pageSize,
        string? search,
        string? sortBy,
        string? sortOrder,
        Guid? facilityId,
        TransferStatus? status,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize > 0 ? pageSize : Constants.DefaultPageSize, 1, Constants.MaxPageSize);

        var query = _dbContext.TransferRequests
            .AsNoTracking()
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.Items)
            .Include(t => t.StatusHistory)
            .AsQueryable();

        // Filter by Facility (Source or Destination)
        if (facilityId.HasValue && facilityId.Value != Guid.Empty)
        {
            query = query.Where(t => t.DestinationFacilityId == facilityId.Value || t.SourceFacilityId == facilityId.Value);
        }

        // Filter by Status
        if (status.HasValue)
        {
            query = query.Where(t => t.Status == status.Value);
        }

        // Search term
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(t =>
                t.TransferNumber.ToLower().Contains(term) ||
                (t.Notes != null && t.Notes.ToLower().Contains(term)) ||
                (t.DestinationFacility != null && t.DestinationFacility.Name.ToLower().Contains(term)) ||
                (t.SourceFacility != null && t.SourceFacility.Name.ToLower().Contains(term)));
        }

        // Sorting
        var isAsc = string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase);
        query = (sortBy?.ToLower()) switch
        {
            "transfernumber" => isAsc ? query.OrderBy(t => t.TransferNumber) : query.OrderByDescending(t => t.TransferNumber),
            "status" => isAsc ? query.OrderBy(t => t.Status) : query.OrderByDescending(t => t.Status),
            "priority" => isAsc ? query.OrderBy(t => t.Priority) : query.OrderByDescending(t => t.Priority),
            "distance" => isAsc ? query.OrderBy(t => t.EstimatedDistanceKm) : query.OrderByDescending(t => t.EstimatedDistanceKm),
            _ => isAsc ? query.OrderBy(t => t.CreatedAt) : query.OrderByDescending(t => t.CreatedAt)
        };

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => MapToResponse(t))
            .ToListAsync(ct);

        return new PagedResponse<TransferResponse>(items, totalCount, page, pageSize);
    }

    public async Task<TransferResponse?> GetTransferByIdAsync(Guid id, CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .AsNoTracking()
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.Items)
            .Include(t => t.StatusHistory.OrderByDescending(h => h.ChangedAt))
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        return transfer == null ? null : MapToResponse(transfer);
    }

    public async Task<ApiResponse<TransferResponse>> CreateTransferAsync(
        CreateTransferRequest request,
        Guid userId,
        CancellationToken ct = default)
    {
        var (isValid, errors) = _validator.ValidateCreate(request);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail("Validation failed creating transfer request.", errors);
        }

        var destination = await _dbContext.Facilities.FindAsync(new object[] { request.DestinationFacilityId }, ct);
        if (destination == null || !destination.IsActive)
        {
            return ApiResponse<TransferResponse>.Fail($"Destination facility {request.DestinationFacilityId} not found or inactive.");
        }

        Facility? source = null;
        if (request.SourceFacilityId.HasValue && request.SourceFacilityId.Value != Guid.Empty)
        {
            source = await _dbContext.Facilities.FindAsync(new object[] { request.SourceFacilityId.Value }, ct);
            if (source == null || !source.IsActive)
            {
                return ApiResponse<TransferResponse>.Fail($"Source facility {request.SourceFacilityId.Value} not found or inactive.");
            }
        }

        var transferNumber = GenerateTransferNumber();

        var transfer = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = transferNumber,
            DestinationFacilityId = destination.Id,
            DestinationFacility = destination,
            SourceFacilityId = source?.Id,
            SourceFacility = source,
            Priority = request.Priority,
            Status = TransferStatus.Draft,
            Notes = request.Notes,
            RequestedByUserId = request.RequestedByUserId ?? (userId != Guid.Empty ? userId : Constants.SystemUsers.DefaultTestUserId),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // If source facility is already known, precompute route
        if (source != null)
        {
            var route = await _routingService.CalculateRouteAsync(source, destination, ct);
            if (route != null)
            {
                transfer.EstimatedDistanceKm = route.DistanceKm;
                transfer.EstimatedDurationMinutes = route.DurationMinutes;
                transfer.RoutingProvider = route.Provider;
                transfer.RoutePolyline = route.PolylineGeometry;
            }
        }

        foreach (var itemDto in request.Items)
        {
            transfer.Items.Add(new TransferItem
            {
                Id = Guid.NewGuid(),
                TransferRequestId = transfer.Id,
                MedicineId = itemDto.MedicineId,
                MedicineName = itemDto.MedicineName,
                RequestedQuantity = itemDto.RequestedQuantity,
                AllocatedQuantity = 0,
                UnitOfMeasure = string.IsNullOrWhiteSpace(itemDto.UnitOfMeasure) ? "units" : itemDto.UnitOfMeasure,
                CreatedAt = DateTime.UtcNow
            });
        }

        AddStatusHistory(transfer, null, TransferStatus.Draft, transfer.RequestedByUserId, "Transfer request draft created.");

        _dbContext.TransferRequests.Add(transfer);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Created new TransferRequest {TransferNumber} (ID: {TransferId}) in Draft status", transfer.TransferNumber, transfer.Id);

        return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Transfer request created successfully.");
    }

    public async Task<ApiResponse<TransferResponse>> SubmitTransferRequestAsync(
        Guid transferId,
        Guid userId,
        string? notes = null,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.Items)
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer request {transferId} not found.");
        }

        var (isValid, error) = _validator.ValidateStatusTransition(transfer.Status, TransferStatus.Requested);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail(error!);
        }

        var previousStatus = transfer.Status;
        transfer.Status = TransferStatus.Requested;
        transfer.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(notes))
        {
            transfer.Notes = string.IsNullOrWhiteSpace(transfer.Notes) ? notes : $"{transfer.Notes} | {notes}";
        }

        AddStatusHistory(transfer, previousStatus, TransferStatus.Requested, userId, notes ?? "Formally submitted transfer request for approval.");

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Transfer {TransferNumber} transitioned to Requested status", transfer.TransferNumber);
        return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Transfer request submitted successfully.");
    }

    public async Task<ApiResponse<TransferResponse>> ReserveTransferAsync(
        Guid transferId,
        ReserveTransferRequest request,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.Items)
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer request {transferId} not found.");
        }

        var (isValid, errors) = _validator.ValidateReservation(transfer, request);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail("Reservation validation failed.", errors);
        }

        var sourceFacilityId = transfer.SourceFacilityId!.Value;

        var canUseTransaction = !_dbContext.Database.ProviderName?.Contains("InMemory") ?? true;
        using var transaction = canUseTransaction ? await _dbContext.Database.BeginTransactionAsync(ct) : null;
        try
        {
            foreach (var alloc in request.ItemAllocations)
            {
                var transferItem = transfer.Items.First(i => i.Id == alloc.TransferItemId);

                // Fetch source facility inventory record
                var inventory = await _dbContext.FacilityInventories
                    .FirstOrDefaultAsync(fi => fi.FacilityId == sourceFacilityId && fi.MedicineId == transferItem.MedicineId, ct);

                if (inventory == null)
                {
                    if (transaction != null) await transaction.RollbackAsync(ct);
                    return ApiResponse<TransferResponse>.Fail($"Source facility does not have inventory record for medicine {transferItem.MedicineName} ({transferItem.MedicineId}).");
                }

                var availableSurplus = inventory.StockOnHand - inventory.SafetyStockThreshold - inventory.ReservedStock;
                if (alloc.AllocatedQuantity > availableSurplus)
                {
                    if (transaction != null) await transaction.RollbackAsync(ct);
                    return ApiResponse<TransferResponse>.Fail(
                        $"Cannot allocate {alloc.AllocatedQuantity} units of {transferItem.MedicineName}. Available surplus at source is only {availableSurplus} units (Stock: {inventory.StockOnHand}, Safety: {inventory.SafetyStockThreshold}, Reserved: {inventory.ReservedStock}).");
                }

                // Lock inventory stock
                inventory.ReservedStock += alloc.AllocatedQuantity;
                inventory.UpdatedAt = DateTime.UtcNow;

                // Update transfer line item allocation
                transferItem.AllocatedQuantity = alloc.AllocatedQuantity;
                transferItem.BatchNumber = alloc.BatchNumber ?? inventory.BatchNumber;
                transferItem.ExpiryDate = alloc.ExpiryDate ?? inventory.ExpiryDate;
            }

            var previousStatus = transfer.Status;
            transfer.Status = TransferStatus.Reserved;
            transfer.UpdatedAt = DateTime.UtcNow;

            AddStatusHistory(transfer, previousStatus, TransferStatus.Reserved, request.UserId, request.Notes ?? "Source facility stock allocated and reserved successfully.");

            await _dbContext.SaveChangesAsync(ct);
            if (transaction != null) await transaction.CommitAsync(ct);

            _logger.LogInformation("Transfer {TransferNumber} successfully reserved inventory", transfer.TransferNumber);
            return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Transfer inventory reserved successfully.");
        }
        catch (Exception ex)
        {
            if (transaction != null) await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Error reserving inventory for transfer {TransferId}", transferId);
            return ApiResponse<TransferResponse>.Fail($"Database error reserving inventory: {ex.Message}");
        }
    }

    public async Task<ApiResponse<TransferResponse>> ReceiveTransferAsync(
        Guid transferId,
        ReceiveTransferRequest request,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.Items)
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer request {transferId} not found.");
        }

        var (isValid, errors) = _validator.ValidateReceipt(transfer, request);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail("Receiving verification failed.", errors);
        }

        var canUseTransaction = !_dbContext.Database.ProviderName?.Contains("InMemory") ?? true;
        using var transaction = canUseTransaction ? await _dbContext.Database.BeginTransactionAsync(ct) : null;
        try
        {
            var sourceFacilityId = transfer.SourceFacilityId!.Value;
            var destFacilityId = transfer.DestinationFacilityId;

            foreach (var verification in request.VerifiedItems)
            {
                var item = transfer.Items.First(i => i.Id == verification.TransferItemId);
                item.ReceivedQuantity = verification.ReceivedQuantity;

                var qtyToDeduct = item.AllocatedQuantity;

                // 1. Decrement source inventory
                var sourceInventory = await _dbContext.FacilityInventories
                    .FirstOrDefaultAsync(fi => fi.FacilityId == sourceFacilityId && fi.MedicineId == item.MedicineId, ct);

                if (sourceInventory != null)
                {
                    sourceInventory.StockOnHand = Math.Max(0, sourceInventory.StockOnHand - qtyToDeduct);
                    sourceInventory.ReservedStock = Math.Max(0, sourceInventory.ReservedStock - qtyToDeduct);
                    sourceInventory.UpdatedAt = DateTime.UtcNow;
                }

                // 2. Increment destination inventory
                var destInventory = await _dbContext.FacilityInventories
                    .FirstOrDefaultAsync(fi => fi.FacilityId == destFacilityId && fi.MedicineId == item.MedicineId, ct);

                if (destInventory == null)
                {
                    destInventory = new FacilityInventory
                    {
                        Id = Guid.NewGuid(),
                        FacilityId = destFacilityId,
                        MedicineId = item.MedicineId,
                        StockOnHand = verification.ReceivedQuantity,
                        SafetyStockThreshold = 100, // standard default
                        ReservedStock = 0,
                        BatchNumber = verification.BatchNumber ?? item.BatchNumber ?? "UNKNOWN",
                        ExpiryDate = item.ExpiryDate,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.FacilityInventories.Add(destInventory);
                }
                else
                {
                    destInventory.StockOnHand += verification.ReceivedQuantity;
                    destInventory.UpdatedAt = DateTime.UtcNow;
                }
            }

            var previousStatus = transfer.Status;
            transfer.Status = TransferStatus.Received;
            transfer.ReceivedAt = DateTime.UtcNow;
            transfer.UpdatedAt = DateTime.UtcNow;

            AddStatusHistory(transfer, previousStatus, TransferStatus.Received, request.ReceivedByUserId, request.Notes ?? "Transfer received and verified at destination facility.");

            await _dbContext.SaveChangesAsync(ct);
            if (transaction != null) await transaction.CommitAsync(ct);

            _logger.LogInformation("Transfer {TransferNumber} successfully received and verified", transfer.TransferNumber);
            return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Transfer received and inventory balances updated successfully.");
        }
        catch (Exception ex)
        {
            if (transaction != null) await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Error receiving transfer {TransferId}", transferId);
            return ApiResponse<TransferResponse>.Fail($"Database error receiving transfer: {ex.Message}");
        }
    }

    public async Task<ApiResponse<List<CandidateFacilityResponse>>> GetCandidatesForTransferAsync(
        Guid transferId,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .AsNoTracking()
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<List<CandidateFacilityResponse>>.Fail($"Transfer request {transferId} not found.");
        }

        var candidates = await _candidateFacilityService.FindCandidatesForTransferAsync(transferId, ct);
        return ApiResponse<List<CandidateFacilityResponse>>.Ok(candidates, $"Found {candidates.Count} candidate source facilities with available surplus.");
    }

    public async Task<ApiResponse<RouteResponse>> GetRouteForTransferAsync(
        Guid transferId,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<RouteResponse>.Fail($"Transfer request {transferId} not found.");
        }

        if (transfer.SourceFacilityId == null || transfer.SourceFacility == null)
        {
            return ApiResponse<RouteResponse>.Fail("Transfer does not have an assigned source facility. Candidate selection required first.");
        }

        if (transfer.DestinationFacility == null)
        {
            transfer.DestinationFacility = await _dbContext.Facilities.FindAsync(new object[] { transfer.DestinationFacilityId }, ct);
            if (transfer.DestinationFacility == null)
            {
                return ApiResponse<RouteResponse>.Fail("Destination facility not found.");
            }
        }

        var route = await _routingService.CalculateRouteAsync(transfer.SourceFacility, transfer.DestinationFacility, ct);

        // Update transfer cached route details
        transfer.EstimatedDistanceKm = route.DistanceKm;
        transfer.EstimatedDurationMinutes = route.DurationMinutes;
        transfer.RoutingProvider = route.Provider;
        transfer.RoutePolyline = route.PolylineGeometry;
        transfer.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        return ApiResponse<RouteResponse>.Ok(route, "Route calculated successfully.");
    }

    // =========================================================================
    // INTERNAL WORKFLOW TRANSITIONS (Triggered by WorkflowController / ApprovalService)
    // =========================================================================

    public async Task<ApiResponse<TransferResponse>> ApproveTransferInternalAsync(
        Guid transferId,
        Guid approverUserId,
        string? notes = null,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.Items)
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer request {transferId} not found.");
        }

        var (isValid, error) = _validator.ValidateStatusTransition(transfer.Status, TransferStatus.Approved);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail(error!);
        }

        var previousStatus = transfer.Status;
        transfer.Status = TransferStatus.Approved;
        transfer.ApprovedByUserId = approverUserId != Guid.Empty ? approverUserId : Constants.SystemUsers.DefaultTestUserId;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.Approved, transfer.ApprovedByUserId.Value, notes ?? "Transfer proposal approved via workflow approval decision.");

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Transfer {TransferNumber} approved internally via workflow approval", transfer.TransferNumber);
        return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Transfer proposal approved successfully.");
    }

    public async Task<ApiResponse<TransferResponse>> RejectTransferInternalAsync(
        Guid transferId,
        Guid rejectorUserId,
        string reason,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.Items)
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer request {transferId} not found.");
        }

        var (isValid, error) = _validator.ValidateStatusTransition(transfer.Status, TransferStatus.Rejected);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail(error!);
        }

        var previousStatus = transfer.Status;
        transfer.Status = TransferStatus.Rejected;
        transfer.RejectionReason = reason;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.Rejected, rejectorUserId, $"Rejected: {reason}");

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Transfer {TransferNumber} rejected internally via workflow approval", transfer.TransferNumber);
        return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Transfer proposal rejected.");
    }

    public async Task<ApiResponse<TransferResponse>> ProposeCandidateInternalAsync(
        Guid transferId,
        Guid sourceFacilityId,
        Guid userId,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.Items)
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer request {transferId} not found.");
        }

        var sourceFacility = await _dbContext.Facilities.FindAsync(new object[] { sourceFacilityId }, ct);
        if (sourceFacility == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Source facility {sourceFacilityId} not found.");
        }

        var (isValid, error) = _validator.ValidateStatusTransition(transfer.Status, TransferStatus.Proposed);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail(error!);
        }

        if (transfer.DestinationFacility == null)
        {
            transfer.DestinationFacility = await _dbContext.Facilities.FindAsync(new object[] { transfer.DestinationFacilityId }, ct);
            if (transfer.DestinationFacility == null)
            {
                return ApiResponse<TransferResponse>.Fail("Destination facility not found.");
            }
        }

        var route = await _routingService.CalculateRouteAsync(sourceFacility, transfer.DestinationFacility, ct);

        var previousStatus = transfer.Status;
        transfer.SourceFacilityId = sourceFacilityId;
        transfer.SourceFacility = sourceFacility;
        transfer.Status = TransferStatus.Proposed;
        transfer.EstimatedDistanceKm = route.DistanceKm;
        transfer.EstimatedDurationMinutes = route.DurationMinutes;
        transfer.RoutingProvider = route.Provider;
        transfer.RoutePolyline = route.PolylineGeometry;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.Proposed, userId, $"Agent proposed source facility: {sourceFacility.Name} ({route.DistanceKm} km away).");

        await _dbContext.SaveChangesAsync(ct);
        return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Candidate proposed successfully.");
    }

    public async Task AttachWorkflowRunInternalAsync(Guid transferId, Guid workflowRunId, CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests.FindAsync(new object[] { transferId }, ct);
        if (transfer != null)
        {
            transfer.WorkflowRunId = workflowRunId;
            transfer.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(ct);
        }
    }

    private void AddStatusHistory(
        TransferRequest transfer,
        TransferStatus? fromStatus,
        TransferStatus toStatus,
        Guid userId,
        string? reason = null,
        string? metadataJson = null)
    {
        var history = new TransferStatusHistory
        {
            Id = Guid.NewGuid(),
            TransferRequestId = transfer.Id,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            ChangedByUserId = userId != Guid.Empty ? userId : transfer.RequestedByUserId,
            ChangedAt = DateTime.UtcNow,
            Reason = reason,
            MetadataJson = metadataJson
        };

        _dbContext.TransferStatusHistories.Add(history);
        transfer.StatusHistory.Add(history);
    }

    private static string GenerateTransferNumber()
    {
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var randomPart = Guid.NewGuid().ToString("N")[..4].ToUpper();
        return $"TR-{datePart}-{randomPart}";
    }

    public static TransferResponse MapToResponse(TransferRequest t)
    {
        return new TransferResponse
        {
            Id = t.Id,
            TransferNumber = t.TransferNumber,
            SourceFacilityId = t.SourceFacilityId,
            SourceFacilityName = t.SourceFacility?.Name,
            DestinationFacilityId = t.DestinationFacilityId,
            DestinationFacilityName = t.DestinationFacility?.Name ?? string.Empty,
            Status = t.Status,
            Priority = t.Priority,
            EstimatedDistanceKm = t.EstimatedDistanceKm,
            EstimatedDurationMinutes = t.EstimatedDurationMinutes,
            RoutingProvider = t.RoutingProvider,
            RoutePolyline = t.RoutePolyline,
            RequestedByUserId = t.RequestedByUserId,
            ApprovedByUserId = t.ApprovedByUserId,
            DispatchedAt = t.DispatchedAt,
            ReceivedAt = t.ReceivedAt,
            RejectionReason = t.RejectionReason,
            Notes = t.Notes,
            WorkflowRunId = t.WorkflowRunId,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt,
            Items = t.Items.Select(i => new TransferItemDto
            {
                Id = i.Id,
                MedicineId = i.MedicineId,
                MedicineName = i.MedicineName,
                RequestedQuantity = i.RequestedQuantity,
                AllocatedQuantity = i.AllocatedQuantity,
                ReceivedQuantity = i.ReceivedQuantity,
                UnitOfMeasure = i.UnitOfMeasure,
                BatchNumber = i.BatchNumber,
                ExpiryDate = i.ExpiryDate
            }).ToList(),
            StatusHistory = t.StatusHistory.Select(h => new TransferStatusHistoryDto
            {
                Id = h.Id,
                FromStatus = h.FromStatus,
                ToStatus = h.ToStatus,
                ChangedByUserId = h.ChangedByUserId,
                ChangedAt = h.ChangedAt,
                Reason = h.Reason,
                MetadataJson = h.MetadataJson
            }).ToList()
        };
    }
}
