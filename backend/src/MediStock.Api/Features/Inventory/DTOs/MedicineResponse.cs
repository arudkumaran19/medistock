namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record MedicineResponse(Guid Id, string Code, string Name, string Unit, int MinimumStockLevel, bool IsActive);
