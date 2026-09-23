using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Auth.DTOs;
using MediStock.Api.Infrastructure.Persistence.Identity;
using Microsoft.AspNetCore.Identity;

namespace MediStock.Api.Features.Auth.Services;

public sealed class AuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly JwtTokenService _jwtTokenService;
    private readonly RefreshTokenService _refreshTokenService;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        JwtTokenService jwtTokenService,
        RefreshTokenService refreshTokenService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _jwtTokenService = jwtTokenService;
        _refreshTokenService = refreshTokenService;
    }

    public async Task<LoginResponse> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        var existingUser = await _userManager.FindByEmailAsync(request.Email);

        if (existingUser is not null)
        {
            throw new InvalidOperationException(
                "A user with this email already exists.");
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(
            user,
            request.Password);

        if (!result.Succeeded)
        {
            var errors = string.Join(
                "; ",
                result.Errors.Select(error => error.Description));

            throw new InvalidOperationException(errors);
        }

        var role = request.Role.ToString();

        var roleResult = await _userManager.AddToRoleAsync(
            user,
            role);

        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);

            var errors = string.Join(
                "; ",
                roleResult.Errors.Select(error => error.Description));

            throw new InvalidOperationException(errors);
        }

        var (accessToken, expiresAt) =
            await _jwtTokenService.CreateAccessTokenAsync(user);

        var refreshToken =
            await _refreshTokenService.CreateAsync(
                user,
                cancellationToken);

        return new LoginResponse(
            accessToken,
            refreshToken,
            expiresAt,
            user.Id,
            user.Email!,
            new[] { role });
    }

    public async Task<LoginResponse?> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);

        if (user is null)
        {
            return null;
        }

        var result = await _signInManager.CheckPasswordSignInAsync(
            user,
            request.Password,
            lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            return null;
        }

        var roles = await _userManager.GetRolesAsync(user);

        var (accessToken, expiresAt) =
            await _jwtTokenService.CreateAccessTokenAsync(user);

        var refreshToken =
            await _refreshTokenService.CreateAsync(
                user,
                cancellationToken);

        return new LoginResponse(
            accessToken,
            refreshToken,
            expiresAt,
            user.Id,
            user.Email!,
            roles.ToArray());
    }
    public async Task<LoginResponse?> RefreshAsync(
        RefreshTokenRequest request,
        CancellationToken cancellationToken = default)
    {
        var storedToken =
            await _refreshTokenService.FindActiveAsync(
                request.RefreshToken,
                cancellationToken);

        if (storedToken is null)
        {
            return null;
        }

        var user = storedToken.User;

        var roles = await _userManager.GetRolesAsync(user);

        var (accessToken, expiresAt) =
            await _jwtTokenService.CreateAccessTokenAsync(user);

        await _refreshTokenService.RevokeAsync(
            storedToken,
            cancellationToken);

        var newRefreshToken =
            await _refreshTokenService.CreateAsync(
                user,
                cancellationToken);

        return new LoginResponse(
            accessToken,
            newRefreshToken,
            expiresAt,
            user.Id,
            user.Email!,
            roles.ToArray());
    }
    public async Task LogoutAsync(
        LogoutRequest request,
        CancellationToken cancellationToken = default)
    {
        var storedToken =
            await _refreshTokenService.FindActiveAsync(
                request.RefreshToken,
                cancellationToken);

        if (storedToken is null)
        {
            return;
        }

        await _refreshTokenService.RevokeAsync(
            storedToken,
            cancellationToken);
    }
}
