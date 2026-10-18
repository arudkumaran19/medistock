using System.Security.Claims;
using MediStock.Api.Common.Audit;
using MediStock.Api.Features.Auth.DTOs;
using MediStock.Api.Features.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MediStock.Api.Security;

using Microsoft.EntityFrameworkCore;
using MediStock.Api.Infrastructure.Persistence;

using Microsoft.Extensions.DependencyInjection;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly CurrentUserService _currentUserService;
    private readonly IAuditService? _auditService;
    private readonly ApplicationDbContext? _dbContext;

    public AuthController(
        AuthService authService,
        CurrentUserService currentUserService,
        ApplicationDbContext dbContext,
        IAuditService? auditService = null)
    {
        _authService = authService;
        _currentUserService = currentUserService;
        _dbContext = dbContext;
        _auditService = auditService;
    }

    private async Task LogAuditAsync(
        string action,
        string resourceType,
        string? resourceId = null,
        string outcome = "SUCCESS",
        string? reason = null,
        object? details = null,
        string? actorEmail = null,
        string? actorRole = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        if (_auditService != null)
        {
            await _auditService.LogAsync(
                action: action,
                resourceType: resourceType,
                resourceId: resourceId,
                outcome: outcome,
                reason: reason,
                details: details,
                actorEmail: actorEmail,
                actorRole: actorRole,
                correlationId: correlationId,
                cancellationToken: cancellationToken);
        }
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

        await LogAuditAsync(
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
            await LogAuditAsync(
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

        await LogAuditAsync(
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
            await LogAuditAsync(
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

        await LogAuditAsync(
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

        await LogAuditAsync(
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
    public async Task<ActionResult<object>> Me(CancellationToken cancellationToken = default)
    {
        var userId = _currentUserService.UserId;

        var email = _currentUserService.Email;

        var roles = User.FindAll(
                ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToArray();

        var facilities = userId.HasValue && _dbContext != null
            ? await (from uf in _dbContext.UserFacilities
                     join f in _dbContext.Facilities on uf.FacilityId equals f.Id
                     where uf.UserId == userId.Value
                     orderby f.Name
                     select new UserFacilityResponse(f.Id, f.Name))
                    .ToListAsync(cancellationToken)
            : new List<UserFacilityResponse>();

        return Ok(new
        {
            userId,
            email,
            roles,
            facilities
        });
    }
}
