using System.Security.Claims;
using MediStock.Api.Features.Validation.Services;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Identity;
using MediStock.Api.Security;
using Facility = MediStock.Api.Domain.Entities.Facility;
using UserFacility = MediStock.Api.Domain.Entities.UserFacility;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MediStock.UnitTests;

public sealed class PolicyValidationServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _dbContext;

    public PolicyValidationServiceTests()
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
    public void ValidateQuantity_ReturnsSuccess_WhenQuantityIsPositive()
    {
        var service = CreateService();

        var result = service.ValidateQuantity(10);

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public void ValidateQuantity_ReturnsFailure_WhenQuantityIsZero()
    {
        var service = CreateService();

        var result = service.ValidateQuantity(0);

        Assert.False(result.IsValid);
        Assert.Equal("INVALID_QUANTITY", result.Code);
    }

    [Fact]
    public void ValidateQuantity_ReturnsFailure_WhenQuantityIsNegative()
    {
        var service = CreateService();

        var result = service.ValidateQuantity(-10);

        Assert.False(result.IsValid);
        Assert.Equal("INVALID_QUANTITY", result.Code);
    }

    [Fact]
    public void ValidateMinimumStock_ReturnsSuccess_WhenStockRemainsAboveMinimum()
    {
        var service = CreateService();

        var result = service.ValidateMinimumStock(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 200);

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public void ValidateMinimumStock_ReturnsFailure_WhenTransferDropsBelowMinimum()
    {
        var service = CreateService();

        var result = service.ValidateMinimumStock(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 300);

        Assert.False(result.IsValid);
        Assert.Equal("MINIMUM_STOCK_VIOLATION", result.Code);
    }

    [Fact]
    public void ValidateExpiry_ReturnsSuccess_WhenBatchHasNotExpired()
    {
        var service = CreateService();

        var result = service.ValidateExpiry(
            expiryDate: new DateOnly(2026, 12, 31),
            currentDate: new DateOnly(2026, 9, 23));

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public void ValidateExpiry_ReturnsFailure_WhenBatchHasExpired()
    {
        var service = CreateService();

        var result = service.ValidateExpiry(
            expiryDate: new DateOnly(2026, 9, 22),
            currentDate: new DateOnly(2026, 9, 23));

        Assert.False(result.IsValid);
        Assert.Equal("EXPIRED_BATCH", result.Code);
    }

    [Fact]
    public void ValidateStorageCompatibility_ReturnsSuccess_WhenStorageIsCompatible()
    {
        var service = CreateService();

        var result = service.ValidateStorageCompatibility(
            isCompatible: true);

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public void ValidateStorageCompatibility_ReturnsFailure_WhenStorageIsIncompatible()
    {
        var service = CreateService();

        var result = service.ValidateStorageCompatibility(
            isCompatible: false);

        Assert.False(result.IsValid);
        Assert.Equal("STORAGE_INCOMPATIBLE", result.Code);
    }

    [Fact]
    public void ValidateTransfer_ReturnsSuccess_WhenAllPoliciesPass()
    {
        var service = CreateService();

        var result = service.ValidateTransfer(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 200,
            expiryDate: new DateOnly(2026, 12, 31),
            currentDate: new DateOnly(2026, 9, 23),
            storageCompatible: true);

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public void ValidateTransfer_ReturnsFailure_WhenQuantityIsInvalid()
    {
        var service = CreateService();

        var result = service.ValidateTransfer(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 0,
            expiryDate: new DateOnly(2026, 12, 31),
            currentDate: new DateOnly(2026, 9, 23),
            storageCompatible: true);

        Assert.False(result.IsValid);
        Assert.Equal("INVALID_QUANTITY", result.Code);
    }

    [Fact]
    public void ValidateTransfer_ReturnsFailure_WhenMinimumStockIsViolated()
    {
        var service = CreateService();

        var result = service.ValidateTransfer(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 300,
            expiryDate: new DateOnly(2026, 12, 31),
            currentDate: new DateOnly(2026, 9, 23),
            storageCompatible: true);

        Assert.False(result.IsValid);
        Assert.Equal("MINIMUM_STOCK_VIOLATION", result.Code);
    }

    [Fact]
    public void ValidateTransfer_ReturnsFailure_WhenBatchIsExpired()
    {
        var service = CreateService();

        var result = service.ValidateTransfer(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 200,
            expiryDate: new DateOnly(2026, 9, 22),
            currentDate: new DateOnly(2026, 9, 23),
            storageCompatible: true);

        Assert.False(result.IsValid);
        Assert.Equal("EXPIRED_BATCH", result.Code);
    }

    [Fact]
    public void ValidateTransfer_ReturnsFailure_WhenStorageIsIncompatible()
    {
        var service = CreateService();

        var result = service.ValidateTransfer(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 200,
            expiryDate: new DateOnly(2026, 12, 31),
            currentDate: new DateOnly(2026, 9, 23),
            storageCompatible: false);

        Assert.False(result.IsValid);
        Assert.Equal("STORAGE_INCOMPATIBLE", result.Code);
    }

    [Fact]
    public async Task ValidateAuthorizationAsync_ReturnsSuccess_WhenUserHasFacilityAccess()
    {
        var userId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();

        await SeedUserAndFacilityAsync(
            userId,
            facilityId);

        var service = CreateService(userId);

        var result =
            await service.ValidateAuthorizationAsync(
                facilityId);

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public async Task ValidateAuthorizationAsync_ReturnsFailure_WhenUserDoesNotHaveFacilityAccess()
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

        var service = CreateService(userId);

        var result =
            await service.ValidateAuthorizationAsync(
                unauthorizedFacilityId);

        Assert.False(result.IsValid);
        Assert.Equal(
            "UNAUTHORIZED_FACILITY_ACCESS",
            result.Code);
    }

    [Fact]
    public async Task ValidateAuthorizationAsync_ReturnsFailure_WhenUserIsUnauthenticated()
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

        var service = CreateService(null);

        var result =
            await service.ValidateAuthorizationAsync(
                facilityId);

        Assert.False(result.IsValid);
        Assert.Equal(
            "UNAUTHORIZED_FACILITY_ACCESS",
            result.Code);
    }

    private PolicyValidationService CreateService(
        Guid? userId = null)
    {
        var currentUserService =
            CreateCurrentUserService(userId);

        var authorizationService =
            new FacilityAuthorizationService(
                _dbContext,
                currentUserService);

        return new PolicyValidationService(
            authorizationService);
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
