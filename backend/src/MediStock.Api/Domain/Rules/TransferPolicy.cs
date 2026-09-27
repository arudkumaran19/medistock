namespace MediStock.Api.Domain.Rules;

public static class TransferPolicy
{
    public static ValidationResult Validate(
        int sourceStock,
        int reservedStock,
        int minimumStock,
        int transferQuantity,
        DateOnly expiryDate,
        DateOnly currentDate,
        bool storageCompatible,
        bool isAuthorized = true)
    {
        if (transferQuantity <= 0)
        {
            return ValidationResult.Failure(
                "INVALID_QUANTITY",
                "Quantity must be greater than zero.");
        }

        var authResult = AuthorizationRule.Validate(isAuthorized);
        if (!authResult.IsValid)
        {
            return authResult;
        }

        var minStockResult = MinimumStockRule.Validate(
            sourceStock,
            reservedStock,
            minimumStock,
            transferQuantity);
        if (!minStockResult.IsValid)
        {
            return minStockResult;
        }

        var expiryResult = ExpiryRule.Validate(
            expiryDate,
            currentDate);
        if (!expiryResult.IsValid)
        {
            return expiryResult;
        }

        var storageResult = StorageCompatibilityRule.Validate(
            storageCompatible);
        if (!storageResult.IsValid)
        {
            return storageResult;
        }

        return ValidationResult.Success();
    }
}
