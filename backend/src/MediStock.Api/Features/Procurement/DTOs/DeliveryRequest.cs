namespace MediStock.Api.Features.Procurement.DTOs;

public sealed record DeliveryItemRequest(
    Guid MedicineId,
    int Quantity,
    string BatchNumber,
    DateTime ExpiryDateUtc,
    DateTime ManufacturingDateUtc);

public sealed record DeliveryRequest(
    DateTime? ExpectedAt,
    string? TrackingNumber,
    string? Notes,
    IReadOnlyList<DeliveryItemRequest>? Items);
