namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record BatchResponse(Guid Id, Guid MedicineId, string MedicineName, Guid FacilityId, string BatchNumber, int QuantityOnHand, DateTime ExpiryDateUtc, DateTime ManufacturingDateUtc);
