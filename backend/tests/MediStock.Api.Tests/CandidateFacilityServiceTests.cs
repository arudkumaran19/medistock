using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using MediStock.Api.Data;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Services;

namespace MediStock.Api.Tests;

public class CandidateFacilityServiceTests
{
    private MediStockDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<MediStockDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new MediStockDbContext(options);
    }

    [Fact]
    public async Task FindCandidatesAsync_CalculatesSurplusCorrectly_AndExcludesZeroOrNegativeSurplus()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();

        var medicineId = Guid.NewGuid();
        var destinationId = Guid.NewGuid();
        var supplier1Id = Guid.NewGuid();
        var supplier2NoSurplusId = Guid.NewGuid();
        var supplier3Id = Guid.NewGuid();

        // 1. Destination facility (experiencing shortage)
        db.Facilities.Add(new Facility
        {
            Id = destinationId,
            Name = "Destination Hospital",
            FacilityCode = "FAC-DEST",
            Latitude = 6.0,
            Longitude = 80.0,
            IsActive = true
        });

        // 2. Candidate 1 (Positive surplus: 1000 - 200 - 100 = 700)
        db.Facilities.Add(new Facility
        {
            Id = supplier1Id,
            Name = "Supplier Alpha",
            FacilityCode = "FAC-SUP-A",
            Latitude = 6.9,
            Longitude = 79.8,
            IsActive = true
        });
        db.FacilityInventories.Add(new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = supplier1Id,
            MedicineId = medicineId,
            StockOnHand = 1000,
            SafetyStockThreshold = 200,
            ReservedStock = 100
        });

        // 3. Candidate 2 (No surplus: 500 - 500 - 0 = 0)
        db.Facilities.Add(new Facility
        {
            Id = supplier2NoSurplusId,
            Name = "Supplier Beta",
            FacilityCode = "FAC-SUP-B",
            Latitude = 7.2,
            Longitude = 80.5,
            IsActive = true
        });
        db.FacilityInventories.Add(new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = supplier2NoSurplusId,
            MedicineId = medicineId,
            StockOnHand = 500,
            SafetyStockThreshold = 500,
            ReservedStock = 0
        });

        // 4. Candidate 3 (Positive surplus: 600 - 100 - 50 = 450)
        db.Facilities.Add(new Facility
        {
            Id = supplier3Id,
            Name = "Supplier Gamma",
            FacilityCode = "FAC-SUP-G",
            Latitude = 7.1,
            Longitude = 79.9,
            IsActive = true
        });
        db.FacilityInventories.Add(new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = supplier3Id,
            MedicineId = medicineId,
            StockOnHand = 600,
            SafetyStockThreshold = 100,
            ReservedStock = 50
        });

        await db.SaveChangesAsync();

        var routingServiceMock = new Mock<IRoutingService>();
        routingServiceMock
            .Setup(r => r.CalculateRouteAsync(It.IsAny<Facility>(), It.IsAny<Facility>(), default))
            .ReturnsAsync((Facility s, Facility d, System.Threading.CancellationToken ct) => new RouteResponse
            {
                DistanceKm = 50m,
                DurationMinutes = 60m,
                Provider = "MockRoute"
            });

        var loggerMock = new Mock<ILogger<CandidateFacilityService>>();
        var service = new CandidateFacilityService(db, routingServiceMock.Object, loggerMock.Object);

        // Act
        var candidates = await service.FindCandidatesAsync(destinationId, medicineId, requestedQuantity: 400);

        // Assert
        candidates.Should().HaveCount(2); // Only Alpha and Gamma have surplus > 0
        candidates.Should().NotContain(c => c.FacilityId == supplier2NoSurplusId);
        candidates.Should().NotContain(c => c.FacilityId == destinationId);

        var alpha = candidates.First(c => c.FacilityId == supplier1Id);
        alpha.AvailableSurplus.Should().Be(700);
        alpha.RecommendedQuantity.Should().Be(400); // Requested 400, surplus 700 -> recommend 400

        var gamma = candidates.First(c => c.FacilityId == supplier3Id);
        gamma.AvailableSurplus.Should().Be(450);
        gamma.RecommendedQuantity.Should().Be(400);
    }
}
