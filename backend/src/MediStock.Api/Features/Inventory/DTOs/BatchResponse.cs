namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record BatchResponse(
    Guid Id,
    Guid MedicineId,
    string BatchNumber,
    DateOnly ExpiryDate,
    int Quantity);
