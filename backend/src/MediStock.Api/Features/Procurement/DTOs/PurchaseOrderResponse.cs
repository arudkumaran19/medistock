namespace MediStock.Api.Features.Procurement.DTOs;

public sealed record PurchaseOrderItemResponse(
    Guid Id,
    Guid MedicineId,
    int RequestedQuantity,
    decimal UnitPrice);

public sealed record PurchaseOrderResponse(
    Guid Id,
    Guid SupplierId,
    Guid FacilityId,
    string Status,
    DateTime RequestedAt,
    DateTime? ApprovedAt,
    DateTime? ReceivedAt,
    IReadOnlyList<PurchaseOrderItemResponse> Items);