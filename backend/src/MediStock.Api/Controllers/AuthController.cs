using System.Security.Claims;
using MediStock.Api.Features.Auth.DTOs;
using MediStock.Api.Features.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MediStock.Api.Security;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly CurrentUserService _currentUserService;

    public AuthController(
        AuthService authService,
        CurrentUserService currentUserService)
    {
        _authService = authService;
        _currentUserService = currentUserService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _authService.RegisterAsync(
            request,
            cancellationToken);

        return Ok(response);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _authService.LoginAsync(
            request,
            cancellationToken);

        if (response is null)
        {
            return Unauthorized(new
            {
                success = false,
                error = new
                {
                    code = "INVALID_CREDENTIALS",
                    message = "Invalid email or password."
                }
            });
        }

        return Ok(response);
    }
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _authService.RefreshAsync(
            request,
            cancellationToken);

        if (response is null)
        {
            return Unauthorized(new
            {
                success = false,
                error = new
                {
                    code = "INVALID_REFRESH_TOKEN",
                    message = "The refresh token is invalid or expired."
                }
            });
        }

        return Ok(response);
    }
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(
        [FromBody] LogoutRequest request,
        CancellationToken cancellationToken)
    {
        await _authService.LogoutAsync(
            request,
            cancellationToken);

        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public ActionResult<object> Me()
    {
        var userId = _currentUserService.UserId;

        var email = _currentUserService.Email;

        var roles = User.FindAll(
                ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToArray();

        return Ok(new
        {
            userId,
            email,
            roles
        });
    }
}
