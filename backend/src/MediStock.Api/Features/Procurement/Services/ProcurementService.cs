using System.Text.Json;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Procurement;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Workflow.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Procurement.Services;

public sealed class ProcurementService(
    ApplicationDbContext db,
    MediStock.Api.Security.CurrentUserService? currentUserService = null)
{
    // ============================================================
    // CREATE PURCHASE ORDER
    // ============================================================

    public async Task<PurchaseOrderResponse> CreateAsync(
        PurchaseOrderRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.SupplierId == Guid.Empty)
            throw new ProcurementException(
                "SUPPLIER_REQUIRED",
                "Supplier is required.");

        if (request.FacilityId == Guid.Empty)
            throw new ProcurementException(
                "FACILITY_REQUIRED",
                "Facility is required.");

        if (request.Items is null || request.Items.Count == 0)
            throw new ProcurementException(
                "ITEMS_REQUIRED",
                "At least one purchase order item is required.");

        // --------------------------------------------------------
        // Validate supplier
        // --------------------------------------------------------

        var supplierExists = await db.Suppliers
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == request.SupplierId &&
                     x.IsActive,
                cancellationToken);

        if (!supplierExists)
            throw new ProcurementException(
                "SUPPLIER_NOT_FOUND",
                "Active supplier was not found.");

        // --------------------------------------------------------
        // Validate facility
        // --------------------------------------------------------

        var facilityExists = await db.Facilities
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == request.FacilityId &&
                     x.IsActive,
                cancellationToken);

        if (!facilityExists)
            throw new ProcurementException(
                "FACILITY_NOT_FOUND",
                "Active facility was not found.");

        // --------------------------------------------------------
        // Validate medicines
        // --------------------------------------------------------

        foreach (var item in request.Items)
        {
            if (item.MedicineId == Guid.Empty)
                throw new ProcurementException(
                    "MEDICINE_REQUIRED",
                    "Medicine is required for every purchase order item.");

            if (item.RequestedQuantity <= 0)
                throw new ProcurementException(
                    "INVALID_QUANTITY",
                    "Requested quantity must be greater than zero.");

            if (item.UnitPrice < 0)
                throw new ProcurementException(
                    "INVALID_UNIT_PRICE",
                    "Unit price cannot be negative.");
        }

        var medicineIds = request.Items
            .Select(x => x.MedicineId)
            .Distinct()
            .ToList();

        if (medicineIds.Count != request.Items.Count)
            throw new ProcurementException(
                "DUPLICATE_MEDICINE",
                "A medicine can appear only once in a purchase order.");

        var medicines = await db.Medicines
            .Where(x => medicineIds.Contains(x.Id) && x.IsActive)
            .ToDictionaryAsync(
                x => x.Id,
                cancellationToken);

        if (medicines.Count != medicineIds.Count)
            throw new ProcurementException(
                "MEDICINE_NOT_FOUND",
                "One or more medicines were not found or are inactive.");

        // --------------------------------------------------------
        // Create purchase order
        // --------------------------------------------------------

        var purchaseOrder = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            SupplierId = request.SupplierId,
            FacilityId = request.FacilityId,
            Status = PurchaseOrderStatus.Draft,
            RequestedAt = DateTime.UtcNow
        };

        foreach (var item in request.Items)
        {
            purchaseOrder.Items.Add(
                new PurchaseOrderItem
                {
                    Id = Guid.NewGuid(),
                    PurchaseOrderId = purchaseOrder.Id,
                    MedicineId = item.MedicineId,
                    RequestedQuantity = item.RequestedQuantity,
                    UnitPrice = item.UnitPrice
                });
        }

        db.PurchaseOrders.Add(purchaseOrder);

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(
            purchaseOrder.Id,
            cancellationToken);
    }

    // ============================================================
    // GET ALL PURCHASE ORDERS
    // ============================================================

    public async Task<IReadOnlyList<PurchaseOrderResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        return await GetAllAsync(null, null, null, cancellationToken);
    }

    public async Task<IReadOnlyList<PurchaseOrderResponse>> GetAllAsync(
        Guid? facilityId = null,
        PurchaseOrderStatus? status = null,
        Guid? supplierId = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.PurchaseOrders
            .AsNoTracking()
            .Include(x => x.Items)
            .AsQueryable();

        if (facilityId.HasValue && facilityId.Value != Guid.Empty)
            query = query.Where(x => x.FacilityId == facilityId.Value);

        if (status.HasValue)
            query = query.Where(x => x.Status == status.Value);

        if (supplierId.HasValue && supplierId.Value != Guid.Empty)
            query = query.Where(x => x.SupplierId == supplierId.Value);

        return await query
            .OrderByDescending(x => x.RequestedAt)
            .Select(x => new PurchaseOrderResponse(
                x.Id,
                x.SupplierId,
                x.FacilityId,
                x.Status.ToString(),
                x.RequestedAt,
                x.ApprovedAt,
                x.ReceivedAt,
                x.Items
                    .OrderBy(i => i.Id)
                    .Select(i => new PurchaseOrderItemResponse(
                        i.Id,
                        i.MedicineId,
                        i.RequestedQuantity,
                        i.UnitPrice))
                    .ToList(),
                x.ApprovedById,
                x.RejectionReason,
                x.RevisionReason))
            .ToListAsync(cancellationToken);
    }

    // ============================================================
    // GET PURCHASE ORDER BY ID
    // ============================================================

    public async Task<PurchaseOrderResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
            return null;

        return await db.PurchaseOrders
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x => x.Id == id)
            .Select(x => new PurchaseOrderResponse(
                x.Id,
                x.SupplierId,
                x.FacilityId,
                x.Status.ToString(),
                x.RequestedAt,
                x.ApprovedAt,
                x.ReceivedAt,
                x.Items
                    .OrderBy(i => i.Id)
                    .Select(i => new PurchaseOrderItemResponse(
                        i.Id,
                        i.MedicineId,
                        i.RequestedQuantity,
                        i.UnitPrice))
                    .ToList(),
                x.ApprovedById,
                x.RejectionReason,
                x.RevisionReason))
            .SingleOrDefaultAsync(cancellationToken);
    }

    // ============================================================
    // SUBMIT FOR APPROVAL
    // ============================================================

    public async Task<PurchaseOrderResponse> SubmitAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await GetTrackedPurchaseOrderAsync(
            id,
            cancellationToken);

        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.Draft,
            PurchaseOrderStatus.RevisionRequired);

        if (purchaseOrder.Items.Count == 0)
            throw new ProcurementException(
                "ITEMS_REQUIRED",
                "A purchase order must contain at least one item.");

        purchaseOrder.Status = PurchaseOrderStatus.PendingApproval;

        // Synchronize or create corresponding WorkflowRun and Approval
        var poIdStr = purchaseOrder.Id.ToString();
        var existingWorkflow = await db.WorkflowRuns
            .Include(w => w.Approvals)
            .FirstOrDefaultAsync(w => w.ContextJson != null && w.ContextJson.Contains(poIdStr), cancellationToken);

        if (existingWorkflow is null)
        {
            var firstItem = purchaseOrder.Items.FirstOrDefault();
            var medicine = firstItem != null
                ? await db.Medicines.FindAsync(new object[] { firstItem.MedicineId }, cancellationToken)
                : null;
            var facility = await db.Facilities.FindAsync(new object[] { purchaseOrder.FacilityId }, cancellationToken);

            var totalQty = purchaseOrder.Items.Sum(i => i.RequestedQuantity);
            var totalCost = purchaseOrder.Items.Sum(i => i.RequestedQuantity * i.UnitPrice);
            var shortPoId = purchaseOrder.Id.ToString()[..8].ToUpperInvariant();

            var workflow = new WorkflowRun
            {
                Id = Guid.NewGuid(),
                WorkflowType = "AutonomousProcurement",
                Objective = $"Procurement authorization for {totalQty} units of {medicine?.Name ?? "Medicine"} at {facility?.Name ?? "Facility"} (PO-{shortPoId})",
                Status = WorkflowStatus.WaitingForApproval,
                FacilityId = purchaseOrder.FacilityId,
                MedicineId = firstItem?.MedicineId,
                InitiatedByUserId = currentUserService?.UserId,
                RequiresApproval = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
                ContextJson = JsonSerializer.Serialize(new
                {
                    purchaseOrderId = purchaseOrder.Id,
                    supplierId = purchaseOrder.SupplierId,
                    facilityId = purchaseOrder.FacilityId,
                    facilityName = facility?.Name,
                    medicineName = medicine?.Name,
                    totalQuantity = totalQty,
                    totalEstimatedCost = totalCost,
                    items = purchaseOrder.Items.Select(i => new { i.MedicineId, i.RequestedQuantity, i.UnitPrice })
                }),
                ResultJson = JsonSerializer.Serialize(new
                {
                    procurement_proposal = new
                    {
                        needed = true,
                        draft_po_number = $"PO-{shortPoId}",
                        purchase_order_id = purchaseOrder.Id,
                        medicine_name = medicine?.Name,
                        quantity = totalQty,
                        unit_price = firstItem?.UnitPrice ?? 0m,
                        total_estimated_cost = totalCost,
                        facility_id = purchaseOrder.FacilityId,
                        supplier_id = purchaseOrder.SupplierId
                    }
                }),
                Steps = new List<WorkflowPlanStep>
                {
                    new WorkflowPlanStep
                    {
                        Id = Guid.NewGuid(),
                        StepOrder = 1,
                        StepKey = "Requisition Drafted",
                        Action = "Draft Requisition",
                        Status = "Completed",
                        AgentName = "ProcurementSpecialist",
                        StartedAt = DateTimeOffset.UtcNow,
                        CompletedAt = DateTimeOffset.UtcNow
                    },
                    new WorkflowPlanStep
                    {
                        Id = Guid.NewGuid(),
                        StepOrder = 2,
                        StepKey = "Managerial Approval Gating",
                        Action = "Review and Authorize",
                        Status = "WaitingForApproval",
                        AgentName = "PolicySafetyGate",
                        StartedAt = DateTimeOffset.UtcNow
                    },
                    new WorkflowPlanStep
                    {
                        Id = Guid.NewGuid(),
                        StepOrder = 3,
                        StepKey = "Vendor Dispatch & Delivery",
                        Action = "Dispatch Inventory",
                        Status = "Pending",
                        AgentName = "ProcurementSpecialist"
                    }
                }
            };

            var approval = new Approval
            {
                Id = Guid.NewGuid(),
                WorkflowRunId = workflow.Id,
                ApprovalType = "PurchaseOrderApproval",
                RequiredRole = MediStock.Api.Common.Constants.Roles.FacilityManager,
                Decision = ApprovalDecision.Pending,
                RequestedAt = DateTimeOffset.UtcNow
            };

            workflow.Approvals.Add(approval);
            db.WorkflowRuns.Add(workflow);
        }
        else
        {
            existingWorkflow.Status = WorkflowStatus.WaitingForApproval;
            existingWorkflow.UpdatedAt = DateTimeOffset.UtcNow;
            foreach (var app in existingWorkflow.Approvals.Where(a => a.Decision != ApprovalDecision.Approved))
            {
                app.Decision = ApprovalDecision.Pending;
                app.RequestedAt = DateTimeOffset.UtcNow;
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    // ============================================================
    // APPROVE PURCHASE ORDER
    // ============================================================

    public async Task<PurchaseOrderResponse> ApproveAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await GetTrackedPurchaseOrderAsync(
            id,
            cancellationToken);

        // RevisionRequired also allowed: re-approval after revision
        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.PendingApproval,
            PurchaseOrderStatus.RevisionRequired);

        purchaseOrder.Status = PurchaseOrderStatus.Approved;
        purchaseOrder.ApprovedAt = DateTime.UtcNow;
        purchaseOrder.ApprovedById = currentUserService?.UserId;
        purchaseOrder.RejectionReason = null;
        purchaseOrder.RevisionReason = null;

        // Synchronize linked WorkflowRun and Approval
        var poIdStr = purchaseOrder.Id.ToString();
        var linkedWorkflow = await db.WorkflowRuns
            .Include(w => w.Approvals)
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.ContextJson != null && w.ContextJson.Contains(poIdStr), cancellationToken);

        if (linkedWorkflow is not null)
        {
            linkedWorkflow.Status = WorkflowStatus.Completed;
            linkedWorkflow.CompletedAt = DateTimeOffset.UtcNow;
            linkedWorkflow.UpdatedAt = DateTimeOffset.UtcNow;

            foreach (var step in linkedWorkflow.Steps)
            {
                step.Status = "Completed";
            }

            foreach (var app in linkedWorkflow.Approvals.Where(a => a.Decision == ApprovalDecision.Pending))
            {
                app.Decision = ApprovalDecision.Approved;
                app.DecidedAt = DateTimeOffset.UtcNow;
                app.DecidedByUserId = currentUserService?.UserId;
                app.DecidedByUserName = currentUserService?.Email ?? "Manager";
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    // ============================================================
    // REJECT PURCHASE ORDER
    // ============================================================

    public async Task<PurchaseOrderResponse> RejectAsync(
        Guid id,
        PurchaseOrderWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        ValidateReason(request.Reason);

        var purchaseOrder = await GetTrackedPurchaseOrderAsync(
            id,
            cancellationToken);

        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.PendingApproval,
            PurchaseOrderStatus.RevisionRequired);

        purchaseOrder.Status = PurchaseOrderStatus.Rejected;
        purchaseOrder.RejectionReason = request.Reason!.Trim();
        purchaseOrder.ApprovedById = currentUserService?.UserId;

        // Synchronize linked WorkflowRun and Approval
        var poIdStr = purchaseOrder.Id.ToString();
        var linkedWorkflow = await db.WorkflowRuns
            .Include(w => w.Approvals)
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.ContextJson != null && w.ContextJson.Contains(poIdStr), cancellationToken);

        if (linkedWorkflow is not null)
        {
            linkedWorkflow.Status = WorkflowStatus.Rejected;
            linkedWorkflow.ErrorMessage = request.Reason.Trim();
            linkedWorkflow.CompletedAt = DateTimeOffset.UtcNow;
            linkedWorkflow.UpdatedAt = DateTimeOffset.UtcNow;

            foreach (var app in linkedWorkflow.Approvals.Where(a => a.Decision == ApprovalDecision.Pending))
            {
                app.Decision = ApprovalDecision.Rejected;
                app.Comments = request.Reason.Trim();
                app.DecidedAt = DateTimeOffset.UtcNow;
                app.DecidedByUserId = currentUserService?.UserId;
                app.DecidedByUserName = currentUserService?.Email ?? "Manager";
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    // ============================================================
    // REQUEST REVISION
    // ============================================================

    public async Task<PurchaseOrderResponse> RequestRevisionAsync(
        Guid id,
        PurchaseOrderWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        ValidateReason(request.Reason);

        var purchaseOrder = await GetTrackedPurchaseOrderAsync(
            id,
            cancellationToken);

        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.PendingApproval);

        purchaseOrder.Status = PurchaseOrderStatus.RevisionRequired;
        purchaseOrder.RevisionReason = request.Reason!.Trim();
        purchaseOrder.ApprovedById = currentUserService?.UserId;

        var poIdStr = purchaseOrder.Id.ToString();
        var linkedWorkflow = await db.WorkflowRuns
            .Include(w => w.Approvals)
            .FirstOrDefaultAsync(w => w.ContextJson != null && w.ContextJson.Contains(poIdStr), cancellationToken);

        if (linkedWorkflow is not null)
        {
            linkedWorkflow.Status = WorkflowStatus.WaitingForApproval;
            linkedWorkflow.ErrorMessage = $"Revision requested: {request.Reason.Trim()}";
            linkedWorkflow.UpdatedAt = DateTimeOffset.UtcNow;

            foreach (var app in linkedWorkflow.Approvals.Where(a => a.Decision == ApprovalDecision.Pending))
            {
                app.Comments = $"Revision requested: {request.Reason.Trim()}";
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    // ============================================================
    // GET TRACKED PURCHASE ORDER (internal)
    // ============================================================

    private async Task<PurchaseOrder> GetTrackedPurchaseOrderAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
        {
            throw new ProcurementException(
                "PURCHASE_ORDER_REQUIRED",
                "Purchase order ID is required.");
        }

        return await db.PurchaseOrders
            .Include(x => x.Items)
            .SingleOrDefaultAsync(
                x => x.Id == id,
                cancellationToken)
            ?? throw new ProcurementException(
                "PURCHASE_ORDER_NOT_FOUND",
                "Purchase order was not found.");
    }

    // ============================================================
    // GET REQUIRED PURCHASE ORDER
    // ============================================================

    private async Task<PurchaseOrderResponse> GetRequiredAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        return await GetByIdAsync(id, cancellationToken)
               ?? throw new ProcurementException(
                   "PURCHASE_ORDER_NOT_FOUND",
                   "Purchase order was not found.");
    }

    // ============================================================
    // STATE VALIDATION
    // ============================================================

    private static void EnsureStatus(
        PurchaseOrder purchaseOrder,
        params PurchaseOrderStatus[] allowedStatuses)
    {
        if (allowedStatuses.Contains(purchaseOrder.Status))
            return;

        throw new ProcurementException(
            "INVALID_PURCHASE_ORDER_STATE",
            $"Purchase order cannot be modified while in '{purchaseOrder.Status}' status.");
    }

    // ============================================================
    // WORKFLOW REASON VALIDATION
    // ============================================================

    private static void ValidateReason(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ProcurementException(
                "REASON_REQUIRED",
                "A reason is required for this workflow action.");
    }
}