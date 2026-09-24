using System.Security.Claims;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Identity;
using MediStock.Api.Security;
using Facility = MediStock.Api.Features.Inventory.Models.Facility;
using UserFacility = MediStock.Api.Domain.Entities.UserFacility;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MediStock.UnitTests;

public sealed class FacilityAuthorizationServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _dbContext;

    public FacilityAuthorizationServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _dbContext = new ApplicationDbContext(options);

        _dbContext.Database.EnsureCreated();
    }

    [Fact]
    public async Task CanAccessFacilityAsync_ReturnsTrue_WhenUserHasFacilityAccess()
    {
        var userId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();

        await SeedUserAndFacilityAsync(
            userId,
            facilityId);

        var currentUserService = CreateCurrentUserService(userId);

        var authorizationService =
            new FacilityAuthorizationService(
                _dbContext,
                currentUserService);

        var result =
            await authorizationService.CanAccessFacilityAsync(
                facilityId);

        Assert.True(result);
    }

    [Fact]
    public async Task CanAccessFacilityAsync_ReturnsFalse_WhenUserDoesNotHaveFacilityAccess()
    {
        var userId = Guid.NewGuid();
        var authorizedFacilityId = Guid.NewGuid();
        var unauthorizedFacilityId = Guid.NewGuid();

        await SeedUserAndFacilityAsync(
            userId,
            authorizedFacilityId);

        _dbContext.Facilities.Add(
            new Facility
            {
                Id = unauthorizedFacilityId,
                Code = $"FAC-{unauthorizedFacilityId:N}",
                Name = "Unauthorized Facility",
                IsActive = true
            });

        await _dbContext.SaveChangesAsync();

        var currentUserService = CreateCurrentUserService(userId);

        var authorizationService =
            new FacilityAuthorizationService(
                _dbContext,
                currentUserService);

        var result =
            await authorizationService.CanAccessFacilityAsync(
                unauthorizedFacilityId);

        Assert.False(result);
    }

    [Fact]
    public async Task CanAccessFacilityAsync_ReturnsFalse_WhenUserIsUnauthenticated()
    {
        var facilityId = Guid.NewGuid();

        _dbContext.Facilities.Add(
            new Facility
            {
                Id = facilityId,
                Code = $"FAC-{facilityId:N}",
                Name = "Test Facility",
                IsActive = true
            });

        await _dbContext.SaveChangesAsync();

        var currentUserService =
            CreateCurrentUserService(null);

        var authorizationService =
            new FacilityAuthorizationService(
                _dbContext,
                currentUserService);

        var result =
            await authorizationService.CanAccessFacilityAsync(
                facilityId);

        Assert.False(result);
    }

    private async Task SeedUserAndFacilityAsync(
        Guid userId,
        Guid facilityId)
    {
        _dbContext.Users.Add(
            new ApplicationUser
            {
                Id = userId,
                UserName = $"test-{userId}@medistock.local",
                Email = $"test-{userId}@medistock.local"
            });

        _dbContext.Facilities.Add(
            new Facility
            {
                Id = facilityId,
                Code = $"FAC-{facilityId:N}",
                Name = "Test Facility",
                IsActive = true
            });

        _dbContext.UserFacilities.Add(
            new UserFacility
            {
                UserId = userId,
                FacilityId = facilityId
            });

        await _dbContext.SaveChangesAsync();
    }

    private static CurrentUserService CreateCurrentUserService(
        Guid? userId)
    {
        var httpContext = new DefaultHttpContext();

        if (userId.HasValue)
        {
            httpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    new[]
                    {
                        new Claim(
                            ClaimTypes.NameIdentifier,
                            userId.Value.ToString())
                    },
                    authenticationType: "Test"));
        }

        var httpContextAccessor =
            new HttpContextAccessor
            {
                HttpContext = httpContext
            };

        return new CurrentUserService(
            httpContextAccessor);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        _connection.Dispose();
    }
}
