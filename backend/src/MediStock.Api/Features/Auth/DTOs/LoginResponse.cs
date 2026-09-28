namespace MediStock.Api.Features.Auth.DTOs;

public sealed record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    Guid UserId,
    string Email,
    IReadOnlyCollection<string> Roles);