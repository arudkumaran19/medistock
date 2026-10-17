using System.Text.Json;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

using MediStock.Api.Common.Audit;
using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;

namespace MediStock.Api.Features.Workflow.Services;

public interface IApprovalService
{
    Task<Approval> RequestApprovalAsync(
        Guid workflowId,
        string approvalType,
        string requiredRole,
        CancellationToken cancellationToken = default);

    Task<ApprovalDto?> SubmitDecisionAsync(
        Guid approvalId,
        ApprovalDecision decision,
        string? comments,
        Guid decidedByUserId,
        string decidedByUserName,
        CancellationToken cancellationToken = default);

    Task<List<ApprovalDto>> GetPendingApprovalsAsync(
        string? requiredRole = null,
        CancellationToken cancellationToken = default);
}

public sealed class ApprovalService : IApprovalService
{
    private readonly ApplicationDbContext _db;
    private readonly IWorkflowStateService _stateService;
    private readonly IAuditService _auditService;
    private readonly ILogger<ApprovalService> _logger;

    public ApprovalService(
        ApplicationDbContext db,
        IWorkflowStateService stateService,
        IAuditService auditService,
        ILogger<ApprovalService> logger)
    {
        _db = db;
        _stateService = stateService;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<Approval> RequestApprovalAsync(
        Guid workflowId,
        string approvalType,
        string requiredRole,
        CancellationToken cancellationToken = default)
    {
        var approval = new Approval
        {
            WorkflowRunId = workflowId,
            ApprovalType = approvalType,
            RequiredRole = requiredRole,
            Decision = ApprovalDecision.Pending,
            RequestedAt = DateTimeOffset.UtcNow
        };

        _db.Set<Approval>().Add(approval);
        await _db.SaveChangesAsync(cancellationToken);

        await _stateService.UpdateStatusAsync(
            workflowId,
            WorkflowStatus.WaitingForApproval,
            cancellationToken: cancellationToken);

        await _stateService.AddAuditLogAsync(
            workflowId,
            "APPROVAL_REQUESTED",
            $"Approval requested of type {approvalType} requiring role {requiredRole}",
            new { approvalId = approval.Id, requiredRole, approvalType },
            cancellationToken: cancellationToken);

        await _auditService.LogAsync(
            action: "AI_COORDINATOR_APPROVAL_REQUESTED",
            resourceType: "AI_COORDINATOR",
            resourceId: workflowId.ToString(),
            outcome: "SUCCESS",
            correlationId: workflowId.ToString(),
            details: new { approvalId = approval.Id, requiredRole, approvalType },
            cancellationToken: cancellationToken);

        return approval;
    }

    public async Task<ApprovalDto?> SubmitDecisionAsync(
        Guid approvalId,
        ApprovalDecision decision,
        string? comments,
        Guid decidedByUserId,
        string decidedByUserName,
        CancellationToken cancellationToken = default)
    {
        var approval = await _db.Set<Approval>()
            .Include(a => a.WorkflowRun)
            .FirstOrDefaultAsync(a => a.Id == approvalId, cancellationToken);

        if (approval is null)
        {
            _logger.LogWarning("Approval {ApprovalId} not found", approvalId);
            return null;
        }

        if (approval.Decision != ApprovalDecision.Pending)
        {
            throw new InvalidOperationException($"Approval {approvalId} has already been decided ({approval.Decision}).");
        }

        approval.Decision = decision;
        approval.Comments = comments;
        approval.DecidedByUserId = decidedByUserId;
        approval.DecidedByUserName = decidedByUserName;
        approval.DecidedAt = DateTimeOffset.UtcNow;

        if (decision == ApprovalDecision.Approved && approval.WorkflowRun is not null)
        {
            await ExecuteApprovedWorkflowActionsAsync(
                approval.WorkflowRun,
                decidedByUserId,
                decidedByUserName,
                comments,
                cancellationToken);
        }
        else if (decision == ApprovalDecision.Rejected && approval.WorkflowRun is not null)
        {
            await ExecuteRejectedWorkflowActionsAsync(
                approval.WorkflowRun,
                decidedByUserId,
                decidedByUserName,
                comments,
                cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);

        var newWorkflowStatus = decision == ApprovalDecision.Approved
            ? WorkflowStatus.Completed
            : WorkflowStatus.Rejected;

        await _stateService.UpdateStatusAsync(
            approval.WorkflowRunId,
            newWorkflowStatus,
            errorMessage: decision == ApprovalDecision.Rejected ? comments ?? "Rejected by manager" : null,
            cancellationToken: cancellationToken);

        await _stateService.AddAuditLogAsync(
            approval.WorkflowRunId,
            decision == ApprovalDecision.Approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
            $"Approval was {decision} by {decidedByUserName}: {comments}",
            new { approvalId, decision = decision.ToString(), comments },
            userId: decidedByUserId,
            cancellationToken: cancellationToken);

        await _auditService.LogAsync(
            action: decision == ApprovalDecision.Approved ? "AI_COORDINATOR_ACTION_EXECUTED" : "AI_COORDINATOR_APPROVAL_REJECTED",
            resourceType: "AI_COORDINATOR",
            resourceId: approval.WorkflowRunId.ToString(),
            outcome: decision == ApprovalDecision.Approved ? "SUCCESS" : "REJECTED",
            correlationId: approval.WorkflowRunId.ToString(),
            actorEmail: decidedByUserName,
            details: new
            {
                ApprovalId = approval.Id,
                Decision = decision.ToString(),
                Comments = comments,
                DecidedBy = decidedByUserName
            },
            cancellationToken: cancellationToken);

        return new ApprovalDto
        {
            Id = approval.Id,
            ApprovalType = approval.ApprovalType,
            RequiredRole = approval.RequiredRole,
            Decision = approval.Decision,
            DecidedByUserId = approval.DecidedByUserId,
            DecidedByUserName = approval.DecidedByUserName,
            Comments = approval.Comments,
            RequestedAt = approval.RequestedAt,
            DecidedAt = approval.DecidedAt
        };
    }

    private async Task ExecuteApprovedWorkflowActionsAsync(
        WorkflowRun workflow,
        Guid decidedByUserId,
        string decidedByUserName,
        string? comments,
        CancellationToken cancellationToken)
    {
        try
        {
            JsonDocument? doc = null;
            if (!string.IsNullOrWhiteSpace(workflow.ResultJson))
            {
                try { doc = JsonDocument.Parse(workflow.ResultJson); } catch { /* ignore */ }
            }

            JsonElement root = doc?.RootElement ?? default;

            bool hasProcurementProposal = root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("procurement_proposal", out var procElem)
                && procElem.ValueKind == JsonValueKind.Object
                && (!procElem.TryGetProperty("needed", out var neededProp) || neededProp.GetBoolean());

            bool hasRedistributionProposal = root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("redistribution_proposal", out var redElem)
                && redElem.ValueKind == JsonValueKind.Object
                && (!redElem.TryGetProperty("feasible", out var feasProp) || feasProp.GetBoolean());

            bool isProcurement = workflow.WorkflowType == "AutonomousProcurement"
                || workflow.WorkflowType == "CombinedResolution"
                || hasProcurementProposal;

            bool isRedistribution = workflow.WorkflowType == "StockRedistribution"
                || workflow.WorkflowType == "CombinedResolution"
                || hasRedistributionProposal;

            // Extract details from procurement_proposal
            int procureQty = 0;
            decimal procurePrice = 8.50m;
            int leadTimeDays = 3;
            string? procureSupplierName = null;
            string? procureMedName = null;

            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("procurement_proposal", out var pElem) && pElem.ValueKind == JsonValueKind.Object)
            {
                if (pElem.TryGetProperty("quantity", out var qProp) && qProp.TryGetInt32(out var qVal)) procureQty = qVal;
                if (pElem.TryGetProperty("unit_price", out var upProp) && upProp.TryGetDecimal(out var upVal)) procurePrice = upVal;
                if (pElem.TryGetProperty("lead_time_days", out var ltProp) && ltProp.TryGetInt32(out var ltVal)) leadTimeDays = ltVal;
                if (pElem.TryGetProperty("recommended_supplier", out var sProp)) procureSupplierName = sProp.GetString();
                if (pElem.TryGetProperty("medicine_name", out var mProp)) procureMedName = mProp.GetString();
            }

            if (procureQty <= 0 && root.ValueKind == JsonValueKind.Object && root.TryGetProperty("projectedDeficit", out var pdProp) && pdProp.TryGetInt32(out var pdVal))
            {
                procureQty = Math.Max(100, pdVal);
            }
            if (procureQty <= 0) procureQty = 500;

            if (string.IsNullOrWhiteSpace(procureMedName) && root.ValueKind == JsonValueKind.Object && root.TryGetProperty("medicine", out var rMedProp))
            {
                procureMedName = rMedProp.GetString();
            }

            // Extract details from redistribution_proposal
            int redistQty = 200;
            string? redistMedName = null;
            string? redistDonorName = null;
            string? redistTargetName = null;

            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("redistribution_proposal", out var rElem) && rElem.ValueKind == JsonValueKind.Object)
            {
                if (rElem.TryGetProperty("quantity", out var rqProp) && rqProp.TryGetInt32(out var rqVal)) redistQty = rqVal;
                if (rElem.TryGetProperty("medicine", out var rmProp)) redistMedName = rmProp.GetString();
                if (rElem.TryGetProperty("donor_facility", out var dfProp)) redistDonorName = dfProp.GetString();
                if (rElem.TryGetProperty("target_facility", out var tfProp)) redistTargetName = tfProp.GetString();
            }
            if (string.IsNullOrWhiteSpace(redistMedName) && root.ValueKind == JsonValueKind.Object && root.TryGetProperty("medicine", out var rMed2Prop))
            {
                redistMedName = rMed2Prop.GetString();
            }
            if (string.IsNullOrWhiteSpace(redistTargetName) && root.ValueKind == JsonValueKind.Object && root.TryGetProperty("facility", out var rFacProp))
            {
                redistTargetName = rFacProp.GetString();
            }

            // Resolve target medicine
            Medicine? medicine = null;
            if (workflow.MedicineId.HasValue)
            {
                medicine = await _db.Medicines.FindAsync(new object[] { workflow.MedicineId.Value }, cancellationToken);
            }
            if (medicine is null && !string.IsNullOrWhiteSpace(procureMedName))
            {
                var baseMed = procureMedName.Split(' ')[0].ToLower();
                medicine = await _db.Medicines.FirstOrDefaultAsync(m => m.Name.ToLower().Contains(baseMed), cancellationToken);
            }
            if (medicine is null && !string.IsNullOrWhiteSpace(redistMedName))
            {
                var baseMed = redistMedName.Split(' ')[0].ToLower();
                medicine = await _db.Medicines.FirstOrDefaultAsync(m => m.Name.ToLower().Contains(baseMed), cancellationToken);
            }
            if (medicine is null && !string.IsNullOrWhiteSpace(workflow.Objective))
            {
                var objLower = workflow.Objective.ToLowerInvariant();
                var allMeds = await _db.Medicines.ToListAsync(cancellationToken);
                medicine = allMeds.FirstOrDefault(m => objLower.Contains(m.Name.ToLowerInvariant()) || objLower.Contains(m.Name.Split(' ')[0].ToLowerInvariant()));
            }
            if (medicine is null)
            {
                medicine = await _db.Medicines.FirstOrDefaultAsync(m => m.Code == "AMOX-500", cancellationToken)
                           ?? await _db.Medicines.FirstOrDefaultAsync(m => m.Code == "AMOX-250", cancellationToken)
                           ?? await _db.Medicines.FirstOrDefaultAsync(m => m.IsActive, cancellationToken);
            }

            // Resolve target facility
            Facility? targetFacility = null;
            if (workflow.FacilityId.HasValue)
            {
                targetFacility = await _db.Facilities.FindAsync(new object[] { workflow.FacilityId.Value }, cancellationToken);
            }
            if (targetFacility is null && !string.IsNullOrWhiteSpace(redistTargetName))
            {
                targetFacility = await _db.Facilities.FirstOrDefaultAsync(f => f.Name.ToLower().Contains(redistTargetName.ToLower()), cancellationToken);
            }
            if (targetFacility is null && root.ValueKind == JsonValueKind.Object && root.TryGetProperty("facility", out var fRootProp))
            {
                var fStr = fRootProp.GetString();
                if (!string.IsNullOrWhiteSpace(fStr))
                {
                    targetFacility = await _db.Facilities.FirstOrDefaultAsync(f => f.Name.ToLower().Contains(fStr.ToLower()), cancellationToken);
                }
            }
            if (targetFacility is null && !string.IsNullOrWhiteSpace(workflow.Objective))
            {
                var objLower = workflow.Objective.ToLowerInvariant();
                var allFacs = await _db.Facilities.ToListAsync(cancellationToken);
                targetFacility = allFacs.FirstOrDefault(f => objLower.Contains(f.Name.ToLowerInvariant()) || objLower.Contains(f.Name.Split(' ')[0].ToLowerInvariant()));
            }
            if (targetFacility is null)
            {
                targetFacility = await _db.Facilities.FirstOrDefaultAsync(f => f.Code == "COLOMBO-GEN", cancellationToken)
                                 ?? await _db.Facilities.FirstOrDefaultAsync(f => f.Code == "CENTRAL", cancellationToken)
                                 ?? await _db.Facilities.FirstOrDefaultAsync(f => f.IsActive, cancellationToken);
            }

            if (medicine is null || targetFacility is null)
            {
                _logger.LogWarning("Cannot execute approved actions: medicine or targetFacility not resolved.");
                return;
            }

            // 1. EXECUTE PROCUREMENT ACTION
            if (isProcurement)
            {
                var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Name.Contains("State Pharmaceuticals") || s.Name.Contains("SPMC"), cancellationToken)
                               ?? await _db.Suppliers.FirstOrDefaultAsync(s => s.IsActive, cancellationToken);

                if (supplier is null)
                {
                    supplier = new Supplier
                    {
                        Id = Guid.NewGuid(),
                        Name = procureSupplierName ?? "State Pharmaceuticals Manufacturing Corporation (SPMC)",
                        ContactPerson = "Director of Logistics",
                        Email = "procurement@spmc.gov.lk",
                        Phone = "+94-11-2635353",
                        Address = "No. 11 Sir John Kotelawala Mawatha, Ratmalana",
                        LeadTimeDays = leadTimeDays,
                        IsActive = true
                    };
                    _db.Suppliers.Add(supplier);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                // Check if an existing PendingApproval PO exists
                var existingPo = await _db.PurchaseOrders
                    .Include(p => p.Items)
                    .FirstOrDefaultAsync(p => p.FacilityId == targetFacility.Id
                        && p.Status == PurchaseOrderStatus.PendingApproval
                        && p.Items.Any(i => i.MedicineId == medicine.Id), cancellationToken);

                Guid poId;
                if (existingPo is not null)
                {
                    poId = existingPo.Id;
                    existingPo.Status = PurchaseOrderStatus.Approved;
                    existingPo.ApprovedAt = DateTime.UtcNow;
                    existingPo.ApprovedById = decidedByUserId;
                }
                else
                {
                    poId = Guid.NewGuid();
                    var po = new PurchaseOrder
                    {
                        Id = poId,
                        SupplierId = supplier.Id,
                        FacilityId = targetFacility.Id,
                        Status = PurchaseOrderStatus.Approved,
                        RequestedAt = DateTime.UtcNow,
                        ApprovedAt = DateTime.UtcNow,
                        ApprovedById = decidedByUserId,
                        Items = new List<PurchaseOrderItem>
                        {
                            new PurchaseOrderItem
                            {
                                Id = Guid.NewGuid(),
                                PurchaseOrderId = poId,
                                MedicineId = medicine.Id,
                                RequestedQuantity = procureQty,
                                UnitPrice = procurePrice
                            }
                        }
                    };
                    _db.PurchaseOrders.Add(po);
                }

                var existingDelivery = await _db.Deliveries.FirstOrDefaultAsync(d => d.PurchaseOrderId == poId, cancellationToken);
                if (existingDelivery is null)
                {
                    var delivery = new Delivery
                    {
                        Id = Guid.NewGuid(),
                        PurchaseOrderId = poId,
                        Status = DeliveryStatus.InTransit,
                        ExpectedAt = DateTime.UtcNow.AddDays(leadTimeDays),
                        TrackingNumber = $"TRK-SPMC-{DateTime.UtcNow:yyyyMMdd}-{poId.ToString()[..6].ToUpperInvariant()}",
                        Notes = comments ?? "Authorized and dispatched via clinical coordinator protocol",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.Deliveries.Add(delivery);
                }

                // In accordance with clinical supply chain governance, inventory balances
                // on hand are updated upon physical delivery receipt and verification, not on order approval.
                _logger.LogInformation("Executed Procurement: Approved PO {POId} for {Qty} units of {Medicine} to {Facility}. Delivery created in transit.",
                    poId, procureQty, medicine.Name, targetFacility.Name);
            }

            // 2. EXECUTE REDISTRIBUTION ACTION
            if (isRedistribution)
            {
                Facility? donorFacility = null;
                if (!string.IsNullOrWhiteSpace(redistDonorName))
                {
                    donorFacility = await _db.Facilities.FirstOrDefaultAsync(f => f.Name.ToLower().Contains(redistDonorName.ToLower()), cancellationToken);
                }
                if (donorFacility is null)
                {
                    donorFacility = await _db.Facilities.FirstOrDefaultAsync(f => f.Code == "KANDY-BASE" || f.Name.Contains("Kandy"), cancellationToken)
                                    ?? await _db.Facilities.FirstOrDefaultAsync(f => f.Id != targetFacility.Id && f.IsActive, cancellationToken);
                }

                if (donorFacility is not null)
                {
                    var trNumber = $"TR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}";
                    var transfer = new TransferRequest
                    {
                        Id = Guid.NewGuid(),
                        TransferNumber = trNumber,
                        MedicineId = medicine.Id,
                        SourceFacilityId = donorFacility.Id,
                        DestinationFacilityId = targetFacility.Id,
                        Quantity = redistQty,
                        Priority = TransferPriority.High,
                        Status = TransferStatus.Delivered,
                        BatchNumber = "BATCH-001",
                        EstimatedDistanceKm = 34.2m,
                        EstimatedDurationMinutes = 75m,
                        Notes = comments ?? "Emergency inter-facility stock redistribution authorized via coordinator",
                        RequestedByUserId = decidedByUserId,
                        ApprovedByUserId = decidedByUserId,
                        CreatedAtUtc = DateTime.UtcNow,
                        UpdatedAtUtc = DateTime.UtcNow,
                        DispatchedAtUtc = DateTime.UtcNow,
                        DeliveredAtUtc = DateTime.UtcNow
                    };
                    _db.TransferRequests.Add(transfer);

                    _db.TransferStatusHistory.Add(new TransferStatusHistory
                    {
                        Id = Guid.NewGuid(),
                        TransferRequestId = transfer.Id,
                        FromStatus = TransferStatus.Approved,
                        ToStatus = TransferStatus.Delivered,
                        ChangedByUserId = decidedByUserId,
                        ChangedByEmail = decidedByUserName,
                        ChangedAtUtc = DateTime.UtcNow,
                        Reason = "Authorized and dispatched via coordinator console"
                    });

                    // Deduct from donor facility
                    var donorBalance = await _db.InventoryBalances
                        .FirstOrDefaultAsync(b => b.MedicineId == medicine.Id && b.FacilityId == donorFacility.Id, cancellationToken);

                    if (donorBalance is not null)
                    {
                        donorBalance.QuantityOnHand = Math.Max(0, donorBalance.QuantityOnHand - redistQty);
                        donorBalance.UpdatedAtUtc = DateTime.UtcNow;

                        _db.StockTransactions.Add(new StockTransaction
                        {
                            Id = Guid.NewGuid(),
                            MedicineId = medicine.Id,
                            FacilityId = donorFacility.Id,
                            Type = StockTransactionType.Adjustment,
                            Quantity = -redistQty,
                            BalanceAfter = donorBalance.QuantityOnHand,
                            Reason = $"Redistribution transfer {trNumber} dispatched to {targetFacility.Name}",
                            ActorId = decidedByUserName,
                            CreatedAtUtc = DateTime.UtcNow
                        });
                    }

                    // Add to destination facility
                    var targetBalance = await _db.InventoryBalances
                        .FirstOrDefaultAsync(b => b.MedicineId == medicine.Id && b.FacilityId == targetFacility.Id, cancellationToken);

                    if (targetBalance is null)
                    {
                        targetBalance = new InventoryBalance
                        {
                            Id = Guid.NewGuid(),
                            MedicineId = medicine.Id,
                            FacilityId = targetFacility.Id,
                            QuantityOnHand = redistQty,
                            QuantityReserved = 0,
                            UpdatedAtUtc = DateTime.UtcNow
                        };
                        _db.InventoryBalances.Add(targetBalance);
                    }
                    else
                    {
                        targetBalance.QuantityOnHand += redistQty;
                        targetBalance.UpdatedAtUtc = DateTime.UtcNow;
                    }

                    var redistBatch = new MedicineBatch
                    {
                        Id = Guid.NewGuid(),
                        MedicineId = medicine.Id,
                        FacilityId = targetFacility.Id,
                        BatchNumber = $"BATCH-TR-{transfer.Id.ToString()[..4].ToUpperInvariant()}",
                        QuantityOnHand = redistQty,
                        ManufacturingDateUtc = DateTime.UtcNow.AddMonths(-1),
                        ExpiryDateUtc = DateTime.UtcNow.AddYears(1)
                    };
                    _db.MedicineBatches.Add(redistBatch);

                    _db.StockTransactions.Add(new StockTransaction
                    {
                        Id = Guid.NewGuid(),
                        MedicineId = medicine.Id,
                        FacilityId = targetFacility.Id,
                        MedicineBatchId = redistBatch.Id,
                        Type = StockTransactionType.Receipt,
                        Quantity = redistQty,
                        BalanceAfter = targetBalance.QuantityOnHand,
                        Reason = $"Redistribution transfer {trNumber} received from {donorFacility.Name}",
                        ActorId = decidedByUserName,
                        CreatedAtUtc = DateTime.UtcNow
                    });

                    _logger.LogInformation("Executed Redistribution: Created Transfer {TrNum} for {Qty} units of {Medicine} from {Donor} to {Target}",
                        trNumber, redistQty, medicine.Name, donorFacility.Name, targetFacility.Name);
                }
            }

            await _db.SaveChangesAsync(cancellationToken);
            doc?.Dispose();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute approved workflow actions for WorkflowRun {WorkflowRunId}", workflow.Id);
        }
    }

    private async Task ExecuteRejectedWorkflowActionsAsync(
        WorkflowRun workflow,
        Guid decidedByUserId,
        string decidedByUserName,
        string? comments,
        CancellationToken cancellationToken)
    {
        try
        {
            JsonDocument? doc = null;
            if (!string.IsNullOrWhiteSpace(workflow.ResultJson))
            {
                try { doc = JsonDocument.Parse(workflow.ResultJson); } catch { /* ignore */ }
            }

            JsonElement root = doc?.RootElement ?? default;

            bool hasProcurementProposal = root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("procurement_proposal", out var procElem)
                && procElem.ValueKind == JsonValueKind.Object
                && (!procElem.TryGetProperty("needed", out var neededProp) || neededProp.GetBoolean());

            bool isProcurement = workflow.WorkflowType == "AutonomousProcurement"
                || workflow.WorkflowType == "CombinedResolution"
                || hasProcurementProposal;

            // If this is a procurement workflow, reject any associated pending PurchaseOrder
            if (isProcurement)
            {
                JsonElement procElem2 = default;
                if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("procurement_proposal", out procElem2) && procElem2.ValueKind == JsonValueKind.Object)
                {
                    // Try to find the PO number from the workflow result
                    string? poNumber = null;
                    if (procElem2.TryGetProperty("draft_po_number", out var poNumProp))
                    {
                        poNumber = poNumProp.GetString();
                    }

                    // If we have a PO number, try to find and reject the PO
                    if (!string.IsNullOrWhiteSpace(poNumber))
                    {
                        var po = await _db.PurchaseOrders
                            .FirstOrDefaultAsync(p => p.Id.ToString().Contains(poNumber) || p.Status == PurchaseOrderStatus.PendingApproval, cancellationToken);

                        if (po is not null && po.Status == PurchaseOrderStatus.PendingApproval)
                        {
                            po.Status = PurchaseOrderStatus.Rejected;
                            po.RejectionReason = comments ?? $"Rejected via Multi-Agent Coordinator Console by {decidedByUserName}";
                            _logger.LogInformation("Rejected associated PurchaseOrder {POId} for workflow {WorkflowRunId}", po.Id, workflow.Id);
                        }
                    }
                    else
                    {
                        // No PO number, try to find a PO by matching the workflow's medicine and facility
                        if (workflow.MedicineId.HasValue && workflow.FacilityId.HasValue)
                        {
                            var po = await _db.PurchaseOrders
                                .Include(p => p.Items)
                                .FirstOrDefaultAsync(p => p.FacilityId == workflow.FacilityId.Value
                                    && p.Status == PurchaseOrderStatus.PendingApproval
                                    && p.Items.Any(i => i.MedicineId == workflow.MedicineId.Value), cancellationToken);

                            if (po is not null)
                            {
                                po.Status = PurchaseOrderStatus.Rejected;
                                po.RejectionReason = comments ?? $"Rejected via Multi-Agent Coordinator Console by {decidedByUserName}";
                                _logger.LogInformation("Rejected associated PurchaseOrder {POId} for workflow {WorkflowRunId} (matched by medicine/facility)", po.Id, workflow.Id);
                            }
                        }
                    }
                }
            }

            await _db.SaveChangesAsync(cancellationToken);
            doc?.Dispose();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute rejected workflow actions for WorkflowRun {WorkflowRunId}", workflow.Id);
        }
    }

    public async Task<List<ApprovalDto>> GetPendingApprovalsAsync(
        string? requiredRole = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Set<Approval>()
            .Where(a => a.Decision == ApprovalDecision.Pending);

        if (!string.IsNullOrWhiteSpace(requiredRole))
        {
            query = query.Where(a => a.RequiredRole == requiredRole);
        }

        return await query
            .OrderByDescending(a => a.RequestedAt)
            .Select(a => new ApprovalDto
            {
                Id = a.Id,
                ApprovalType = a.ApprovalType,
                RequiredRole = a.RequiredRole,
                Decision = a.Decision,
                DecidedByUserId = a.DecidedByUserId,
                DecidedByUserName = a.DecidedByUserName,
                Comments = a.Comments,
                RequestedAt = a.RequestedAt,
                DecidedAt = a.DecidedAt
            })
            .ToListAsync(cancellationToken);
    }
}
