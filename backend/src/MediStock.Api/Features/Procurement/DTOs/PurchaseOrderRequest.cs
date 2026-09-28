namespace MediStock.Api.Features.Procurement.DTOs;

public sealed record PurchaseOrderItemRequest(
    Guid MedicineId,
    int RequestedQuantity,
    decimal UnitPrice);

public sealed record PurchaseOrderRequest(
    Guid SupplierId,
    Guid FacilityId,
    IReadOnlyList<PurchaseOrderItemRequest> Items);