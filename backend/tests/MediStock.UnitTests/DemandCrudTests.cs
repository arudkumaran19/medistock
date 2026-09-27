namespace MediStock.UnitTests;

using FluentAssertions;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

/// <summary>
/// CRUD tests for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// Covers create, update, delete and resolve across shortage alerts, consumption
/// records and forecasts.
/// </summary>
public class DemandCrudTests : IDisposable
{
    private static readonly Guid FacilityId = Guid.Parse("b1000000-0000-0000-0000-000000000002");
    private static readonly Guid MedicineId = Guid.Parse("c1000000-0000-0000-0000-000000000001");

    private readonly ApplicationDbContext _db;
    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly ShortageService _shortageService;

    public DemandCrudTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"medistock-crud-{Guid.NewGuid()}")
            .Options;

        _db = new ApplicationDbContext(options);
        _consumptionService = new ConsumptionService(_db, NullLogger<ConsumptionService>.Instance);
        _forecastService = new ForecastService(_db, _consumptionService, NullLogger<ForecastService>.Instance);
        _shortageService = new ShortageService(
            _db,
            _consumptionService,
            _forecastService,
            NullLogger<ShortageService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    // -----------------------------------------------------------------------
    // Shortage: create
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CreateShortage_DerivesTheFiguresRatherThanTrustingTheCaller()
    {
        var alert = await _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        alert.DaysRemaining.Should().Be(6);
        alert.RiskLevel.Should().Be(ShortageRiskLevels.High);
        alert.RequiresTransfer.Should().BeTrue();
        alert.Status.Should().Be(ShortageAlertStatuses.Open);
    }

    [Fact]
    public async Task CreateShortage_DerivesTheRateFromHistoryWhenOmitted()
    {
        await SeedConsumptionAsync(days: 30, quantityPerDay: 20m);

        var alert = await _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            LeadTimeDays = 10,
            WindowDays = 30
        });

        alert.AverageDailyConsumption.Should().Be(20m);
        alert.DaysRemaining.Should().Be(6);
    }

    // -----------------------------------------------------------------------
    // Shortage: update
    // -----------------------------------------------------------------------

    [Fact]
    public async Task UpdateShortage_ChangesTheStatus()
    {
        var created = await CreateAlertAsync();

        var updated = await _shortageService.UpdateShortageAsync(
            created.Id,
            new ShortageUpdateRequest { Status = ShortageAlertStatuses.Acknowledged });

        updated!.Status.Should().Be(ShortageAlertStatuses.Acknowledged);
    }

    [Fact]
    public async Task UpdateShortage_RecalculatesWhenTheStockChanges()
    {
        // The whole point of the update path: a corrected quantity must not leave the
        // derived figures describing the old one.
        var created = await CreateAlertAsync();
        created.DaysRemaining.Should().Be(6);

        var updated = await _shortageService.UpdateShortageAsync(
            created.Id,
            new ShortageUpdateRequest { CurrentStock = 400m });

        updated!.CurrentStock.Should().Be(400m);
        updated.DaysRemaining.Should().Be(20);
        updated.RiskLevel.Should().Be(ShortageRiskLevels.Medium);
        updated.RequiresTransfer.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateShortage_RecalculatesWhenTheLeadTimeChanges()
    {
        var created = await CreateAlertAsync();

        // 6 days of cover against a 5 day lead time is no longer a shortage.
        var updated = await _shortageService.UpdateShortageAsync(
            created.Id,
            new ShortageUpdateRequest { LeadTimeDays = 5 });

        updated!.LeadTimeDays.Should().Be(5);
        updated.RequiresTransfer.Should().BeFalse();
        updated.RiskLevel.Should().Be(ShortageRiskLevels.Medium);
    }

    [Fact]
    public async Task UpdateShortage_LeavesDerivedFiguresAloneForAStatusOnlyChange()
    {
        var created = await CreateAlertAsync();

        var updated = await _shortageService.UpdateShortageAsync(
            created.Id,
            new ShortageUpdateRequest { Status = ShortageAlertStatuses.Acknowledged });

        updated!.CurrentStock.Should().Be(created.CurrentStock);
        updated.DaysRemaining.Should().Be(created.DaysRemaining);
        updated.RiskLevel.Should().Be(created.RiskLevel);
    }

    [Fact]
    public async Task UpdateShortage_ReturnsNullWhenMissing()
    {
        var result = await _shortageService.UpdateShortageAsync(
            Guid.NewGuid(),
            new ShortageUpdateRequest { Status = ShortageAlertStatuses.Resolved });

        result.Should().BeNull();
    }

    // -----------------------------------------------------------------------
    // Shortage: resolve and delete
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ResolveShortage_KeepsTheRecordForAudit()
    {
        var created = await CreateAlertAsync();

        var resolved = await _shortageService.ResolveShortageAsync(created.Id);

        resolved!.Status.Should().Be(ShortageAlertStatuses.Resolved);
        // Resolving is a status change, not a delete.
        (await _db.ShortageAlerts.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DeleteShortage_RemovesTheRecord()
    {
        var created = await CreateAlertAsync();

        (await _shortageService.DeleteShortageAsync(created.Id)).Should().BeTrue();
        (await _db.ShortageAlerts.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task DeleteShortage_ReturnsFalseWhenMissing()
    {
        (await _shortageService.DeleteShortageAsync(Guid.NewGuid())).Should().BeFalse();
    }

    // -----------------------------------------------------------------------
    // Consumption CRUD
    // -----------------------------------------------------------------------

    [Fact]
    public async Task UpdateConsumption_CorrectsTheQuantity()
    {
        var created = await _consumptionService.CreateConsumptionAsync(NewConsumption(quantity: 200m));

        var updated = await _consumptionService.UpdateConsumptionAsync(
            created.Id,
            NewConsumption(quantity: 20m));

        updated!.QuantityUsed.Should().Be(20m);

        var stored = await _db.ConsumptionRecords.SingleAsync();
        stored.QuantityUsed.Should().Be(20m);
        stored.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateConsumption_ChangesWhatLaterForecastsSee()
    {
        // A mis-keyed 200 instead of 20 skews the average until it is corrected.
        var created = await _consumptionService.CreateConsumptionAsync(NewConsumption(quantity: 200m));

        var before = await _consumptionService.GetAverageDailyConsumptionAsync(
            FacilityId, MedicineId, windowDays: 10);
        before.Should().Be(20m);   // 200 / 10 days

        await _consumptionService.UpdateConsumptionAsync(created.Id, NewConsumption(quantity: 20m));

        var after = await _consumptionService.GetAverageDailyConsumptionAsync(
            FacilityId, MedicineId, windowDays: 10);
        after.Should().Be(2m);     // 20 / 10 days
    }

    [Fact]
    public async Task UpdateConsumption_ReturnsNullWhenMissing()
    {
        var result = await _consumptionService.UpdateConsumptionAsync(Guid.NewGuid(), NewConsumption());

        result.Should().BeNull();
    }

    [Fact]
    public async Task DeleteConsumption_RemovesTheRecord()
    {
        var created = await _consumptionService.CreateConsumptionAsync(NewConsumption());

        (await _consumptionService.DeleteConsumptionAsync(created.Id)).Should().BeTrue();
        (await _db.ConsumptionRecords.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task GetConsumptionById_ReturnsNullWhenMissing()
    {
        (await _consumptionService.GetConsumptionByIdAsync(Guid.NewGuid())).Should().BeNull();
    }

    // -----------------------------------------------------------------------
    // Forecast delete
    // -----------------------------------------------------------------------

    [Fact]
    public async Task DeleteForecast_RemovesTheRecord()
    {
        await SeedConsumptionAsync(days: 10, quantityPerDay: 20m);
        var forecast = await _forecastService.CreateForecastAsync(new ForecastRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            LeadTimeDays = 10
        });

        (await _forecastService.DeleteForecastAsync(forecast.Id)).Should().BeTrue();
        (await _db.DemandForecasts.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task GetForecastById_ReturnsTheStoredForecast()
    {
        await SeedConsumptionAsync(days: 10, quantityPerDay: 20m);
        var created = await _forecastService.CreateForecastAsync(new ForecastRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            LeadTimeDays = 10
        });

        var fetched = await _forecastService.GetForecastByIdAsync(created.Id);

        fetched!.Id.Should().Be(created.Id);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private async Task<ShortageResponse> CreateAlertAsync() =>
        await _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

    private async Task SeedConsumptionAsync(int days, decimal quantityPerDay)
    {
        var today = DateTime.UtcNow.Date;

        for (var dayOffset = days; dayOffset >= 1; dayOffset--)
        {
            _db.ConsumptionRecords.Add(new ConsumptionRecord
            {
                Id = Guid.NewGuid(),
                FacilityId = FacilityId,
                MedicineId = MedicineId,
                QuantityUsed = quantityPerDay,
                ConsumptionDate = DateTime.SpecifyKind(today.AddDays(-dayOffset), DateTimeKind.Utc),
                Source = "TEST",
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
    }

    private static ConsumptionRequest NewConsumption(decimal quantity = 20m) => new()
    {
        FacilityId = FacilityId,
        MedicineId = MedicineId,
        QuantityUsed = quantity,
        ConsumptionDate = DateTime.UtcNow.AddDays(-1),
        Source = "TEST"
    };
}
