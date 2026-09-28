namespace MediStock.Api.Features.Procurement.DTOs;

public sealed record DeliveryResponse(
    Guid Id,
    Guid PurchaseOrderId,
    string Status,
    DateTime? ExpectedAt,
    DateTime? DeliveredAt,
    string? TrackingNumber,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt);
