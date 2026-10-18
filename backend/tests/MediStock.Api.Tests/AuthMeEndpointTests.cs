using System.Security.Claims;
using FluentAssertions;
using MediStock.Api.Controllers;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Auth.DTOs;
using MediStock.Api.Features.Auth.Services;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace MediStock.Api.Tests;

public sealed class AuthMeEndpointTests
{
    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task Me_ReturnsUserFacilities_WhenUserHasAssignedFacilities()
    {
        // Arrange
        using var db = CreateDb();
        var userId = Guid.NewGuid();
        var facilityId1 = Guid.NewGuid();
        var facilityId2 = Guid.NewGuid();

        db.Facilities.AddRange(
            new Facility { Id = facilityId1, Name = "Colombo General Hospital", Code = "COL-GEN" },
            new Facility { Id = facilityId2, Name = "Kandy Teaching Hospital", Code = "KAN-TH" }
        );

        db.UserFacilities.AddRange(
            new UserFacility { UserId = userId, FacilityId = facilityId1 },
            new UserFacility { UserId = userId, FacilityId = facilityId2 }
        );
        await db.SaveChangesAsync();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, "store@medistock.com"),
            new(ClaimTypes.Role, "FacilityUser")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext { User = principal };
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var currentUserService = new CurrentUserService(httpContextAccessor.Object);

        var controller = new AuthController(null!, currentUserService, db)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };

        // Act
        var actionResult = await controller.Me();

        // Assert
        var okResult = actionResult.Result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);

        var response = okResult.Value;
        response.Should().NotBeNull();

        var dynamicObj = response!;
        var emailProp = dynamicObj.GetType().GetProperty("email")?.GetValue(dynamicObj) as string;
        var rolesProp = dynamicObj.GetType().GetProperty("roles")?.GetValue(dynamicObj) as string[];
        var facilitiesProp = dynamicObj.GetType().GetProperty("facilities")?.GetValue(dynamicObj) as IEnumerable<UserFacilityResponse>;

        emailProp.Should().Be("store@medistock.com");
        rolesProp.Should().ContainSingle().Which.Should().Be("FacilityUser");
        facilitiesProp.Should().NotBeNull();
        facilitiesProp!.Select(f => f.Name).Should().Contain(new[] { "Colombo General Hospital", "Kandy Teaching Hospital" });
    }

    [Fact]
    public async Task Me_ReturnsEmptyFacilities_WhenUserHasNoAssignedFacilities()
    {
        // Arrange
        using var db = CreateDb();
        var userId = Guid.NewGuid();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, "officer@medistock.com"),
            new(ClaimTypes.Role, "FieldOfficer")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext { User = principal };
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var currentUserService = new CurrentUserService(httpContextAccessor.Object);

        var controller = new AuthController(null!, currentUserService, db)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };

        // Act
        var actionResult = await controller.Me();

        // Assert
        var okResult = actionResult.Result as OkObjectResult;
        okResult.Should().NotBeNull();

        var dynamicObj = okResult!.Value!;
        var facilitiesProp = dynamicObj.GetType().GetProperty("facilities")?.GetValue(dynamicObj) as IEnumerable<UserFacilityResponse>;

        facilitiesProp.Should().NotBeNull();
        facilitiesProp.Should().BeEmpty();
    }

    [Fact]
    public void AuthController_HasExactlyOneApplicableConstructor_AndCanBeActivatedByDependencyInjection()
    {
        // Assert that AuthController has exactly one public constructor
        var constructors = typeof(AuthController).GetConstructors();
        constructors.Length.Should().Be(1, "AuthController must have a single unambiguous constructor for ASP.NET Core activator");
    }
}
