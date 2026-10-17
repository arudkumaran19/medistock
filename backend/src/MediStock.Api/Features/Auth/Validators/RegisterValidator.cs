using MediStock.Api.Features.Auth.DTOs;

namespace MediStock.Api.Features.Auth.Validators;

public sealed class RegisterValidator
{
    public (bool IsValid, string? ErrorMessage) Validate(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return (false, "Email address is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return (false, "Password is required.");
        }

        if (request.Password.Length < 8)
        {
            return (false, "Password must be at least 8 characters long.");
        }

        if (request.Password != request.ConfirmPassword)
        {
            return (false, "Password and confirmation password do not match.");
        }

        if (string.IsNullOrWhiteSpace(request.FirstName))
        {
            return (false, "First name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.LastName))
        {
            return (false, "Last name is required.");
        }

        return (true, null);
    }
}
