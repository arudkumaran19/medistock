using MediStock.Api.Features.Inventory.Services;

namespace MediStock.Api.Features.Inventory.Validators;

public static class InventoryValidator
{
	public static string ValidateBatchNumber(string? batchNumber)
	{
		var normalized = batchNumber?.Trim();
		if (string.IsNullOrWhiteSpace(normalized) || normalized == "-1") throw new InventoryException("INVALID_BATCH_NUMBER", "A meaningful batch number is required.");
		if (normalized.Length > 100) throw new InventoryException("INVALID_BATCH_NUMBER", "Batch number must be 100 characters or fewer.");
		return normalized;
	}

	public static void ValidateBatchDates(DateTime expiryDateUtc, DateTime manufacturingDateUtc)
	{
		if (expiryDateUtc <= manufacturingDateUtc) throw new InventoryException("INVALID_BATCH_DATES", "Expiry date must be later than manufacture date.");
	}

	public static void ValidateQuantity(int quantity)
	{
		if (quantity <= 0) throw new InventoryException("INVALID_QUANTITY", "Quantity must be greater than zero.");
	}
}
