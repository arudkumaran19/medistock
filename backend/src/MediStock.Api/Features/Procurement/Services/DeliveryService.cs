using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Procurement.Services;

public sealed class DeliveryService(
    ApplicationDbContext db,
    InventoryService inventoryService)
{
    public async Task<DeliveryResponse> CreateAsync(
        Guid purchaseOrderId,
        DeliveryRequest request,
        CancellationToken cancellationToken)
    {
        if (purchaseOrderId == Guid.Empty)
            throw new ProcurementException(
                "PURCHASE_ORDER_REQUIRED",
                "Purchase order is required.");

        var purchaseOrder = await db.PurchaseOrders
            .FirstOrDefaultAsync(
                x => x.Id == purchaseOrderId,
                cancellationToken);

        if (purchaseOrder is null)
            throw new ProcurementException(
                "PURCHASE_ORDER_NOT_FOUND",
                "Purchase order was not found.");

        if (purchaseOrder.Status != PurchaseOrderStatus.Approved)
            throw new ProcurementException(
                "PURCHASE_ORDER_NOT_APPROVED",
                "A delivery can only be created for an approved purchase order.");

        var existingDelivery = await db.Deliveries
            .AnyAsync(
                x => x.PurchaseOrderId == purchaseOrderId &&
                     x.Status != DeliveryStatus.Cancelled,
                cancellationToken);

        if (existingDelivery)
            throw new ProcurementException(
                "DELIVERY_ALREADY_EXISTS",
                "An active delivery already exists for this purchase order.");

        var now = DateTime.UtcNow;

        var delivery = new Delivery
        {
            Id = Guid.NewGuid(),
            PurchaseOrderId = purchaseOrderId,
            Status = DeliveryStatus.Pending,
            ExpectedAt = request.ExpectedAt,
            TrackingNumber = Normalize(request.TrackingNumber),
            Notes = Normalize(request.Notes),
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Deliveries.Add(delivery);

        await db.SaveChangesAsync(cancellationToken);

        return Map(delivery);
    }

    public async Task<DeliveryResponse?> GetByPurchaseOrderAsync(
        Guid purchaseOrderId,
        CancellationToken cancellationToken)
    {
        return await db.Deliveries
            .AsNoTracking()
            .Where(x => x.PurchaseOrderId == purchaseOrderId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new DeliveryResponse(
                x.Id,
                x.PurchaseOrderId,
                x.Status.ToString(),
                x.ExpectedAt,
                x.DeliveredAt,
                x.TrackingNumber,
                x.Notes,
                x.CreatedAt,
                x.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<DeliveryResponse> UpdateStatusAsync(
        Guid id,
        DeliveryStatus status,
        DeliveryRequest? request,
        CancellationToken cancellationToken)
    {
        var delivery = await db.Deliveries
            .Include(x => x.PurchaseOrder)
            .ThenInclude(x => x.Items)
            .FirstOrDefaultAsync(
                x => x.Id == id,
                cancellationToken);

        if (delivery is null)
            throw new ProcurementException(
                "DELIVERY_NOT_FOUND",
                "Delivery was not found.");

        if (delivery.Status == DeliveryStatus.Delivered)
            throw new ProcurementException(
                "DELIVERY_ALREADY_COMPLETED",
                "A completed delivery cannot change status.");

        if (delivery.Status == DeliveryStatus.Cancelled)
            throw new ProcurementException(
                "DELIVERY_CANCELLED",
                "A cancelled delivery cannot change status.");

        if (status == DeliveryStatus.Delivered)
        {
            if (request?.Items is null || request.Items.Count == 0)
                throw new ProcurementException(
                    "DELIVERY_ITEMS_REQUIRED",
                    "Received inventory details are required when marking a delivery as delivered.");

            await ReceiveDeliveryStockAsync(
                delivery.PurchaseOrder,
                request.Items,
                cancellationToken);

            var now = DateTime.UtcNow;

            delivery.DeliveredAt = now;
            delivery.PurchaseOrder.ReceivedAt = now;
            delivery.PurchaseOrder.Status = PurchaseOrderStatus.Received;
        }

        delivery.Status = status;
        delivery.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Map(delivery);
    }

    private async Task ReceiveDeliveryStockAsync(
        PurchaseOrder purchaseOrder,
        IReadOnlyList<DeliveryItemRequest> receivedItems,
        CancellationToken cancellationToken)
    {
        if (receivedItems.Count != purchaseOrder.Items.Count)
            throw new ProcurementException(
                "DELIVERY_ITEM_MISMATCH",
                "Received delivery items must match the purchase order items.");

        foreach (var purchaseOrderItem in purchaseOrder.Items)
        {
            var receivedItem = receivedItems
                .SingleOrDefault(x => x.MedicineId == purchaseOrderItem.MedicineId);

            if (receivedItem is null)
                throw new ProcurementException(
                    "DELIVERY_ITEM_MISSING",
                    $"Received details are missing for medicine '{purchaseOrderItem.MedicineId}'.");

            if (receivedItem.Quantity != purchaseOrderItem.RequestedQuantity)
                throw new ProcurementException(
                    "DELIVERY_QUANTITY_MISMATCH",
                    $"Received quantity for medicine '{purchaseOrderItem.MedicineId}' must match the purchase order quantity.");

            var receiveRequest = new ReceiveStockRequest(
                purchaseOrderItem.MedicineId,
                purchaseOrder.FacilityId,
                receivedItem.BatchNumber,
                receivedItem.Quantity,
                receivedItem.ExpiryDateUtc,
                receivedItem.ManufacturingDateUtc);

            await inventoryService.ReceiveAsync(
                receiveRequest,
                cancellationToken);
        }
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static DeliveryResponse Map(Delivery delivery)
    {
        return new DeliveryResponse(
            delivery.Id,
            delivery.PurchaseOrderId,
            delivery.Status.ToString(),
            delivery.ExpectedAt,
            delivery.DeliveredAt,
            delivery.TrackingNumber,
            delivery.Notes,
            delivery.CreatedAt,
            delivery.UpdatedAt);
    }
}
