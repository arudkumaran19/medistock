namespace MediStock.Api.Domain.Rules;

public static class MinimumStockRule
{
    public static ValidationResult Validate(
        int sourceStock,
        int reservedStock,
        int minimumStock,
        int transferQuantity)
    {
        if (sourceStock < 0)
        {
            return ValidationResult.Failure(
                "INVALID_SOURCE_STOCK",
                "Source stock cannot be negative.");
        }

        if (reservedStock < 0)
        {
            return ValidationResult.Failure(
                "INVALID_RESERVED_STOCK",
                "Reserved stock cannot be negative.");
        }

        if (minimumStock < 0)
        {
            return ValidationResult.Failure(
                "INVALID_MINIMUM_STOCK",
                "Minimum stock cannot be negative.");
        }

        if (transferQuantity <= 0)
        {
            return ValidationResult.Failure(
                "INVALID_TRANSFER_QUANTITY",
                "Transfer quantity must be greater than zero.");
        }

        var availableAfterTransfer =
            sourceStock - reservedStock - transferQuantity;

        if (availableAfterTransfer < minimumStock)
        {
            return ValidationResult.Failure(
                "MINIMUM_STOCK_VIOLATION",
                "Transfer would reduce source stock below its minimum level.");
        }

        return ValidationResult.Success();
    }
}