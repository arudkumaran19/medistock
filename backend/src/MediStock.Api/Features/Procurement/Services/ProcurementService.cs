using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Procurement;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
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
        {
            throw new ProcurementException(
                "SUPPLIER_REQUIRED",
                "Supplier is required.");
        }

        if (request.FacilityId == Guid.Empty)
        {
            throw new ProcurementException(
                "FACILITY_REQUIRED",
                "Facility is required.");
        }

        if (request.Items is null || request.Items.Count == 0)
        {
            throw new ProcurementException(
                "ITEMS_REQUIRED",
                "At least one purchase order item is required.");
        }

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
        {
            throw new ProcurementException(
                "SUPPLIER_NOT_FOUND",
                "Active supplier was not found.");
        }

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
        {
            throw new ProcurementException(
                "FACILITY_NOT_FOUND",
                "Active facility was not found.");
        }

        // --------------------------------------------------------
        // Validate medicines
        // --------------------------------------------------------

        foreach (var item in request.Items)
        {
            if (item.MedicineId == Guid.Empty)
            {
                throw new ProcurementException(
                    "MEDICINE_REQUIRED",
                    "Medicine is required for every purchase order item.");
            }

            if (item.RequestedQuantity <= 0)
            {
                throw new ProcurementException(
                    "INVALID_QUANTITY",
                    "Requested quantity must be greater than zero.");
            }

            if (item.UnitPrice < 0)
            {
                throw new ProcurementException(
                    "INVALID_UNIT_PRICE",
                    "Unit price cannot be negative.");
            }
        }

        var medicineIds = request.Items
            .Select(x => x.MedicineId)
            .ToList();

        var distinctMedicineIds = medicineIds
            .Distinct()
            .ToList();

        if (distinctMedicineIds.Count != medicineIds.Count)
        {
            throw new ProcurementException(
                "DUPLICATE_MEDICINE",
                "A medicine can appear only once in a purchase order.");
        }

        var medicines = await db.Medicines
            .AsNoTracking()
            .Where(x =>
                distinctMedicineIds.Contains(x.Id) &&
                x.IsActive)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (medicines.Count != distinctMedicineIds.Count)
        {
            throw new ProcurementException(
                "MEDICINE_NOT_FOUND",
                "One or more medicines were not found or are inactive.");
        }

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
        {
            query = query.Where(x => x.FacilityId == facilityId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        if (supplierId.HasValue && supplierId.Value != Guid.Empty)
        {
            query = query.Where(x => x.SupplierId == supplierId.Value);
        }

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
        {
            return null;
        }

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
        {
            throw new ProcurementException(
                "ITEMS_REQUIRED",
                "A purchase order must contain at least one item.");
        }

        purchaseOrder.Status = PurchaseOrderStatus.PendingApproval;

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(
            id,
            cancellationToken);
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

        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.PendingApproval,
            PurchaseOrderStatus.RevisionRequired);

        purchaseOrder.Status = PurchaseOrderStatus.Approved;
        purchaseOrder.ApprovedAt = DateTime.UtcNow;
        purchaseOrder.ApprovedById = currentUserService?.UserId;
        purchaseOrder.RejectionReason = null;
        purchaseOrder.RevisionReason = null;

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(
            id,
            cancellationToken);
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

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(
            id,
            cancellationToken);
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

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(
            id,
            cancellationToken);
    }

    // ============================================================
    // GET TRACKED PURCHASE ORDER
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
        return await GetByIdAsync(
                   id,
                   cancellationToken)
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
        {
            return;
        }

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
        {
            throw new ProcurementException(
                "REASON_REQUIRED",
                "A reason is required for this workflow action.");
        }
    }
}