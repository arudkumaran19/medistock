using System.Security.Claims;
using MediStock.Api.Common.Audit;
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
    private readonly IAuditService _auditService;

    public AuthController(
        AuthService authService,
        CurrentUserService currentUserService,
        IAuditService auditService)
    {
        _authService = authService;
        _currentUserService = currentUserService;
        _auditService = auditService;
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

        await _auditService.LogAsync(
            action: "USER_REGISTERED",
            resourceType: "User",
            resourceId: response.UserId.ToString(),
            outcome: "SUCCESS",
            details: new { response.Email, Roles = response.Roles },
            actorEmail: response.Email,
            actorRole: response.Roles.FirstOrDefault() ?? "User",
            correlationId: HttpContext.TraceIdentifier,
            cancellationToken: cancellationToken);

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
            await _auditService.LogAsync(
                action: "USER_LOGIN_FAILED",
                resourceType: "Auth",
                resourceId: null,
                outcome: "FAILURE",
                reason: "Invalid email or password",
                actorEmail: request.Email,
                actorRole: "Anonymous",
                correlationId: HttpContext.TraceIdentifier,
                cancellationToken: cancellationToken);

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

        await _auditService.LogAsync(
            action: "USER_LOGIN_SUCCESS",
            resourceType: "User",
            resourceId: response.UserId.ToString(),
            outcome: "SUCCESS",
            details: new { response.Email, Roles = response.Roles },
            actorEmail: response.Email,
            actorRole: response.Roles.FirstOrDefault() ?? "User",
            correlationId: HttpContext.TraceIdentifier,
            cancellationToken: cancellationToken);

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
            await _auditService.LogAsync(
                action: "TOKEN_REFRESH_FAILED",
                resourceType: "Auth",
                resourceId: null,
                outcome: "FAILURE",
                reason: "Invalid or expired refresh token",
                actorRole: "Anonymous",
                correlationId: HttpContext.TraceIdentifier,
                cancellationToken: cancellationToken);

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

        await _auditService.LogAsync(
            action: "TOKEN_REFRESH_SUCCESS",
            resourceType: "User",
            resourceId: response.UserId.ToString(),
            outcome: "SUCCESS",
            actorEmail: response.Email,
            actorRole: response.Roles.FirstOrDefault() ?? "User",
            correlationId: HttpContext.TraceIdentifier,
            cancellationToken: cancellationToken);

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

        await _auditService.LogAsync(
            action: "USER_LOGOUT",
            resourceType: "Auth",
            resourceId: null,
            outcome: "SUCCESS",
            correlationId: HttpContext.TraceIdentifier,
            cancellationToken: cancellationToken);

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
