using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Auth.DTOs;

public sealed record RegisterRequest(
    string Email,
    string Password,
    string ConfirmPassword,
    string FirstName,
    string LastName,
    UserRole Role);