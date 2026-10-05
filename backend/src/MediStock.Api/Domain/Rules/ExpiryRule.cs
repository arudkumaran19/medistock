namespace MediStock.Api.Domain.Rules;

public static class ExpiryRule
{
    public static ValidationResult Validate(
        DateOnly expiryDate,
        DateOnly currentDate)
    {
        if (expiryDate <= currentDate)
        {
            return ValidationResult.Failure(
                "EXPIRED_BATCH",
                "Expired batches cannot be transferred.");
        }

        return ValidationResult.Success();
    }
}
