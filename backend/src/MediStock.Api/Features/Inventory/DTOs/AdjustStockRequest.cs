namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record AdjustStockRequest(Guid MedicineId, Guid FacilityId, int QuantityDelta, string Reason);
