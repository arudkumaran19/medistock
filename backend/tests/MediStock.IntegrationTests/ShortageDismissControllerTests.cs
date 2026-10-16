namespace MediStock.IntegrationTests;

using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Demand.Models;
using Microsoft.IdentityModel.Tokens;
using Xunit;

public class ShortageDismissControllerTests : IClassFixture<DemandApiFactory>
{
    private static readonly Guid FacilityA = Guid.Parse("b1000000-0000-0000-0000-000000000001");
    private static readonly Guid FacilityB = Guid.Parse("b1000000-0000-0000-0000-000000000002");
    private static readonly Guid MedicineId = Guid.Parse("c1000000-0000-0000-0000-000000000001");

    private readonly DemandApiFactory _factory;

    public ShortageDismissControllerTests(DemandApiFactory factory) => _factory = factory;

    private static string CreateToken(string role, Guid? userId = null, bool omitUserId = false)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(DemandApiFactory.SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, role),
            new(ClaimTypes.Name, $"test-{role.ToLowerInvariant()}")
        };

        if (!omitUserId)
        {
            claims.Add(new(ClaimTypes.NameIdentifier, (userId ?? Guid.NewGuid()).ToString()));
        }

        var token = new JwtSecurityToken(
            issuer: DemandApiFactory.Issuer,
            audience: DemandApiFactory.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private HttpClient CreateClientWithToken(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task DismissShortage_Returns401_WhenUnauthenticated()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync($"/api/shortages/{Guid.NewGuid()}/dismiss", new { reason = "Test" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DismissShortage_Returns401_WhenUserIdCannotBeResolved()
    {
        // Token validly signed with role Admin but omits NameIdentifier claim
        var tokenWithoutUserId = CreateToken("Admin", omitUserId: true);
        var client = CreateClientWithToken(tokenWithoutUserId);

        var response = await client.PostAsJsonAsync($"/api/shortages/{Guid.NewGuid()}/dismiss", new { reason = "Test" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("User identity could not be resolved from token");
    }

    [Fact]
    public async Task DismissShortage_Returns404_WhenAlertDoesNotExist()
    {
        var client = CreateClientWithToken(CreateToken("Administrator"));
        var nonExistentId = Guid.NewGuid();

        var response = await client.PostAsJsonAsync($"/api/shortages/{nonExistentId}/dismiss", new { reason = "Test" });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain($"Shortage alert {nonExistentId} was not found");
    }

    [Theory]
    [InlineData("RESOLVED")]
    [InlineData("DISMISSED")]
    public async Task DismissShortage_Returns409_WhenAlertNotInOpenOrAcknowledgedStatus(string status)
    {
        var alertId = Guid.NewGuid();
        await _factory.WithDbAsync(async db =>
        {
            db.ShortageAlerts.Add(new ShortageAlert
            {
                Id = alertId,
                FacilityId = FacilityA,
                MedicineId = MedicineId,
                CurrentStock = 50m,
                AverageDailyConsumption = 10m,
                DaysRemaining = 5,
                LeadTimeDays = 10,
                RiskLevel = ShortageRiskLevels.High,
                RequiresTransfer = true,
                Status = status,
                GeneratedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        });

        var client = CreateClientWithToken(CreateToken("Administrator"));
        var response = await client.PostAsJsonAsync($"/api/shortages/{alertId}/dismiss", new { reason = "Test" });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("cannot be dismissed. Only OPEN or ACKNOWLEDGED alerts can be dismissed.");
    }

    [Fact]
    public async Task DismissShortage_Returns403_WhenUserBelongsToDifferentFacility()
    {
        var officerUserId = Guid.NewGuid();
        var alertId = Guid.NewGuid();

        await _factory.WithDbAsync(async db =>
        {
            // Alert is at FacilityB
            db.ShortageAlerts.Add(new ShortageAlert
            {
                Id = alertId,
                FacilityId = FacilityB,
                MedicineId = MedicineId,
                CurrentStock = 50m,
                AverageDailyConsumption = 10m,
                DaysRemaining = 5,
                LeadTimeDays = 10,
                RiskLevel = ShortageRiskLevels.High,
                RequiresTransfer = true,
                Status = ShortageAlertStatuses.Open,
                GeneratedAt = DateTime.UtcNow
            });

            // Store officer is assigned only to FacilityA
            db.UserFacilities.Add(new UserFacility
            {
                UserId = officerUserId,
                FacilityId = FacilityA
            });
            await db.SaveChangesAsync();
        });

        var client = CreateClientWithToken(CreateToken("StoreOfficer", userId: officerUserId));
        var response = await client.PostAsJsonAsync($"/api/shortages/{alertId}/dismiss", new { reason = "Unauthorized attempt" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("You can only dismiss alerts for your own assigned facility.");
    }

    [Fact]
    public async Task DismissShortage_Returns200_WhenFacilityUserDismissesAssignedFacilityAlert()
    {
        var officerUserId = Guid.NewGuid();
        var alertId = Guid.NewGuid();

        await _factory.WithDbAsync(async db =>
        {
            db.ShortageAlerts.Add(new ShortageAlert
            {
                Id = alertId,
                FacilityId = FacilityA,
                MedicineId = MedicineId,
                CurrentStock = 50m,
                AverageDailyConsumption = 10m,
                DaysRemaining = 5,
                LeadTimeDays = 10,
                RiskLevel = ShortageRiskLevels.High,
                RequiresTransfer = true,
                Status = ShortageAlertStatuses.Open,
                GeneratedAt = DateTime.UtcNow
            });

            db.UserFacilities.Add(new UserFacility
            {
                UserId = officerUserId,
                FacilityId = FacilityA
            });
            await db.SaveChangesAsync();
        });

        var client = CreateClientWithToken(CreateToken("StoreOfficer", userId: officerUserId));
        var response = await client.PostAsJsonAsync($"/api/shortages/{alertId}/dismiss", new { reason = "Verified false positive" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = doc.RootElement.GetProperty("data");
        data.GetProperty("status").GetString().Should().Be(ShortageAlertStatuses.Dismissed);
        data.GetProperty("dismissReason").GetString().Should().Be("Verified false positive");
        data.GetProperty("dismissedByUserId").GetGuid().Should().Be(officerUserId);
    }

    [Theory]
    [InlineData("ADMIN")]
    [InlineData("Administrator")]
    [InlineData("FACILITY_MANAGER")]
    [InlineData("FacilityManager")]
    public async Task DismissShortage_Returns200_ForPrivilegedRolesAcrossAnyFacility(string role)
    {
        var managerUserId = Guid.NewGuid();
        var alertId = Guid.NewGuid();

        await _factory.WithDbAsync(async db =>
        {
            // Alert is at FacilityB, manager has NO UserFacility assignment
            db.ShortageAlerts.Add(new ShortageAlert
            {
                Id = alertId,
                FacilityId = FacilityB,
                MedicineId = MedicineId,
                CurrentStock = 50m,
                AverageDailyConsumption = 10m,
                DaysRemaining = 5,
                LeadTimeDays = 10,
                RiskLevel = ShortageRiskLevels.High,
                RequiresTransfer = true,
                Status = ShortageAlertStatuses.Acknowledged,
                GeneratedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        });

        var client = CreateClientWithToken(CreateToken(role, userId: managerUserId));
        var response = await client.PostAsJsonAsync($"/api/shortages/{alertId}/dismiss", new { reason = $"Dismissed by {role}" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = doc.RootElement.GetProperty("data");
        data.GetProperty("status").GetString().Should().Be(ShortageAlertStatuses.Dismissed);
        data.GetProperty("dismissReason").GetString().Should().Be($"Dismissed by {role}");
        data.GetProperty("dismissedByUserId").GetGuid().Should().Be(managerUserId);
    }
}
