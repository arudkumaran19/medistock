namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record CreateMedicineBatchRequest(Guid MedicineId, Guid FacilityId, string? BatchNumber, int Quantity, DateTime ExpiryDateUtc, DateTime ManufacturingDateUtc);
