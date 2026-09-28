namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record CreateMedicineRequest(string? Code, string? Name, string? Unit, int? MinimumStockLevel);
