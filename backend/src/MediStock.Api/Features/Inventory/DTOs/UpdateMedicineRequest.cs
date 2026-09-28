namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record UpdateMedicineRequest(string? Name, string? Unit, int? MinimumStockLevel);
