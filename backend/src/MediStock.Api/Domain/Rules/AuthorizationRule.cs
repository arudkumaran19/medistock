namespace MediStock.Api.Domain.Rules;

public static class AuthorizationRule
{
    public static ValidationResult Validate(bool isAuthorized)
    {
        if (!isAuthorized)
        {
            return ValidationResult.Failure(
                "UNAUTHORIZED_ACCESS",
                "User is not authorized to perform this operation or access the specified facility.");
        }

        return ValidationResult.Success();
    }
}
