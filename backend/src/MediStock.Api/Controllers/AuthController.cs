using System.Security.Claims;
using MediStock.Api.Features.Auth.DTOs;
using MediStock.Api.Features.Auth.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MediStock.Api.Security;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly CurrentUserService _currentUserService;
    private readonly ApplicationDbContext _dbContext;

    public AuthController(
        AuthService authService,
        CurrentUserService currentUserService,
        ApplicationDbContext dbContext)
    {
        _authService = authService;
        _currentUserService = currentUserService;
        _dbContext = dbContext;
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
    public async Task<ActionResult<object>> Me(CancellationToken cancellationToken = default)
    {
        var userId = _currentUserService.UserId;

        var email = _currentUserService.Email;

        var roles = User.FindAll(
                ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToArray();

        var facilities = userId.HasValue
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
