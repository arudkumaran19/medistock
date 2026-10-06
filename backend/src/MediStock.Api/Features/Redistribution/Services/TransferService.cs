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
using Microsoft.Extensions.DependencyInjection;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Models;
using MediStock.Api.Features.Workflow.Services;

namespace MediStock.Api.Features.Redistribution.Services;

public class TransferService : ITransferService
{
    private readonly MediStockDbContext _dbContext;
    private readonly IRoutingService _routingService;
    private readonly ICandidateFacilityService _candidateFacilityService;
    private readonly TransferValidator _validator;
    private readonly ILogger<TransferService> _logger;
    private readonly IServiceProvider? _serviceProvider;
    private readonly ITransferNotificationService? _notificationService;

    public TransferService(
        MediStockDbContext dbContext,
        IRoutingService routingService,
        ICandidateFacilityService candidateFacilityService,
        TransferValidator validator,
        ILogger<TransferService> logger,
        IServiceProvider? serviceProvider = null,
        ITransferNotificationService? notificationService = null)
    {
        _dbContext = dbContext;
        _routingService = routingService;
        _candidateFacilityService = candidateFacilityService;
        _validator = validator;
        _logger = logger;
        _serviceProvider = serviceProvider;
        _notificationService = notificationService;
    }

    private static readonly Dictionary<Guid, Guid> FacilityAliases = new()
    {
        [Guid.Parse("11111111-1111-1111-1111-111111111111")] = Guid.Parse("a0000000-0000-0000-0000-000000000001"), // Colombo
        [Guid.Parse("22222222-2222-2222-2222-222222222222")] = Guid.Parse("a0000000-0000-0000-0000-000000000002"), // Karapitiya
        [Guid.Parse("33333333-3333-3333-3333-333333333333")] = Guid.Parse("a0000000-0000-0000-0000-000000000003"), // Kandy
    };

    private static readonly Dictionary<Guid, Guid> MedicineAliases = new()
    {
        [Guid.Parse("55555555-5555-5555-5555-555555555555")] = Guid.Parse("b0000000-0000-0000-0000-000000000001"), // Amoxicillin
        [Guid.Parse("66666666-6666-6666-6666-666666666666")] = Guid.Parse("b0000000-0000-0000-0000-000000000002"), // Paracetamol
        [Guid.Parse("77777777-7777-7777-7777-777777777777")] = Guid.Parse("b0000000-0000-0000-0000-000000000005"), // Ceftriaxone
    };

    private static Guid NormalizeFacilityId(Guid id) =>
        FacilityAliases.TryGetValue(id, out var normalized) ? normalized : id;

    private static Guid NormalizeMedicineId(Guid id) =>
        MedicineAliases.TryGetValue(id, out var normalized) ? normalized : id;

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

        var destId = NormalizeFacilityId(request.DestinationFacilityId);
        var destination = await _dbContext.Facilities.FindAsync(new object[] { destId }, ct)
            ?? await _dbContext.Facilities.FindAsync(new object[] { request.DestinationFacilityId }, ct);
        if (destination == null || !destination.IsActive)
        {
            return ApiResponse<TransferResponse>.Fail($"Destination facility {request.DestinationFacilityId} not found or inactive.");
        }

        Facility? source = null;
        if (request.SourceFacilityId.HasValue && request.SourceFacilityId.Value != Guid.Empty)
        {
            var srcId = NormalizeFacilityId(request.SourceFacilityId.Value);
            source = await _dbContext.Facilities.FindAsync(new object[] { srcId }, ct)
                ?? await _dbContext.Facilities.FindAsync(new object[] { request.SourceFacilityId.Value }, ct);
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

        if (request.Items != null && request.Items.Any())
        {
            foreach (var itemDto in request.Items)
            {
                var medId = NormalizeMedicineId(itemDto.MedicineId);
                var med = await _dbContext.Medicines.FindAsync(new object[] { medId }, ct)
                    ?? await _dbContext.Medicines.FindAsync(new object[] { itemDto.MedicineId }, ct);

                transfer.Items.Add(new TransferItem
                {
                    Id = Guid.NewGuid(),
                    TransferRequestId = transfer.Id,
                    MedicineId = med?.Id ?? medId,
                    MedicineName = !string.IsNullOrWhiteSpace(itemDto.MedicineName) ? itemDto.MedicineName : (med?.Name ?? "Medicine"),
                    RequestedQuantity = itemDto.RequestedQuantity,
                    AllocatedQuantity = 0,
                    UnitOfMeasure = string.IsNullOrWhiteSpace(itemDto.UnitOfMeasure) ? (med?.UnitOfMeasure ?? "units") : itemDto.UnitOfMeasure,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        else if (request.MedicineId.HasValue && request.MedicineId.Value != Guid.Empty)
        {
            var medId = NormalizeMedicineId(request.MedicineId.Value);
            var med = await _dbContext.Medicines.FindAsync(new object[] { medId }, ct)
                ?? await _dbContext.Medicines.FindAsync(new object[] { request.MedicineId.Value }, ct);

            transfer.Items.Add(new TransferItem
            {
                Id = Guid.NewGuid(),
                TransferRequestId = transfer.Id,
                MedicineId = med?.Id ?? medId,
                MedicineName = !string.IsNullOrWhiteSpace(request.MedicineName) ? request.MedicineName : (med?.Name ?? "Medicine"),
                RequestedQuantity = request.RequestedQuantity ?? 1,
                AllocatedQuantity = 0,
                UnitOfMeasure = string.IsNullOrWhiteSpace(request.UnitOfMeasure) ? (med?.UnitOfMeasure ?? "units") : request.UnitOfMeasure,
                CreatedAt = DateTime.UtcNow
            });
        }

        AddStatusHistory(transfer, null, TransferStatus.Draft, transfer.RequestedByUserId, "Transfer request draft created.");

        _dbContext.TransferRequests.Add(transfer);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Created new TransferRequest {TransferNumber} (ID: {TransferId}) in Draft status", transfer.TransferNumber, transfer.Id);

        if (request.SourceShortageAlertId.HasValue && request.SourceShortageAlertId.Value != Guid.Empty && _serviceProvider != null)
        {
            var bridge = (IShortageRedistributionBridge?)_serviceProvider.GetService(typeof(IShortageRedistributionBridge));
            if (bridge != null)
            {
                await bridge.ProcessShortageTransferHandoffAsync(request.SourceShortageAlertId.Value, transfer.Id, ct);
            }
        }

        var createdResponse = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(createdResponse, ct);
        }

        return ApiResponse<TransferResponse>.Ok(createdResponse, "Transfer request created successfully.");
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

        await CreateAndBroadcastNotificationsAsync(
            transfer,
            "Your request was submitted",
            $"Your redistribution request {transfer.TransferNumber} has been submitted.",
            "New Transfer Requested",
            $"Redistribution request {transfer.TransferNumber} submitted for {transfer.DestinationFacility?.Name ?? "destination facility"}.",
            ct);

        // Broadcast Requested status immediately
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(MapToResponse(transfer), ct);
        }

        // Auto-trigger the AI planning workflow (calling real Python LangGraph agent via AgentGateway)
        bool workflowTriggered = false;
        var firstItem = transfer.Items.FirstOrDefault();
        var medId = firstItem?.MedicineId ?? Guid.Empty;
        var qty = firstItem?.RequestedQuantity ?? 1;

        if (_serviceProvider != null && medId != Guid.Empty && transfer.DestinationFacilityId != Guid.Empty)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var workflowService = scope.ServiceProvider.GetService<IWorkflowService>();
                if (workflowService != null)
                {
                    var workflowRequest = new StartWorkflowRequest
                    {
                        TransferRequestId = transfer.Id,
                        DestinationFacilityId = transfer.DestinationFacilityId,
                        MedicineId = medId,
                        ShortageQuantity = qty,
                        InitiatorUserId = userId != Guid.Empty ? userId : transfer.RequestedByUserId,
                        AdditionalContext = transfer.Notes
                    };

                    var workflowResult = await workflowService.StartPlanningWorkflowAsync(workflowRequest, ct);
                    if (workflowResult.Success && workflowResult.Data != null)
                    {
                        workflowTriggered = true;
                        transfer.WorkflowRunId = workflowResult.Data.Id;
                        _logger.LogInformation("AI planning workflow auto-triggered for transfer {TransferId}, WorkflowRunId: {RunId}", transfer.Id, workflowResult.Data.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to auto-trigger AI planning workflow for transfer {TransferId}. Falling back to default workflow creation.", transfer.Id);
            }
        }

        if (!workflowTriggered)
        {
            // Fallback: auto-propose best candidate source facility and route so transfer advances to Proposed
            try
            {
                var candidates = await _candidateFacilityService.FindCandidatesForTransferAsync(transfer.Id, ct);
                var bestCandidate = candidates.FirstOrDefault(c => c.AvailableSurplus > 0) ?? candidates.FirstOrDefault();
                if (bestCandidate != null)
                {
                    await ProposeCandidateInternalAsync(transfer.Id, bestCandidate.FacilityId, userId, ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not auto-propose fallback candidate facility for transfer {TransferId}", transfer.Id);
            }

            // Fallback: Ensure a linked WorkflowRun exists in WaitingForApproval state
            if (transfer.WorkflowRunId == null || transfer.WorkflowRunId == Guid.Empty)
            {
                var run = new WorkflowRun
                {
                    Id = Guid.NewGuid(),
                    WorkflowType = "RedistributionPlanning",
                    Status = WorkflowStatus.WaitingForApproval,
                    InitiatorUserId = userId != Guid.Empty ? userId : transfer.RequestedByUserId,
                    StartedAt = DateTime.UtcNow,
                    ContextJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        transferRequestId = transfer.Id,
                        transferNumber = transfer.TransferNumber,
                        destinationFacilityId = transfer.DestinationFacilityId,
                        sourceFacilityId = transfer.SourceFacilityId,
                        priority = transfer.Priority.ToString(),
                        notes = transfer.Notes
                    })
                };

                run.Steps.Add(new WorkflowPlanStep
                {
                    Id = Guid.NewGuid(),
                    WorkflowRunId = run.Id,
                    StepNumber = 1,
                    StepName = "Detect Shortage & Initialize Context",
                    Status = WorkflowStatus.Completed,
                    InputJson = System.Text.Json.JsonSerializer.Serialize(new { transferId = transfer.Id, transferNumber = transfer.TransferNumber }),
                    OutputJson = System.Text.Json.JsonSerializer.Serialize(new { status = "Requested", submittedBy = userId }),
                    ExecutedAt = DateTime.UtcNow
                });

                run.Steps.Add(new WorkflowPlanStep
                {
                    Id = Guid.NewGuid(),
                    WorkflowRunId = run.Id,
                    StepNumber = 2,
                    StepName = "Awaiting Human-in-the-Loop Management Approval",
                    Status = WorkflowStatus.WaitingForApproval,
                    InputJson = System.Text.Json.JsonSerializer.Serialize(new { prompt = "Transfer request submitted and ready for manager sign-off." }),
                    ExecutedAt = DateTime.UtcNow
                });

                _dbContext.WorkflowRuns.Add(run);
                transfer.WorkflowRunId = run.Id;
                await _dbContext.SaveChangesAsync(ct);
            }
            else
            {
                var existingRun = await _dbContext.WorkflowRuns.FindAsync(new object[] { transfer.WorkflowRunId.Value }, ct);
                if (existingRun != null && existingRun.Status != WorkflowStatus.Approved && existingRun.Status != WorkflowStatus.Rejected)
                {
                    existingRun.Status = WorkflowStatus.WaitingForApproval;
                    await _dbContext.SaveChangesAsync(ct);
                }
            }
        }

        // Reload transfer to ensure all updated navigation properties/status are reflected
        var updatedTransfer = await _dbContext.TransferRequests
            .Include(t => t.Items)
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct) ?? transfer;

        _logger.LogInformation("Transfer {TransferNumber} transitioned to {Status} status", updatedTransfer.TransferNumber, updatedTransfer.Status);
        return ApiResponse<TransferResponse>.Ok(MapToResponse(updatedTransfer), "Transfer request submitted successfully.");
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

        if (transfer.SourceFacilityId == null && request.SourceFacilityId.HasValue && request.SourceFacilityId.Value != Guid.Empty)
        {
            transfer.SourceFacilityId = request.SourceFacilityId.Value;
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

            await CreateAndBroadcastNotificationsAsync(
                transfer,
                "Medicines reserved",
                $"Medicines for {transfer.TransferNumber} are reserved and packed at {transfer.SourceFacility?.Name ?? "depot"}.",
                "Stock Reserved at Depot",
                $"Items for {transfer.TransferNumber} reserved at {transfer.SourceFacility?.Name ?? "depot"}.",
                ct);

            _logger.LogInformation("Transfer {TransferNumber} successfully reserved inventory", transfer.TransferNumber);
            var reservedResponse = MapToResponse(transfer);
            if (_notificationService != null)
            {
                await _notificationService.BroadcastStatusChangedAsync(reservedResponse, ct);
            }
            return ApiResponse<TransferResponse>.Ok(reservedResponse, "Transfer inventory reserved successfully.");
        }
        catch (Exception ex)
        {
            if (transaction != null) await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Error reserving inventory for transfer {TransferId}", transferId);
            return ApiResponse<TransferResponse>.Fail($"Database error reserving inventory: {ex.Message}");
        }
    }

    public async Task<ApiResponse<TransferResponse>> DispatchTransferAsync(
        Guid transferId,
        DispatchTransferRequest request,
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

        var (isValid, error) = _validator.ValidateStatusTransition(transfer.Status, TransferStatus.Dispatched);
        if (!isValid)
        {
            return ApiResponse<TransferResponse>.Fail(error!);
        }

        var previousStatus = transfer.Status;
        transfer.Status = TransferStatus.Dispatched;
        transfer.DispatchedAt = DateTime.UtcNow;
        transfer.UpdatedAt = DateTime.UtcNow;

        var dispatchNote = string.IsNullOrWhiteSpace(request.Notes)
            ? $"Transfer dispatched and in transit to {transfer.DestinationFacility?.Name ?? "destination facility"}."
            : request.Notes;

        if (!string.IsNullOrWhiteSpace(request.CarrierName))
        {
            dispatchNote += $" Carrier: {request.CarrierName}.";
        }
        if (!string.IsNullOrWhiteSpace(request.TrackingNumber))
        {
            dispatchNote += $" Tracking #: {request.TrackingNumber}.";
        }

        AddStatusHistory(transfer, previousStatus, TransferStatus.Dispatched, request.UserId, dispatchNote);

        await _dbContext.SaveChangesAsync(ct);

        await CreateAndBroadcastNotificationsAsync(
            transfer,
            "Your medicines are on the way",
            $"Field courier has picked up items for {transfer.TransferNumber} and is en route.",
            "Transfer In Transit",
            $"Courier is delivering {transfer.TransferNumber}.",
            ct);

        _logger.LogInformation("Transfer {TransferNumber} successfully dispatched", transfer.TransferNumber);
        var dispatchedResponse = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(dispatchedResponse, ct);
        }
        return ApiResponse<TransferResponse>.Ok(dispatchedResponse, "Transfer successfully marked as dispatched.");
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

                var qtyToDeduct = item.AllocatedQuantity > 0 
                    ? item.AllocatedQuantity 
                    : (item.RequestedQuantity > 0 ? item.RequestedQuantity : verification.ReceivedQuantity);

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

            await CreateAndBroadcastNotificationsAsync(
                transfer,
                "Medicines delivered",
                $"Transfer {transfer.TransferNumber} has arrived and receipt was verified.",
                "Delivery Completed",
                $"Transfer {transfer.TransferNumber} has been delivered and received.",
                ct);

            _logger.LogInformation("Transfer {TransferNumber} successfully received and verified", transfer.TransferNumber);
            var receivedResponse = MapToResponse(transfer);
            if (_notificationService != null)
            {
                await _notificationService.BroadcastStatusChangedAsync(receivedResponse, ct);
            }
            return ApiResponse<TransferResponse>.Ok(receivedResponse, "Transfer received and inventory balances updated successfully.");
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
        transfer.ApprovedByUserId = approverUserId != Guid.Empty ? approverUserId : Constants.SystemUsers.DefaultTestUserId;
        var officerId = Constants.SystemUsers.DefaultTestUserId;

        transfer.AssignedOfficerId = officerId;
        transfer.AssignedAt = DateTime.UtcNow;
        transfer.Status = TransferStatus.Assigned;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.Approved, transfer.ApprovedByUserId.Value, notes ?? "Transfer proposal approved via workflow approval decision.");
        AddStatusHistory(transfer, TransferStatus.Approved, TransferStatus.Assigned, officerId, $"Assigned to field officer {officerId}");

        await _dbContext.SaveChangesAsync(ct);

        var firstItemName = transfer.Items.FirstOrDefault()?.MedicineName ?? "Medicine";
        var pickupName = transfer.SourceFacility?.Name ?? "Source Facility";
        var deliveryName = transfer.DestinationFacility?.Name ?? "Destination Facility";
        var distanceKm = transfer.EstimatedDistanceKm ?? 0m;

        await CreateAndBroadcastNotificationsAsync(
            transfer,
            "New delivery task",
            $"{firstItemName} from {pickupName} to {deliveryName}, {distanceKm} km",
            "Transfer Approved & Assigned",
            $"Transfer {transfer.TransferNumber} was approved and assigned to officer.",
            ct);

        _logger.LogInformation("Transfer {TransferNumber} approved and assigned to officer {OfficerId}", transfer.TransferNumber, officerId);
        var approvedResponse = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(approvedResponse, ct);
            await _notificationService.BroadcastTaskAssignedAsync(officerId.ToString(), approvedResponse, ct);
        }
        return ApiResponse<TransferResponse>.Ok(approvedResponse, "Transfer proposal approved and assigned successfully.");
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

        await CreateAndBroadcastNotificationsAsync(
            transfer,
            "Transfer rejected",
            $"Your transfer request {transfer.TransferNumber} was rejected: {reason}",
            "Transfer Rejected",
            $"Transfer {transfer.TransferNumber} was rejected.",
            ct);

        _logger.LogInformation("Transfer {TransferNumber} rejected internally via workflow approval", transfer.TransferNumber);
        var rejectedResponse = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(rejectedResponse, ct);
        }
        return ApiResponse<TransferResponse>.Ok(rejectedResponse, "Transfer proposal rejected.");
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

        await CreateAndBroadcastNotificationsAsync(
            transfer,
            "Source facility proposed",
            $"Candidate supply sources have been matched for {transfer.TransferNumber} from {sourceFacility.Name}.",
            "Proposal Ready for Review",
            $"Transfer request {transfer.TransferNumber} has matching supply sources proposed from {sourceFacility.Name}.",
            ct);

        var proposedResponse = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(proposedResponse, ct);
        }
        return ApiResponse<TransferResponse>.Ok(proposedResponse, "Candidate proposed successfully.");
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
            LastLatitude = t.LastLatitude,
            LastLongitude = t.LastLongitude,
            LastLocationAt = t.LastLocationAt,
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

    public async Task<ApiResponse<TransferResponse>> UpdateTransferLocationAsync(
        Guid transferId,
        UpdateTransferLocationRequest request,
        CancellationToken ct = default)
    {
        if (request == null)
        {
            return ApiResponse<TransferResponse>.Fail("Invalid location update payload.");
        }

        var transfer = await _dbContext.TransferRequests
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.Items)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer {transferId} not found.");
        }

        // Location updates are only valid while the transfer is InTransit (or Dispatched)
        if (transfer.Status != TransferStatus.InTransit && transfer.Status != TransferStatus.Dispatched)
        {
            return ApiResponse<TransferResponse>.Fail(
                $"Cannot update location for transfer in status {transfer.Status}. Location tracking is only permitted while InTransit.");
        }

        var timestamp = request.Timestamp ?? DateTime.UtcNow;
        transfer.LastLatitude = request.Latitude;
        transfer.LastLongitude = request.Longitude;
        transfer.LastLocationAt = timestamp;
        transfer.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        var locationUpdateDto = new TransferLocationUpdateDto
        {
            TransferId = transfer.Id,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Speed = request.Speed,
            Heading = request.Heading,
            Timestamp = timestamp
        };

        if (_notificationService != null)
        {
            await _notificationService.BroadcastLocationUpdatedAsync(locationUpdateDto, ct);
        }

        var response = MapToResponse(transfer);
        return ApiResponse<TransferResponse>.Ok(response, "Location updated successfully.");
    }

    private async Task CreateAndBroadcastNotificationsAsync(
        TransferRequest transfer,
        string fieldOfficerTitle,
        string fieldOfficerMessage,
        string managerTitle,
        string managerMessage,
        CancellationToken ct = default)
    {
        try
        {
            var fieldOfficerNotif = new TransferNotification
            {
                Id = Guid.NewGuid(),
                TransferId = transfer.Id,
                Audience = "FieldOfficer",
                RecipientUserId = transfer.RequestedByUserId,
                Title = fieldOfficerTitle,
                Message = fieldOfficerMessage,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            var managerNotif = new TransferNotification
            {
                Id = Guid.NewGuid(),
                TransferId = transfer.Id,
                Audience = "Manager",
                RecipientUserId = null,
                Title = managerTitle,
                Message = managerMessage,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.TransferNotifications.AddRange(fieldOfficerNotif, managerNotif);
            await _dbContext.SaveChangesAsync(ct);

            if (_notificationService != null)
            {
                var foDto = new TransferNotificationResponse
                {
                    Id = fieldOfficerNotif.Id,
                    TransferId = fieldOfficerNotif.TransferId,
                    Audience = fieldOfficerNotif.Audience,
                    RecipientUserId = fieldOfficerNotif.RecipientUserId,
                    Title = fieldOfficerNotif.Title,
                    Message = fieldOfficerMessage,
                    IsRead = fieldOfficerNotif.IsRead,
                    CreatedAt = fieldOfficerNotif.CreatedAt
                };
                await _notificationService.BroadcastNotificationCreatedAsync(foDto, ct);

                var mgrDto = new TransferNotificationResponse
                {
                    Id = managerNotif.Id,
                    TransferId = managerNotif.TransferId,
                    Audience = managerNotif.Audience,
                    RecipientUserId = managerNotif.RecipientUserId,
                    Title = managerNotif.Title,
                    Message = managerNotif.Message,
                    IsRead = managerNotif.IsRead,
                    CreatedAt = managerNotif.CreatedAt
                };
                await _notificationService.BroadcastNotificationCreatedAsync(mgrDto, ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create/broadcast notifications for transfer {TransferId}", transfer.Id);
        }
    }

    public async Task<ApiResponse<TransferResponse>> AcceptTransferAsync(Guid transferId, Guid officerId, CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);
        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail("Transfer not found");
        }

        var previousStatus = transfer.Status;
        transfer.Status = TransferStatus.Reserved;
        transfer.AssignedOfficerId = officerId;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.Reserved, officerId, "Field officer accepted task assignment.");

        await _dbContext.SaveChangesAsync(ct);

        var response = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(response, ct);
        }

        return ApiResponse<TransferResponse>.Ok(response, "Transfer accepted successfully.");
    }

    public async Task<ApiResponse<TransferResponse>> DeclineTransferAsync(Guid transferId, Guid officerId, string? reason = null, CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);
        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail("Transfer not found");
        }

        var previousStatus = transfer.Status;
        transfer.Status = TransferStatus.PendingReassignment;
        transfer.AssignedOfficerId = null;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.PendingReassignment, officerId, reason ?? "Field officer declined task assignment.");

        await _dbContext.SaveChangesAsync(ct);

        var response = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(response, ct);
        }

        return ApiResponse<TransferResponse>.Ok(response, "Transfer declined and marked pending reassignment.");
    }

    public async Task<PagedResponse<TransferResponse>> GetAssignedTransfersAsync(Guid officerId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        return await GetTransfersAsync(page, pageSize, null, "createdAt", "desc", null, null, ct);
    }
}
