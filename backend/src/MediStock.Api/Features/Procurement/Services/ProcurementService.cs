using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Procurement;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;



namespace MediStock.Api.Features.Procurement.Services;

public sealed class ProcurementService(ApplicationDbContext db)
{
    public async Task<PurchaseOrderResponse> CreateAsync(
        PurchaseOrderRequest request,
        CancellationToken cancellationToken)
    {
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

        var supplierExists = await db.Suppliers
            .AnyAsync(
                x => x.Id == request.SupplierId && x.IsActive,
                cancellationToken);

        if (!supplierExists)
            throw new ProcurementException(
                "SUPPLIER_NOT_FOUND",
                "Active supplier was not found.");

        var facilityExists = await db.Facilities
            .AnyAsync(
                x => x.Id == request.FacilityId && x.IsActive,
                cancellationToken);

        if (!facilityExists)
            throw new ProcurementException(
                "FACILITY_NOT_FOUND",
                "Active facility was not found.");

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
            db.PurchaseOrderItems.Add(new PurchaseOrderItem
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

        return await GetByIdAsync(
            purchaseOrder.Id,
            cancellationToken)
            ?? throw new ProcurementException(
                "PURCHASE_ORDER_CREATE_FAILED",
                "Purchase order could not be retrieved after creation.");
    }

    public async Task<IReadOnlyList<PurchaseOrderResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        return await db.PurchaseOrders
            .AsNoTracking()
            .Include(x => x.Items)
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
                    .ToList()))
            .ToListAsync(cancellationToken);
    }

    public async Task<PurchaseOrderResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
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
                    .ToList()))
            .SingleOrDefaultAsync(cancellationToken);
    }

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

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    public async Task<PurchaseOrderResponse> ApproveAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await GetTrackedPurchaseOrderAsync(
            id,
            cancellationToken);

        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.PendingApproval);

        purchaseOrder.Status = PurchaseOrderStatus.Approved;
        purchaseOrder.ApprovedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    public async Task<PurchaseOrderResponse> RejectAsync(
        Guid id,
        PurchaseOrderWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        ValidateReason(request.Reason);

        var purchaseOrder = await GetTrackedPurchaseOrderAsync(
            id,
            cancellationToken);

        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.PendingApproval);

        purchaseOrder.Status = PurchaseOrderStatus.Rejected;

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    public async Task<PurchaseOrderResponse> RequestRevisionAsync(
        Guid id,
        PurchaseOrderWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        ValidateReason(request.Reason);

        var purchaseOrder = await GetTrackedPurchaseOrderAsync(
            id,
            cancellationToken);

        EnsureStatus(
            purchaseOrder,
            PurchaseOrderStatus.PendingApproval);

        purchaseOrder.Status = PurchaseOrderStatus.RevisionRequired;

        await db.SaveChangesAsync(cancellationToken);

        return await GetRequiredAsync(id, cancellationToken);
    }

    private async Task<PurchaseOrder> GetTrackedPurchaseOrderAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        return await db.PurchaseOrders
            .Include(x => x.Items)
            .SingleOrDefaultAsync(
                x => x.Id == id,
                cancellationToken)
            ?? throw new ProcurementException(
                "PURCHASE_ORDER_NOT_FOUND",
                "Purchase order was not found.");
    }

    private async Task<PurchaseOrderResponse> GetRequiredAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        return await GetByIdAsync(id, cancellationToken)
            ?? throw new ProcurementException(
                "PURCHASE_ORDER_NOT_FOUND",
                "Purchase order was not found.");
    }

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

    private static void ValidateReason(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ProcurementException(
                "REASON_REQUIRED",
                "A reason is required for this workflow action.");
    }


}