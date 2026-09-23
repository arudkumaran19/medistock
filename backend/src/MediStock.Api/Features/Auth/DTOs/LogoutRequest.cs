namespace MediStock.Api.Features.Auth.DTOs;

public sealed record LogoutRequest(
    string RefreshToken);