namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record ReserveStockRequest(Guid MedicineId, Guid FacilityId, int Quantity, string Reason);