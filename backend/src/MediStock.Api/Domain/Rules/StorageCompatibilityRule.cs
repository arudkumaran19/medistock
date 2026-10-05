namespace MediStock.Api.Domain.Rules;

public static class StorageCompatibilityRule
{
    public static ValidationResult Validate(bool isCompatible)
    {
        if (!isCompatible)
        {
            return ValidationResult.Failure(
                "STORAGE_INCOMPATIBLE",
                "Destination facility storage conditions are incompatible with the medicine requirements.");
        }

        return ValidationResult.Success();
    }
}
