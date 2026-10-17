using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
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
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Demand.Models;

namespace MediStock.Api.Features.Redistribution.Services;

public class TransferService : ITransferService
{
    private readonly MediStockDbContext _dbContext;
    private readonly ApplicationDbContext? _appDbContext;
    private readonly IRoutingService _routingService;
    private readonly ICandidateFacilityService _candidateFacilityService;
    private readonly TransferValidator _validator;
    private readonly ILogger<TransferService> _logger;
    private readonly IServiceProvider? _serviceProvider;
    private readonly ITransferNotificationService? _notificationService;
    private readonly MediStock.Api.Features.Procurement.Services.ProcurementService? _procurementService;

    public TransferService(
        MediStockDbContext dbContext,
        IRoutingService routingService,
        ICandidateFacilityService candidateFacilityService,
        TransferValidator validator,
        ILogger<TransferService> logger,
        IServiceProvider? serviceProvider = null,
        ITransferNotificationService? notificationService = null,
        ApplicationDbContext? appDbContext = null,
        MediStock.Api.Features.Procurement.Services.ProcurementService? procurementService = null)
    {
        _dbContext = dbContext;
        _routingService = routingService;
        _candidateFacilityService = candidateFacilityService;
        _validator = validator;
        _logger = logger;
        _serviceProvider = serviceProvider;
        _notificationService = notificationService;
        _appDbContext = appDbContext;
        _procurementService = procurementService;
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
        var entities = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        var items = entities.Select(MapToResponse).ToList();

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

        if (request.Items != null && request.Items.Any())
        {
            foreach (var itemDto in request.Items)
            {
                var med = await _dbContext.Medicines.FindAsync(new object[] { itemDto.MedicineId }, ct);

                transfer.Items.Add(new TransferItem
                {
                    Id = Guid.NewGuid(),
                    TransferRequestId = transfer.Id,
                    MedicineId = med?.Id ?? itemDto.MedicineId,
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
            var med = await _dbContext.Medicines.FindAsync(new object[] { request.MedicineId.Value }, ct);

            transfer.Items.Add(new TransferItem
            {
                Id = Guid.NewGuid(),
                TransferRequestId = transfer.Id,
                MedicineId = med?.Id ?? request.MedicineId.Value,
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

        if (transfer.Status != TransferStatus.Requested && transfer.Status != TransferStatus.Rejected)
        {
            var (isValid, error) = _validator.ValidateStatusTransition(transfer.Status, TransferStatus.Requested);
            if (!isValid)
            {
                return ApiResponse<TransferResponse>.Fail(error!);
            }
        }

        var previousStatus = transfer.Status;
        transfer.Status = TransferStatus.Requested;
        transfer.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(notes))
        {
            transfer.Notes = string.IsNullOrWhiteSpace(transfer.Notes) ? notes : $"{transfer.Notes} | {notes}";
        }

        if (previousStatus != TransferStatus.Requested)
        {
            AddStatusHistory(transfer, previousStatus, TransferStatus.Requested, userId, notes ?? "Formally submitted transfer request for approval.");
        }
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
                        await _dbContext.SaveChangesAsync(ct);
                        _logger.LogInformation("AI planning workflow auto-triggered for transfer {TransferId}, WorkflowRunId: {RunId}", transfer.Id, workflowResult.Data.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to auto-trigger AI planning workflow for transfer {TransferId}. Falling back to default workflow creation.", transfer.Id);
            }
        }

        if ((transfer.SourceFacilityId == null || transfer.SourceFacilityId == Guid.Empty) && firstItem != null && medId != Guid.Empty)
        {
            bool planningError = false;
            string? planningErrorMessage = null;
            List<CandidateFacilityResponse> candidates = new();

            try
            {
                candidates = await _candidateFacilityService.FindCandidatesForTransferAsync(transfer.Id, ct);
            }
            catch (Exception ex)
            {
                planningError = true;
                planningErrorMessage = ex.Message;
                _logger.LogError(ex, "Candidate search or route calculation error for transfer {TransferId}", transfer.Id);
            }

            if (planningError)
            {
                // =====================================================================
                // Outcome B: Agent/ORS/database error
                // Keep Requested, record error on workflow run, show "Planning failed, retry"
                // No rejection, no purchase request.
                // =====================================================================
                if (transfer.WorkflowRunId.HasValue && transfer.WorkflowRunId.Value != Guid.Empty)
                {
                    var existingRun = await _dbContext.WorkflowRuns.FindAsync(new object[] { transfer.WorkflowRunId.Value }, ct);
                    if (existingRun != null)
                    {
                        existingRun.Status = WorkflowStatus.Failed;
                        existingRun.Steps.Add(new WorkflowPlanStep
                        {
                            Id = Guid.NewGuid(),
                            WorkflowRunId = existingRun.Id,
                            StepNumber = existingRun.Steps.Count + 1,
                            StepName = "Planning execution error",
                            Status = WorkflowStatus.Failed.ToString(),
                            OutputJson = System.Text.Json.JsonSerializer.Serialize(new { error = planningErrorMessage }),
                            ExecutedAt = DateTime.UtcNow
                        });
                    }
                }
                else
                {
                    var run = new WorkflowRun
                    {
                        Id = Guid.NewGuid(),
                        WorkflowType = "RedistributionPlanning",
                        Status = WorkflowStatus.Failed,
                        InitiatorUserId = userId != Guid.Empty ? userId : transfer.RequestedByUserId,
                        StartedAt = DateTime.UtcNow,
                        CompletedAt = DateTime.UtcNow,
                        ContextJson = System.Text.Json.JsonSerializer.Serialize(new { transferId = transfer.Id, error = planningErrorMessage })
                    };
                    run.Steps.Add(new WorkflowPlanStep
                    {
                        Id = Guid.NewGuid(),
                        WorkflowRunId = run.Id,
                        StepNumber = 1,
                        StepName = "Planning execution error",
                        Status = WorkflowStatus.Failed.ToString(),
                        OutputJson = System.Text.Json.JsonSerializer.Serialize(new { error = planningErrorMessage }),
                        ExecutedAt = DateTime.UtcNow
                    });
                    _dbContext.WorkflowRuns.Add(run);
                    transfer.WorkflowRunId = run.Id;
                }

                await _dbContext.SaveChangesAsync(ct);
                _logger.LogWarning("Planning failed due to error for transfer {TransferNumber}. Remains in Requested status for retry.", transfer.TransferNumber);

                return ApiResponse<TransferResponse>.Ok(MapToResponse(transfer), "Planning encountered an error. Transfer remains in Requested status for retry.");
            }

            var eligibleCandidates = (candidates ?? new List<CandidateFacilityResponse>())
                .Where(c => c != null && c.AvailableSurplus > 0)
                .ToList();

            if (eligibleCandidates.Any())
            {
                // =====================================================================
                // Outcome A: Candidates found
                // Advance to Proposed (unchanged behavior)
                // =====================================================================
                var bestCandidate = eligibleCandidates.First();
                if (firstItem != null)
                {
                    var surplus = bestCandidate.AvailableSurplus;
                    var requested = firstItem.RequestedQuantity;
                    var recommendedQty = Math.Min(requested, surplus);
                    firstItem.AllocatedQuantity = recommendedQty;
                }
                var prevStatusBeforeProposed = transfer.Status;
                var sourceFacility = await _dbContext.Facilities.FindAsync(new object[] { bestCandidate.FacilityId }, ct);
                transfer.SourceFacilityId = bestCandidate.FacilityId;
                transfer.SourceFacility = sourceFacility;
                transfer.Status = TransferStatus.Proposed;
                transfer.EstimatedDistanceKm = bestCandidate.DistanceKm;
                transfer.EstimatedDurationMinutes = bestCandidate.EstimatedDurationMinutes;
                transfer.RoutingProvider = bestCandidate.RoutingProvider;
                transfer.UpdatedAt = DateTime.UtcNow;
                AddStatusHistory(transfer, prevStatusBeforeProposed, TransferStatus.Proposed, userId, $"Proposed candidate source facility {bestCandidate.FacilityName}");

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
                        Status = WorkflowStatus.Completed.ToString(),
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
                        Status = WorkflowStatus.WaitingForApproval.ToString(),
                        InputJson = System.Text.Json.JsonSerializer.Serialize(new { prompt = "Transfer request submitted and ready for manager sign-off." }),
                        ExecutedAt = DateTime.UtcNow
                    });

                    _dbContext.WorkflowRuns.Add(run);
                    transfer.WorkflowRunId = run.Id;
                }
                else
                {
                    var existingRun = await _dbContext.WorkflowRuns.FindAsync(new object[] { transfer.WorkflowRunId.Value }, ct);
                    if (existingRun != null && existingRun.Status != WorkflowStatus.Approved && existingRun.Status != WorkflowStatus.Rejected)
                    {
                        existingRun.Status = WorkflowStatus.WaitingForApproval;
                    }
                }

                await _dbContext.SaveChangesAsync(ct);
            }

            else
            {
                // =====================================================================
                // Outcome C: Planning completed successfully with ZERO eligible candidates
                // (no facility with surplus > 0 and valid coordinates)
                // Set existing Rejected status with rejectionReason
                // "No facility has surplus stock for this medicine", write TransferStatusHistory,
                // and auto-create exactly one Purchase Order in PendingApproval.
                // =====================================================================
                var prev = transfer.Status;
                transfer.Status = TransferStatus.Rejected;
                transfer.RejectionReason = "No facility has surplus stock for this medicine";
                transfer.UpdatedAt = DateTime.UtcNow;

                AddStatusHistory(transfer, prev, TransferStatus.Rejected, userId, "No facility has surplus stock for this medicine");

                if (transfer.WorkflowRunId.HasValue && transfer.WorkflowRunId.Value != Guid.Empty)
                {
                    var existingRun = await _dbContext.WorkflowRuns.FindAsync(new object[] { transfer.WorkflowRunId.Value }, ct);
                    if (existingRun != null)
                    {
                        existingRun.Status = WorkflowStatus.Rejected;
                    }
                }
                else
                {
                    var run = new WorkflowRun
                    {
                        Id = Guid.NewGuid(),
                        WorkflowType = "RedistributionPlanning",
                        Status = WorkflowStatus.Rejected,
                        InitiatorUserId = userId != Guid.Empty ? userId : transfer.RequestedByUserId,
                        StartedAt = DateTime.UtcNow,
                        CompletedAt = DateTime.UtcNow,
                        ContextJson = System.Text.Json.JsonSerializer.Serialize(new { transferId = transfer.Id, result = "Zero eligible candidate facilities with surplus" })
                    };
                    run.Steps.Add(new WorkflowPlanStep
                    {
                        Id = Guid.NewGuid(),
                        WorkflowRunId = run.Id,
                        StepNumber = 1,
                        StepName = "Redistribution Candidate Analysis",
                        Status = WorkflowStatus.Completed.ToString(),
                        OutputJson = System.Text.Json.JsonSerializer.Serialize(new { eligibleCandidatesCount = 0 }),
                        ExecutedAt = DateTime.UtcNow
                    });
                    _dbContext.WorkflowRuns.Add(run);
                    transfer.WorkflowRunId = run.Id;
                }

                // Idempotently create exactly one Purchase Order in PendingApproval
                await CreatePurchaseOrderForUnsourcedTransferAsync(transfer, ct);

                await _dbContext.SaveChangesAsync(ct);

                // Notifications
                await CreateAndBroadcastNotificationsAsync(
                    transfer,
                    "Transfer rejected",
                    $"Your transfer request {transfer.TransferNumber} was rejected: No facility has surplus stock for this medicine",
                    "Purchase Request Created",
                    $"Purchase request created for {firstItem?.MedicineName ?? "medicine"} (no redistribution source)",
                    ct);

                if (_notificationService != null)
                {
                    await _notificationService.BroadcastStatusChangedAsync(MapToResponse(transfer), ct);
                }

                _logger.LogInformation("Transfer {TransferNumber} rejected: no facility has surplus stock. Purchase request created.", transfer.TransferNumber);
            }
        }

        // Reload transfer to ensure all updated navigation properties/status from workflow child scope are reflected
        try
        {
            await _dbContext.Entry(transfer).ReloadAsync(ct);
            await _dbContext.Entry(transfer).Collection(t => t.Items).LoadAsync(ct);
            foreach (var item in transfer.Items)
            {
                await _dbContext.Entry(item).ReloadAsync(ct);
            }
            await _dbContext.Entry(transfer).Reference(t => t.SourceFacility).LoadAsync(ct);
            await _dbContext.Entry(transfer).Reference(t => t.DestinationFacility).LoadAsync(ct);
            await _dbContext.Entry(transfer).Collection(t => t.StatusHistory).LoadAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not reload transfer {TransferId} from db context", transfer.Id);
        }

        var updatedTransfer = transfer;

        string responseMessage = "Transfer request submitted successfully.";
        var updatedFirstItem = updatedTransfer.Items.FirstOrDefault();
        if (updatedFirstItem != null && updatedFirstItem.AllocatedQuantity > 0 && updatedFirstItem.AllocatedQuantity < updatedFirstItem.RequestedQuantity)
        {
            var shortfall = updatedFirstItem.RequestedQuantity - updatedFirstItem.AllocatedQuantity;
            responseMessage = $"Transfer request submitted. Source facility has available surplus of {updatedFirstItem.AllocatedQuantity} (shortfall of {shortfall} units).";
        }

        return ApiResponse<TransferResponse>.Ok(MapToResponse(updatedTransfer), responseMessage);
    }

    private async Task CreatePurchaseOrderForUnsourcedTransferAsync(TransferRequest transfer, CancellationToken ct)
    {
        // 1. Idempotency check: don't create if already linked in notes
        if (!string.IsNullOrWhiteSpace(transfer.Notes) &&
            (transfer.Notes.Contains("[PO:", StringComparison.OrdinalIgnoreCase) ||
             transfer.Notes.Contains("PurchaseOrder:", StringComparison.OrdinalIgnoreCase)))
        {
            _logger.LogInformation("Purchase order already linked on transfer {TransferNumber}", transfer.TransferNumber);
            return;
        }

        var firstItem = transfer.Items.FirstOrDefault();
        if (firstItem == null || firstItem.MedicineId == Guid.Empty)
        {
            _logger.LogWarning("Transfer {TransferNumber} has no valid item to create purchase order", transfer.TransferNumber);
            return;
        }

        // 2. Deterministic supplier selection: active supplier with shortest lead time
        Guid supplierId = Guid.Empty;
        if (_appDbContext != null)
        {
            var supplier = await _appDbContext.Suppliers
                .AsNoTracking()
                .Where(s => s.IsActive)
                .OrderBy(s => s.LeadTimeDays)
                .ThenBy(s => s.Name)
                .FirstOrDefaultAsync(ct);

            if (supplier != null)
            {
                supplierId = supplier.Id;
            }
        }

        if (supplierId == Guid.Empty)
        {
            var supplier = await _dbContext.Suppliers
                .AsNoTracking()
                .Where(s => s.IsActive)
                .OrderBy(s => s.LeadTimeDays)
                .ThenBy(s => s.Name)
                .FirstOrDefaultAsync(ct);

            if (supplier != null)
            {
                supplierId = supplier.Id;
            }
        }

        if (supplierId == Guid.Empty)
        {
            _logger.LogWarning("No active supplier found to auto-generate purchase order for transfer {TransferNumber}", transfer.TransferNumber);
            return;
        }

        // 3. Build request
        var poRequest = new PurchaseOrderRequest(
            supplierId,
            transfer.DestinationFacilityId,
            new List<PurchaseOrderItemRequest>
            {
                new(firstItem.MedicineId, firstItem.RequestedQuantity, 0.00m)
            }
        );

        // 4. Create and submit via ProcurementService
        PurchaseOrderResponse? createdPo = null;
        var proc = _procurementService;
        if (proc == null && _serviceProvider != null)
        {
            using var scope = _serviceProvider.CreateScope();
            proc = scope.ServiceProvider.GetService<MediStock.Api.Features.Procurement.Services.ProcurementService>();
        }

        if (proc != null)
        {
            try
            {
                createdPo = await proc.CreateAsync(poRequest, ct);
                createdPo = await proc.SubmitAsync(createdPo.Id, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create/submit purchase order via ProcurementService for transfer {TransferNumber}", transfer.TransferNumber);
            }
        }
        else if (_appDbContext != null)
        {
            // Direct DB fallback if ProcurementService was not passed
            var po = new PurchaseOrder
            {
                Id = Guid.NewGuid(),
                SupplierId = supplierId,
                FacilityId = transfer.DestinationFacilityId,
                Status = PurchaseOrderStatus.PendingApproval,
                RequestedAt = DateTime.UtcNow,
                Items = new List<PurchaseOrderItem>
                {
                    new()
                    {
                        Id = Guid.NewGuid(),
                        MedicineId = firstItem.MedicineId,
                        RequestedQuantity = firstItem.RequestedQuantity,
                        UnitPrice = 0.00m
                    }
                }
            };
            _appDbContext.PurchaseOrders.Add(po);
            await _appDbContext.SaveChangesAsync(ct);
            createdPo = new PurchaseOrderResponse(
                po.Id, po.SupplierId, po.FacilityId, po.Status.ToString(),
                po.RequestedAt, null, null, new List<PurchaseOrderItemResponse>
                {
                    new(po.Items.First().Id, firstItem.MedicineId, firstItem.RequestedQuantity, 0.00m)
                },
                null, null, null);
        }

        if (createdPo != null)
        {
            var linkNote = $"[PO:{createdPo.Id}]";
            transfer.Notes = string.IsNullOrWhiteSpace(transfer.Notes)
                ? linkNote
                : $"{transfer.Notes} | {linkNote}";

            _logger.LogInformation("Successfully created and submitted PurchaseOrder {PurchaseOrderId} for unsourced transfer {TransferNumber}", createdPo.Id, transfer.TransferNumber);

            // 5. If ShortageAlert exists for the transfer, move it to DEMAND_RAISED instead of leaving it OPEN
            if (_appDbContext != null)
            {
                var shortageAlert = await _appDbContext.ShortageAlerts
                    .FirstOrDefaultAsync(sa => (sa.RelatedTransferId == transfer.Id ||
                        (sa.FacilityId == transfer.DestinationFacilityId && sa.MedicineId == firstItem.MedicineId && sa.Status == ShortageAlertStatuses.Open)), ct);

                if (shortageAlert != null)
                {
                    shortageAlert.Status = ShortageAlertStatuses.DemandRaised;
                    shortageAlert.RelatedTransferId ??= transfer.Id;
                    shortageAlert.UpdatedAt = DateTime.UtcNow;
                    await _appDbContext.SaveChangesAsync(ct);
                    _logger.LogInformation("Moved ShortageAlert {AlertId} from OPEN to DEMAND_RAISED for transfer {TransferNumber}", shortageAlert.Id, transfer.TransferNumber);
                }
            }
        }
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

        var canUseTransaction = (!_dbContext.Database.ProviderName?.Contains("InMemory") ?? true)
            && (!(_appDbContext?.Database.ProviderName?.Contains("InMemory") ?? true));
        using var transaction = canUseTransaction ? await _dbContext.Database.BeginTransactionAsync(ct) : null;
        if (canUseTransaction && _appDbContext != null && transaction != null)
        {
            var conn = _dbContext.Database.GetDbConnection();
            if (_appDbContext.Database.GetDbConnection() != conn)
            {
                _appDbContext.Database.SetDbConnection(conn);
            }
            await _appDbContext.Database.UseTransactionAsync(transaction.GetDbTransaction(), ct);
        }

        try
        {
            foreach (var alloc in request.ItemAllocations)
            {
                var transferItem = transfer.Items.First(i => i.Id == alloc.TransferItemId);

                if (_appDbContext != null)
                {
                    var balance = await _appDbContext.InventoryBalances
                        .Include(b => b.Medicine)
                        .FirstOrDefaultAsync(b => b.FacilityId == sourceFacilityId && b.MedicineId == transferItem.MedicineId, ct);

                    if (balance == null)
                    {
                        if (transaction != null) await transaction.RollbackAsync(ct);
                        return ApiResponse<TransferResponse>.Fail($"Source facility does not have inventory balance for medicine {transferItem.MedicineName} ({transferItem.MedicineId}).");
                    }

                    var minStock = balance.Medicine?.MinimumStockLevel ?? 0;
                    var availableSurplus = balance.QuantityOnHand - minStock - balance.QuantityReserved;
                    if (alloc.AllocatedQuantity > availableSurplus)
                    {
                        if (transaction != null) await transaction.RollbackAsync(ct);
                        return ApiResponse<TransferResponse>.Fail(
                            $"Cannot allocate {alloc.AllocatedQuantity} units of {transferItem.MedicineName}. Available surplus at source is only {availableSurplus} units (Stock: {balance.QuantityOnHand}, MinStock: {minStock}, Reserved: {balance.QuantityReserved}).");
                    }

                    balance.QuantityReserved += alloc.AllocatedQuantity;
                    balance.UpdatedAtUtc = DateTime.UtcNow;

                    _appDbContext.StockTransactions.Add(new MediStock.Api.Features.Inventory.Models.StockTransaction
                    {
                        Id = Guid.NewGuid(),
                        MedicineId = transferItem.MedicineId,
                        FacilityId = sourceFacilityId,
                        Type = StockTransactionType.Reservation,
                        Quantity = alloc.AllocatedQuantity,
                        BalanceAfter = balance.AvailableQuantity,
                        Reason = $"Transfer {transfer.TransferNumber} reserved at supplying facility",
                        ActorId = request.UserId != Guid.Empty ? request.UserId.ToString() : null,
                        CreatedAtUtc = DateTime.UtcNow
                    });
                }

                // Also update legacy FacilityInventories if present
                var inventory = await _dbContext.FacilityInventories
                    .FirstOrDefaultAsync(fi => fi.FacilityId == sourceFacilityId && fi.MedicineId == transferItem.MedicineId, ct);

                if (inventory != null)
                {
                    var availableSurplus = inventory.StockOnHand - inventory.SafetyStockThreshold - inventory.ReservedStock;
                    if (_appDbContext == null && alloc.AllocatedQuantity > availableSurplus)
                    {
                        if (transaction != null) await transaction.RollbackAsync(ct);
                        return ApiResponse<TransferResponse>.Fail(
                            $"Cannot allocate {alloc.AllocatedQuantity} units of {transferItem.MedicineName}. Available surplus at source is only {availableSurplus} units.");
                    }

                    inventory.ReservedStock += alloc.AllocatedQuantity;
                    inventory.UpdatedAt = DateTime.UtcNow;

                    transferItem.BatchNumber = alloc.BatchNumber ?? inventory.BatchNumber;
                    transferItem.ExpiryDate = alloc.ExpiryDate ?? inventory.ExpiryDate;
                }
                else
                {
                    transferItem.BatchNumber = alloc.BatchNumber ?? "BATCH-001";
                }

                transferItem.AllocatedQuantity = alloc.AllocatedQuantity;
            }

            var previousStatus = transfer.Status;
            transfer.Status = TransferStatus.Reserved;
            transfer.UpdatedAt = DateTime.UtcNow;

            AddStatusHistory(transfer, previousStatus, TransferStatus.Reserved, request.UserId, request.Notes ?? "Source facility stock allocated and reserved successfully.");

            if (_appDbContext != null)
            {
                await _appDbContext.SaveChangesAsync(ct);
            }
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

        var canUseTransaction = (!_dbContext.Database.ProviderName?.Contains("InMemory") ?? true)
            && (!(_appDbContext?.Database.ProviderName?.Contains("InMemory") ?? true));
        using var transaction = canUseTransaction ? await _dbContext.Database.BeginTransactionAsync(ct) : null;
        if (canUseTransaction && _appDbContext != null && transaction != null)
        {
            var conn = _dbContext.Database.GetDbConnection();
            if (_appDbContext.Database.GetDbConnection() != conn)
            {
                _appDbContext.Database.SetDbConnection(conn);
            }
            await _appDbContext.Database.UseTransactionAsync(transaction.GetDbTransaction(), ct);
        }

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

                if (_appDbContext != null)
                {
                    // 1. Decrement source inventory balance
                    var sourceBalance = await _appDbContext.InventoryBalances
                        .FirstOrDefaultAsync(b => b.FacilityId == sourceFacilityId && b.MedicineId == item.MedicineId, ct);

                    if (sourceBalance != null)
                    {
                        sourceBalance.QuantityOnHand = Math.Max(0, sourceBalance.QuantityOnHand - qtyToDeduct);
                        sourceBalance.QuantityReserved = Math.Max(0, sourceBalance.QuantityReserved - qtyToDeduct);
                        sourceBalance.UpdatedAtUtc = DateTime.UtcNow;

                        _appDbContext.StockTransactions.Add(new MediStock.Api.Features.Inventory.Models.StockTransaction
                        {
                            Id = Guid.NewGuid(),
                            MedicineId = item.MedicineId,
                            FacilityId = sourceFacilityId,
                            Type = StockTransactionType.Release,
                            Quantity = -qtyToDeduct,
                            BalanceAfter = sourceBalance.QuantityOnHand,
                            Reason = $"Transfer {transfer.TransferNumber} dispatched and delivered to destination",
                            ActorId = request.ReceivedByUserId != Guid.Empty ? request.ReceivedByUserId.ToString() : null,
                            CreatedAtUtc = DateTime.UtcNow
                        });
                    }

                    // 2. Increment destination inventory balance
                    var destBalance = await _appDbContext.InventoryBalances
                        .FirstOrDefaultAsync(b => b.FacilityId == destFacilityId && b.MedicineId == item.MedicineId, ct);

                    if (destBalance == null)
                    {
                        destBalance = new MediStock.Api.Features.Inventory.Models.InventoryBalance
                        {
                            Id = Guid.NewGuid(),
                            FacilityId = destFacilityId,
                            MedicineId = item.MedicineId,
                            QuantityOnHand = verification.ReceivedQuantity,
                            QuantityReserved = 0,
                            UpdatedAtUtc = DateTime.UtcNow
                        };
                        _appDbContext.InventoryBalances.Add(destBalance);
                    }
                    else
                    {
                        destBalance.QuantityOnHand += verification.ReceivedQuantity;
                        destBalance.UpdatedAtUtc = DateTime.UtcNow;
                    }

                    _appDbContext.StockTransactions.Add(new MediStock.Api.Features.Inventory.Models.StockTransaction
                    {
                        Id = Guid.NewGuid(),
                        MedicineId = item.MedicineId,
                        FacilityId = destFacilityId,
                        Type = StockTransactionType.Receipt,
                        Quantity = verification.ReceivedQuantity,
                        BalanceAfter = destBalance.QuantityOnHand,
                        Reason = $"Transfer {transfer.TransferNumber} received into inventory",
                        ActorId = request.ReceivedByUserId != Guid.Empty ? request.ReceivedByUserId.ToString() : null,
                        CreatedAtUtc = DateTime.UtcNow
                    });
                }

                // 1. Decrement legacy source inventory
                var sourceInventory = await _dbContext.FacilityInventories
                    .FirstOrDefaultAsync(fi => fi.FacilityId == sourceFacilityId && fi.MedicineId == item.MedicineId, ct);

                if (sourceInventory != null)
                {
                    sourceInventory.StockOnHand = Math.Max(0, sourceInventory.StockOnHand - qtyToDeduct);
                    sourceInventory.ReservedStock = Math.Max(0, sourceInventory.ReservedStock - qtyToDeduct);
                    sourceInventory.UpdatedAt = DateTime.UtcNow;
                }

                // 2. Increment legacy destination inventory
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

            if (_appDbContext != null)
            {
                await _appDbContext.SaveChangesAsync(ct);
            }
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

    public async Task<ApiResponse<RouteResponse>> CalculateRoutePreviewAsync(
        Guid sourceFacilityId,
        Guid destinationFacilityId,
        CancellationToken ct = default)
    {
        var sourceFacility = await _dbContext.Facilities.FindAsync(new object[] { sourceFacilityId }, ct);
        if (sourceFacility == null)
        {
            return ApiResponse<RouteResponse>.Fail($"Source facility {sourceFacilityId} not found.");
        }

        var destinationFacility = await _dbContext.Facilities.FindAsync(new object[] { destinationFacilityId }, ct);
        if (destinationFacility == null)
        {
            return ApiResponse<RouteResponse>.Fail($"Destination facility {destinationFacilityId} not found.");
        }

        var route = await _routingService.CalculateRouteAsync(sourceFacility, destinationFacility, ct);
        return ApiResponse<RouteResponse>.Ok(route, "Route preview calculated successfully.");
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
        transfer.Status = TransferStatus.Approved;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.Approved, transfer.ApprovedByUserId.Value, notes ?? "Transfer proposal approved via workflow approval decision.");

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

        var canUseTransaction = (!_dbContext.Database.ProviderName?.Contains("InMemory") ?? true)
            && (!(_appDbContext?.Database.ProviderName?.Contains("InMemory") ?? true));
        using var transaction = canUseTransaction ? await _dbContext.Database.BeginTransactionAsync(ct) : null;
        if (canUseTransaction && _appDbContext != null && transaction != null)
        {
            var conn = _dbContext.Database.GetDbConnection();
            if (_appDbContext.Database.GetDbConnection() != conn)
            {
                _appDbContext.Database.SetDbConnection(conn);
            }
            await _appDbContext.Database.UseTransactionAsync(transaction.GetDbTransaction(), ct);
        }

        try
        {
            if (previousStatus == TransferStatus.Reserved && transfer.SourceFacilityId.HasValue)
            {
                var sourceFacilityId = transfer.SourceFacilityId.Value;
                foreach (var item in transfer.Items)
                {
                    var qtyToRelease = item.AllocatedQuantity > 0 ? item.AllocatedQuantity : item.RequestedQuantity;
                    if (_appDbContext != null)
                    {
                        var balance = await _appDbContext.InventoryBalances
                            .FirstOrDefaultAsync(b => b.FacilityId == sourceFacilityId && b.MedicineId == item.MedicineId, ct);
                        if (balance != null)
                        {
                            balance.QuantityReserved = Math.Max(0, balance.QuantityReserved - qtyToRelease);
                            balance.UpdatedAtUtc = DateTime.UtcNow;

                            _appDbContext.StockTransactions.Add(new MediStock.Api.Features.Inventory.Models.StockTransaction
                            {
                                Id = Guid.NewGuid(),
                                MedicineId = item.MedicineId,
                                FacilityId = sourceFacilityId,
                                Type = StockTransactionType.Release,
                                Quantity = -qtyToRelease,
                                BalanceAfter = balance.AvailableQuantity,
                                Reason = $"Transfer {transfer.TransferNumber} rejected, reservation released",
                                ActorId = rejectorUserId != Guid.Empty ? rejectorUserId.ToString() : null,
                                CreatedAtUtc = DateTime.UtcNow
                            });
                        }
                    }

                    var inv = await _dbContext.FacilityInventories
                        .FirstOrDefaultAsync(fi => fi.FacilityId == sourceFacilityId && fi.MedicineId == item.MedicineId, ct);
                    if (inv != null)
                    {
                        inv.ReservedStock = Math.Max(0, inv.ReservedStock - qtyToRelease);
                        inv.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }

            transfer.Status = TransferStatus.Rejected;
            transfer.RejectionReason = reason;
            transfer.UpdatedAt = DateTime.UtcNow;

            AddStatusHistory(transfer, previousStatus, TransferStatus.Rejected, rejectorUserId, $"Rejected: {reason}");

            if (_appDbContext != null)
            {
                await _appDbContext.SaveChangesAsync(ct);
            }
            await _dbContext.SaveChangesAsync(ct);
            if (transaction != null) await transaction.CommitAsync(ct);

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
        catch (Exception ex)
        {
            if (transaction != null) await transaction.RollbackAsync(ct);
            _logger.LogError(ex, "Error rejecting transfer {TransferId}", transferId);
            return ApiResponse<TransferResponse>.Fail($"Database error rejecting transfer: {ex.Message}");
        }
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
        if (route != null)
        {
            transfer.EstimatedDistanceKm = route.DistanceKm;
            transfer.EstimatedDurationMinutes = route.DurationMinutes;
            transfer.RoutingProvider = route.Provider;
            transfer.RoutePolyline = route.PolylineGeometry;
        }
        transfer.UpdatedAt = DateTime.UtcNow;

        foreach (var item in transfer.Items)
        {
            if (item.AllocatedQuantity == 0)
            {
                item.AllocatedQuantity = item.RequestedQuantity;
            }
        }

        AddStatusHistory(transfer, previousStatus, TransferStatus.Proposed, userId, $"Agent proposed source facility: {sourceFacility.Name}{(route != null ? $" ({route.DistanceKm} km away)" : "")}.");

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

    private static readonly System.Text.RegularExpressions.Regex PoNoteRegex = new(@"\[PO:([0-9a-fA-F-]+)\]", System.Text.RegularExpressions.RegexOptions.Compiled);

    public static TransferResponse MapToResponse(TransferRequest t)
    {
        Guid? poId = null;
        if (!string.IsNullOrEmpty(t.Notes))
        {
            var match = PoNoteRegex.Match(t.Notes);
            if (match.Success && Guid.TryParse(match.Groups[1].Value, out var parsedGuid))
            {
                poId = parsedGuid;
            }
        }

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
            PurchaseOrderId = poId,
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

        // Delegate to ReserveTransferAsync to ensure atomic stock updates (InventoryBalances + StockTransactions)
        var reserveRequest = new ReserveTransferRequest
        {
            SourceFacilityId = transfer.SourceFacilityId,
            UserId = officerId,
            Notes = "Field officer accepted task assignment and reserved stock.",
            ItemAllocations = transfer.Items.Select(i => new ReserveItemAllocationDto
            {
                TransferItemId = i.Id,
                AllocatedQuantity = i.AllocatedQuantity > 0 ? i.AllocatedQuantity : i.RequestedQuantity,
                BatchNumber = i.BatchNumber
            }).ToList()
        };

        var reserveResult = await ReserveTransferAsync(transferId, reserveRequest, ct);
        if (!reserveResult.Success)
        {
            return reserveResult;
        }

        transfer.AssignedOfficerId = officerId;
        await _dbContext.SaveChangesAsync(ct);

        var response = MapToResponse(transfer);
        return ApiResponse<TransferResponse>.Ok(response, "Transfer accepted and inventory reserved successfully.");
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
        transfer.Status = TransferStatus.Approved;
        transfer.AssignedOfficerId = null;
        transfer.UpdatedAt = DateTime.UtcNow;

        AddStatusHistory(transfer, previousStatus, TransferStatus.Approved, officerId, reason ?? "Field officer declined task assignment.");

        await _dbContext.SaveChangesAsync(ct);

        var response = MapToResponse(transfer);
        if (_notificationService != null)
        {
            await _notificationService.BroadcastStatusChangedAsync(response, ct);
        }

        return ApiResponse<TransferResponse>.Ok(response, "Transfer declined and assignment cleared.");
    }

    public async Task<PagedResponse<TransferResponse>> GetAssignedTransfersAsync(Guid officerId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        return await GetTransfersAsync(page, pageSize, null, "createdAt", "desc", null, null, ct);
    }
}
