using MediStock.Api.Features.Inventory.Services;
using System.Text.RegularExpressions;

namespace MediStock.Api.Features.Inventory.Validators;

public static class InventoryValidator
{
	private static readonly Regex MedicineCodePattern = new("^[A-Za-z0-9]+-\\d{3}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
	private static readonly Regex BatchNumberPattern = new("^BATCH-\\d{3}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

	public static string ValidateMedicineCode(string? code)
	{
		var normalized = code?.Trim();
		if (string.IsNullOrWhiteSpace(normalized)) throw new InventoryException("MEDICINE_CODE_REQUIRED", "Medicine code is required.");
		if (!MedicineCodePattern.IsMatch(normalized)) throw new InventoryException("INVALID_MEDICINE_CODE", "Medicine code must follow the format MEDICINE-###, for example PARA-500.");
		return normalized;
	}

	public static string ValidateMedicineName(string? name)
	{
		var normalized = name?.Trim();
		if (string.IsNullOrWhiteSpace(normalized)) throw new InventoryException("MEDICINE_NAME_REQUIRED", "Medicine name is required.");
		if (normalized.Length > 200) throw new InventoryException("INVALID_MEDICINE_NAME", "Medicine name must be 200 characters or fewer.");
		return normalized;
	}

	public static string ValidateUnit(string? unit)
	{
		var normalized = unit?.Trim();
		if (string.IsNullOrWhiteSpace(normalized)) throw new InventoryException("UNIT_REQUIRED", "Unit is required.");
		if (normalized.Length > 30 || !normalized.Any(char.IsLetter)) throw new InventoryException("INVALID_UNIT", "Unit must contain text such as tablet, capsule, bottle, or box and be 30 characters or fewer.");
		return normalized;
	}

	public static int ValidateMinimumStockLevel(int? minimumStockLevel)
	{
		if (!minimumStockLevel.HasValue) throw new InventoryException("MINIMUM_STOCK_REQUIRED", "Minimum stock must be a non-negative whole number.");
		if (minimumStockLevel.Value < 0) throw new InventoryException("INVALID_MINIMUM_STOCK", "Minimum stock must be a non-negative whole number.");
		return minimumStockLevel.Value;
	}

	public static string ValidateBatchNumber(string? batchNumber)
	{
		var normalized = batchNumber?.Trim();
		if (string.IsNullOrWhiteSpace(normalized)) throw new InventoryException("INVALID_BATCH_NUMBER", "Batch number must follow the format BATCH-###, for example BATCH-001.");
		if (!BatchNumberPattern.IsMatch(normalized)) throw new InventoryException("INVALID_BATCH_NUMBER", "Batch number must follow the format BATCH-###, for example BATCH-001.");
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
