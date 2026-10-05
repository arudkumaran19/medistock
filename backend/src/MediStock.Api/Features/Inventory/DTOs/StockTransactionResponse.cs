namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record StockTransactionResponse(Guid Id, DateTime CreatedAtUtc, string Type, int Quantity, string Reason, int BalanceAfter, string? BatchNumber);
