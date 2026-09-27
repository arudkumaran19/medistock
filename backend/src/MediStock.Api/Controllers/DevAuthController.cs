namespace MediStock.Api.Controllers;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MediStock.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

/// <summary>
/// TEMPORARY DEVELOPMENT-ONLY SIGN-IN. DELETE ON INTEGRATION.
///
/// Authentication is owned by Vaisnavi L. (IT24102469) under
/// Features/Auth/ and Security/. Her real sign-in - registration, password
/// hashing, Identity users, refresh tokens - is the authoritative implementation and
/// replaces this file entirely.
///
/// This exists only because the Demand vertical's pages are all [Authorize]-protected
/// and there is currently no way to obtain a token, which makes the whole application
/// unusable locally. It mints a token for a chosen role so the Demand slice can be run
/// and demonstrated before Auth lands.
///
/// SECURITY: every action is refused outside the Development environment - the
/// endpoint returns 404 so it does not exist in a deployed build. It performs no
/// password check and must never be deployed. It is deliberately not part of the
/// frozen API contract and lives under /api/dev/ so it is obvious on sight.
/// </summary>
[ApiController]
[Route("api/dev")]
[AllowAnonymous]
[Produces("application/json")]
public class DevAuthController : ControllerBase
{
    private static readonly string[] AllowedRoles =
    [
        Constants.Roles.StoreOfficer,
        Constants.Roles.FacilityManager,
        Constants.Roles.SupplierOfficer,
        Constants.Roles.Admin
    ];

    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<DevAuthController> _logger;

    public DevAuthController(
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<DevAuthController> logger)
    {
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    /// <summary>
    /// Issues a development token for the requested role.
    /// Returns 404 outside Development.
    /// </summary>
    [HttpPost("token")]
    [ProducesResponseType(typeof(ApiResponse<DevTokenResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult IssueToken([FromBody] DevTokenRequest request)
    {
        if (!_environment.IsDevelopment())
        {
            // Not 403: outside development this endpoint should look absent.
            return NotFound();
        }

        var role = string.IsNullOrWhiteSpace(request?.Role)
            ? Constants.Roles.FacilityManager
            : request.Role.Trim().ToUpperInvariant();

        if (!AllowedRoles.Contains(role))
        {
            return BadRequest(ErrorResponse.Create(
                "DEV_UNKNOWN_ROLE",
                $"Role must be one of: {string.Join(", ", AllowedRoles)}.",
                HttpContext.TraceIdentifier));
        }

        var signingKey = _configuration["Jwt:Key"];

        if (string.IsNullOrWhiteSpace(signingKey))
        {
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                ErrorResponse.Create(
                    "DEV_JWT_NOT_CONFIGURED",
                    "Jwt:Key is not configured.",
                    HttpContext.TraceIdentifier));
        }

        var issuer = _configuration["Jwt:Issuer"];
        issuer = string.IsNullOrWhiteSpace(issuer) ? "MediStock" : issuer;

        var audience = _configuration["Jwt:Audience"];
        audience = string.IsNullOrWhiteSpace(audience) ? "MediStock" : audience;

        var expires = DateTime.UtcNow.AddHours(8);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims:
            [
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Name, $"dev-{role.ToLowerInvariant()}"),
                new Claim(ClaimTypes.Role, role)
            ],
            expires: expires,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                SecurityAlgorithms.HmacSha256));

        _logger.LogWarning(
            "Development token issued for role {Role}. This endpoint must never be deployed.",
            role);

        return Ok(ApiResponse<DevTokenResponse>.Ok(new DevTokenResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            role,
            $"dev-{role.ToLowerInvariant()}",
            expires)));
    }
}

/// <summary>Development sign-in request. Deleted with the controller.</summary>
public class DevTokenRequest
{
    public string? Role { get; set; }
}

/// <summary>Development sign-in response. Deleted with the controller.</summary>
public sealed record DevTokenResponse(
    string AccessToken,
    string Role,
    string DisplayName,
    DateTime ExpiresAt);
