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
/// Service tests for the Demand &amp; Shortage vertical, exercised against a real
/// DbContext. Sathurstiga S. (IT24103156).
///
/// The final test walks the whole required demonstration chain:
/// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
/// </summary>
public class DemandServiceTests : IDisposable
{
    private static readonly Guid FacilityId = Guid.Parse("b1000000-0000-0000-0000-000000000002");
    private static readonly Guid MedicineId = Guid.Parse("c1000000-0000-0000-0000-000000000001");
    private static readonly Guid OtherMedicineId = Guid.Parse("c1000000-0000-0000-0000-000000000002");

    private readonly ApplicationDbContext _db;
    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly ShortageService _shortageService;

    public DemandServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"medistock-demand-{Guid.NewGuid()}")
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
    // Consumption
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CreateConsumptionAsync_PersistsTheRecord()
    {
        var response = await _consumptionService.CreateConsumptionAsync(new ConsumptionRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            QuantityUsed = 25m,
            ConsumptionDate = DateTime.UtcNow.AddDays(-1),
            Source = "FLUTTER_CONSUMPTION_ENTRY",
            Notes = "Ward round"
        });

        response.Id.Should().NotBeEmpty();
        response.QuantityUsed.Should().Be(25m);

        var stored = await _db.ConsumptionRecords.SingleAsync();
        stored.FacilityId.Should().Be(FacilityId);
        stored.ConsumptionDate.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public async Task GetConsumptionAsync_FiltersByFacilityAndMedicine()
    {
        await SeedConsumptionAsync(MedicineId, days: 3, quantityPerDay: 10m);
        await SeedConsumptionAsync(OtherMedicineId, days: 3, quantityPerDay: 99m);

        var result = await _consumptionService.GetConsumptionAsync(new ConsumptionQuery
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId
        });

        result.Total.Should().Be(3);
        result.Items.Should().OnlyContain(x => x.MedicineId == MedicineId);
    }

    [Fact]
    public async Task GetConsumptionAsync_AppliesPagination()
    {
        await SeedConsumptionAsync(MedicineId, days: 25, quantityPerDay: 10m);

        var page2 = await _consumptionService.GetConsumptionAsync(new ConsumptionQuery
        {
            FacilityId = FacilityId,
            Page = 2,
            PageSize = 10
        });

        page2.Total.Should().Be(25);
        page2.Items.Should().HaveCount(10);
        page2.Page.Should().Be(2);

        // develop's PagedResponse is a plain record (Items, Total, Page, PageSize) with
        // no derived paging flags, so the same guarantees are asserted from its fields.
        var totalPages = (int)Math.Ceiling(page2.Total / (double)page2.PageSize);
        totalPages.Should().Be(3);
        (page2.Page < totalPages).Should().BeTrue("there is a next page");
        (page2.Page > 1).Should().BeTrue("there is a previous page");
    }

    [Fact]
    public async Task GetConsumptionAsync_ClampsAnOversizedPageSize()
    {
        await SeedConsumptionAsync(MedicineId, days: 5, quantityPerDay: 10m);

        var result = await _consumptionService.GetConsumptionAsync(new ConsumptionQuery
        {
            FacilityId = FacilityId,
            PageSize = 5000
        });

        result.PageSize.Should().Be(100);
    }

    [Fact]
    public async Task GetConsumptionAsync_SearchesSourceAndNotes()
    {
        await _consumptionService.CreateConsumptionAsync(NewConsumption(source: "WARD_A", notes: "morning"));
        await _consumptionService.CreateConsumptionAsync(NewConsumption(source: "WARD_B", notes: "evening"));

        var result = await _consumptionService.GetConsumptionAsync(new ConsumptionQuery
        {
            FacilityId = FacilityId,
            Search = "ward_a"
        });

        result.Total.Should().Be(1);
        result.Items[0].Source.Should().Be("WARD_A");
    }

    [Fact]
    public async Task GetConsumptionAsync_SortsByQuantityAscending()
    {
        await _consumptionService.CreateConsumptionAsync(NewConsumption(quantity: 30m));
        await _consumptionService.CreateConsumptionAsync(NewConsumption(quantity: 10m));
        await _consumptionService.CreateConsumptionAsync(NewConsumption(quantity: 20m));

        var result = await _consumptionService.GetConsumptionAsync(new ConsumptionQuery
        {
            FacilityId = FacilityId,
            SortBy = "quantityUsed",
            SortOrder = "asc"
        });

        result.Items.Select(x => x.QuantityUsed).Should().ContainInOrder(10m, 20m, 30m);
    }

    [Fact]
    public async Task GetConsumptionAsync_DefaultsToNewestFirst()
    {
        await SeedConsumptionAsync(MedicineId, days: 3, quantityPerDay: 10m);

        var result = await _consumptionService.GetConsumptionAsync(new ConsumptionQuery
        {
            FacilityId = FacilityId
        });

        result.Items.Should().BeInDescendingOrder(x => x.ConsumptionDate);
    }

    [Fact]
    public async Task GetAverageDailyConsumptionAsync_ReproducesTheBlueprintRate()
    {
        // 30 days at 20 units a day is the seeded demonstration dataset.
        await SeedConsumptionAsync(MedicineId, days: 30, quantityPerDay: 20m);

        var average = await _consumptionService.GetAverageDailyConsumptionAsync(
            FacilityId,
            MedicineId,
            windowDays: 30);

        average.Should().Be(20m);
    }

    // -----------------------------------------------------------------------
    // Forecast
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CreateForecastAsync_PersistsADeterministicForecast()
    {
        await SeedConsumptionAsync(MedicineId, days: 30, quantityPerDay: 20m);
        await SeedReorderRuleAsync(leadTimeDays: 10);

        var forecast = await _forecastService.CreateForecastAsync(new ForecastRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            WindowDays = 30,
            HorizonDays = 30,
            Method = ForecastMethods.MovingAverage
        });

        forecast.AverageDailyConsumption.Should().Be(20m);
        forecast.PredictedDemand.Should().Be(600m);
        forecast.ConfidenceScore.Should().Be(1m);
        // Lead time was not supplied, so it comes from the facility's reorder rule.
        forecast.LeadTimeDays.Should().Be(10);

        (await _db.DemandForecasts.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task CreateForecastAsync_UsesTheSuppliedLeadTimeOverTheReorderRule()
    {
        await SeedConsumptionAsync(MedicineId, days: 30, quantityPerDay: 20m);
        await SeedReorderRuleAsync(leadTimeDays: 10);

        var forecast = await _forecastService.CreateForecastAsync(new ForecastRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            LeadTimeDays = 21
        });

        forecast.LeadTimeDays.Should().Be(21);
    }

    [Fact]
    public async Task CreateForecastAsync_WithNoHistory_ForecastsZero()
    {
        var forecast = await _forecastService.CreateForecastAsync(new ForecastRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId
        });

        forecast.AverageDailyConsumption.Should().Be(0m);
        forecast.PredictedDemand.Should().Be(0m);
    }

    [Fact]
    public async Task GetForecastsAsync_FiltersByMethod()
    {
        await SeedConsumptionAsync(MedicineId, days: 10, quantityPerDay: 20m);

        await _forecastService.CreateForecastAsync(NewForecastRequest(ForecastMethods.MovingAverage));
        await _forecastService.CreateForecastAsync(NewForecastRequest(ForecastMethods.SimpleTrend));

        var result = await _forecastService.GetForecastsAsync(new ForecastQuery
        {
            FacilityId = FacilityId,
            Method = ForecastMethods.SimpleTrend
        });

        result.Total.Should().Be(1);
        result.Items[0].Method.Should().Be(ForecastMethods.SimpleTrend);
    }

    [Fact]
    public async Task GetLeadTimeDaysAsync_WithoutAReorderRule_ReturnsZero()
    {
        // No configured threshold means no lead time to compare against. The caller
        // must supply one for the shortage rule to be meaningful.
        var leadTime = await _forecastService.GetLeadTimeDaysAsync(FacilityId, MedicineId);

        leadTime.Should().Be(0);
    }

    // -----------------------------------------------------------------------
    // Shortage
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RecalculateShortageAsync_WithSuppliedRate_PersistsTheAlert()
    {
        var alert = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
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

        // An explicit rate was supplied, so no forecast was generated.
        alert.DemandForecastId.Should().BeNull();
        (await _db.ShortageAlerts.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task GetShortagesAsync_FiltersByRiskLevel()
    {
        await _shortageService.RecalculateShortageAsync(NewRecalculate(currentStock: 120m));   // HIGH
        await _shortageService.RecalculateShortageAsync(NewRecalculate(currentStock: 4000m));  // MEDIUM

        var highRisk = await _shortageService.GetShortagesAsync(new ShortageQuery
        {
            FacilityId = FacilityId,
            RiskLevel = ShortageRiskLevels.High
        });

        highRisk.Total.Should().Be(1);
        highRisk.Items[0].RequiresTransfer.Should().BeTrue();
    }

    [Fact]
    public async Task GetShortagesAsync_FiltersByRequiresTransfer()
    {
        await _shortageService.RecalculateShortageAsync(NewRecalculate(currentStock: 120m));
        await _shortageService.RecalculateShortageAsync(NewRecalculate(currentStock: 4000m));

        var result = await _shortageService.GetShortagesAsync(new ShortageQuery
        {
            FacilityId = FacilityId,
            RequiresTransfer = false
        });

        result.Total.Should().Be(1);
        result.Items[0].RiskLevel.Should().Be(ShortageRiskLevels.Medium);
    }

    [Fact]
    public async Task GetShortageByIdAsync_ReturnsTheStoredAlert()
    {
        var created = await _shortageService.RecalculateShortageAsync(NewRecalculate(currentStock: 120m));

        var fetched = await _shortageService.GetShortageByIdAsync(created.Id);

        fetched.Should().NotBeNull();
        fetched!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task GetShortageByIdAsync_ReturnsNullWhenMissing()
    {
        (await _shortageService.GetShortageByIdAsync(Guid.NewGuid())).Should().BeNull();
    }

    // -----------------------------------------------------------------------
    // The required individual demonstration, end to end
    // -----------------------------------------------------------------------

    /// <summary>
    /// Golden case for the Demand vertical:
    ///
    ///   consumption data -&gt; forecast -&gt; projected stockout -&gt; shortage alert
    ///
    /// Thirty days of consumption at 20 units a day are recorded. With 120 units on
    /// hand and a 10 day lead time, the derived forecast gives 6 days of cover, and
    /// 6 &lt; 10 raises a shortage alert traceable back to that forecast.
    /// </summary>
    [Fact]
    public async Task DemandChain_FromConsumptionToShortageAlert()
    {
        // 1. Consumption data.
        await SeedConsumptionAsync(MedicineId, days: 30, quantityPerDay: 20m);
        await SeedReorderRuleAsync(leadTimeDays: 10);

        // 2 and 3. Forecast and projected stockout, derived rather than supplied.
        var alert = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            WindowDays = 30
            // AverageDailyConsumption and LeadTimeDays deliberately omitted.
        });

        // 4. Shortage alert.
        alert.AverageDailyConsumption.Should().Be(20m);
        alert.LeadTimeDays.Should().Be(10);
        alert.DaysRemaining.Should().Be(6);
        alert.ProjectedStockoutDate.Should().Be(DateTime.UtcNow.Date.AddDays(6));
        alert.RiskLevel.Should().Be(ShortageRiskLevels.High);
        alert.RequiresTransfer.Should().BeTrue();

        // The alert is traceable back to the forecast it was derived from.
        alert.DemandForecastId.Should().NotBeNull();

        var forecast = await _db.DemandForecasts.SingleAsync();
        forecast.Id.Should().Be(alert.DemandForecastId!.Value);
        forecast.AverageDailyConsumption.Should().Be(20m);

        // Both stages are persisted, so the chain is auditable after the fact.
        (await _db.ConsumptionRecords.CountAsync()).Should().Be(30);
        (await _db.ShortageAlerts.CountAsync()).Should().Be(1);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private async Task SeedConsumptionAsync(Guid medicineId, int days, decimal quantityPerDay)
    {
        var today = DateTime.UtcNow.Date;

        for (var dayOffset = days; dayOffset >= 1; dayOffset--)
        {
            _db.ConsumptionRecords.Add(new ConsumptionRecord
            {
                Id = Guid.NewGuid(),
                FacilityId = FacilityId,
                MedicineId = medicineId,
                QuantityUsed = quantityPerDay,
                ConsumptionDate = DateTime.SpecifyKind(today.AddDays(-dayOffset), DateTimeKind.Utc),
                Source = "TEST",
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
    }

    private async Task SeedReorderRuleAsync(int leadTimeDays)
    {
        _db.ReorderRules.Add(new ReorderRule
        {
            Id = Guid.NewGuid(),
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            MinimumStock = 150m,
            ReorderPoint = 300m,
            SafetyStock = 60m,
            LeadTimeDays = leadTimeDays,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
    }

    private static ConsumptionRequest NewConsumption(
        decimal quantity = 10m,
        string source = "TEST",
        string? notes = null) => new()
    {
        FacilityId = FacilityId,
        MedicineId = MedicineId,
        QuantityUsed = quantity,
        ConsumptionDate = DateTime.UtcNow.AddDays(-1),
        Source = source,
        Notes = notes
    };

    private static ForecastRequest NewForecastRequest(string method) => new()
    {
        FacilityId = FacilityId,
        MedicineId = MedicineId,
        WindowDays = 10,
        HorizonDays = 10,
        Method = method,
        LeadTimeDays = 10
    };

    private static ShortageRecalculateRequest NewRecalculate(decimal currentStock) => new()
    {
        FacilityId = FacilityId,
        MedicineId = MedicineId,
        CurrentStock = currentStock,
        AverageDailyConsumption = 20m,
        LeadTimeDays = 10
    };
}
