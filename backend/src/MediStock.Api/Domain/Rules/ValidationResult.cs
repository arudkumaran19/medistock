namespace MediStock.Api.Domain.Rules;

public sealed record ValidationResult(
    bool IsValid,
    string Code,
    string Message)
{
    public static ValidationResult Success(
        string code = "VALID")
    {
        return new ValidationResult(
            true,
            code,
            "Validation passed.");
    }

    public static ValidationResult Failure(
        string code,
        string message)
    {
        return new ValidationResult(
            false,
            code,
            message);
    }
}