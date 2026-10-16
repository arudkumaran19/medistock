namespace MediStock.UnitTests;

using FluentAssertions;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

public class ShortageDismissGuardTests : IDisposable
{
    private static readonly Guid FacilityId = Guid.Parse("b1000000-0000-0000-0000-000000000002");
    private static readonly Guid MedicineId = Guid.Parse("c1000000-0000-0000-0000-000000000001");
    private static readonly Guid UserId = Guid.NewGuid();

    private readonly ApplicationDbContext _db;
    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly ShortageService _shortageService;
    private readonly ShortageEvaluationService _evaluationService;

    public ShortageDismissGuardTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"medistock-guard-{Guid.NewGuid()}")
            .Options;

        _db = new ApplicationDbContext(options);

        _consumptionService = new ConsumptionService(_db, NullLogger<ConsumptionService>.Instance);
        _forecastService = new ForecastService(_db, _consumptionService, NullLogger<ForecastService>.Instance);
        _shortageService = new ShortageService(
            _db,
            _consumptionService,
            _forecastService,
            NullLogger<ShortageService>.Instance);
        _evaluationService = new ShortageEvaluationService(
            _db,
            _consumptionService,
            _forecastService,
            _shortageService,
            NullLogger<ShortageEvaluationService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Guard_NotRecreatedOnRecompute_WhenConditionHasNotWorsened()
    {
        // 1. Create and dismiss an alert with stock = 120, consumption = 20, lead time = 10 (HIGH risk)
        var created = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        created.RiskLevel.Should().Be(ShortageRiskLevels.High);

        var dismissed = await _shortageService.DismissShortageAsync(created.Id, "False positive test", UserId);
        dismissed.Should().NotBeNull();
        dismissed!.Status.Should().Be(ShortageAlertStatuses.Dismissed);

        // 2. Recompute with the same or better condition (stock = 120m, risk = HIGH)
        var recomputed = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        // Recompute returns the existing dismissed alert rather than creating a new active alert
        recomputed.Id.Should().Be(created.Id);
        recomputed.Status.Should().Be(ShortageAlertStatuses.Dismissed);

        // Active alerts count must be 0
        var activeAlerts = await _db.ShortageAlerts
            .Where(x => x.FacilityId == FacilityId && x.MedicineId == MedicineId && ShortageAlertStatuses.Active.Contains(x.Status))
            .ToListAsync();
        activeAlerts.Should().BeEmpty();
    }

    [Fact]
    public async Task Guard_NotRecreatedOnScan_WhenConditionHasNotWorsened()
    {
        // 1. Seed reorder rule and inventory balance
        _db.ReorderRules.Add(new ReorderRule
        {
            Id = Guid.NewGuid(),
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            LeadTimeDays = 10,
            MinimumStock = 150m,
            ReorderPoint = 200m,
            SafetyStock = 50m,
            CreatedAt = DateTime.UtcNow
        });
        _db.InventoryBalances.Add(new InventoryBalance
        {
            Id = Guid.NewGuid(),
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            QuantityOnHand = 120,
            QuantityReserved = 0
        });
        // 30 days of consumption at 20 units/day
        for (var day = 1; day <= 30; day++)
        {
            _db.ConsumptionRecords.Add(new ConsumptionRecord
            {
                Id = Guid.NewGuid(),
                FacilityId = FacilityId,
                MedicineId = MedicineId,
                ConsumptionDate = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-day), DateTimeKind.Utc),
                QuantityUsed = 20m,
                Source = "SEED",
                CreatedAt = DateTime.UtcNow
            });
        }
        await _db.SaveChangesAsync();

        // 2. Initial evaluation creates alert
        var initialEval = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);
        initialEval.Outcome.Should().Be(ShortageEvaluationOutcomes.Created);
        initialEval.Alert.Should().NotBeNull();

        // 3. Dismiss the alert
        await _shortageService.DismissShortageAsync(initialEval.Alert!.Id, "False positive", UserId);

        // 4. Scan / Evaluate again: must be suppressed (outcome = Skipped)
        var secondEval = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);
        secondEval.Outcome.Should().Be(ShortageEvaluationOutcomes.Skipped);

        // Active alerts remain empty
        var activeAlerts = await _db.ShortageAlerts
            .Where(x => x.FacilityId == FacilityId && x.MedicineId == MedicineId && ShortageAlertStatuses.Active.Contains(x.Status))
            .ToListAsync();
        activeAlerts.Should().BeEmpty();
    }

    [Fact]
    public async Task Guard_RecreatedWhenStockWorsens()
    {
        // 1. Create and dismiss alert at stock = 120m
        var created = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        await _shortageService.DismissShortageAsync(created.Id, "False positive test", UserId);

        // 2. Stock worsens: drops from 120 to 80 (< 120)
        var recomputed = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 80m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        // A new alert is raised because condition worsened
        recomputed.Id.Should().NotBe(created.Id);
        recomputed.Status.Should().Be(ShortageAlertStatuses.Open);
        recomputed.CurrentStock.Should().Be(80m);

        var activeAlerts = await _db.ShortageAlerts
            .Where(x => x.FacilityId == FacilityId && x.MedicineId == MedicineId && ShortageAlertStatuses.Active.Contains(x.Status))
            .ToListAsync();
        activeAlerts.Should().HaveCount(1);
        activeAlerts[0].Id.Should().Be(recomputed.Id);
    }

    [Fact]
    public async Task Guard_RecreatedWhenRiskWorsens()
    {
        // 1. Create an alert that is MEDIUM risk (e.g. daysRemaining >= leadTime, or created via CreateShortageAsync)
        // With stock = 120, consumption = 10, lead time = 10 -> daysRemaining = 12 >= 10 -> MEDIUM risk
        var mediumAlert = await _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 10m,
            LeadTimeDays = 10
        });
        mediumAlert.RiskLevel.Should().Be(ShortageRiskLevels.Medium);

        // Dismiss the MEDIUM risk alert
        await _shortageService.DismissShortageAsync(mediumAlert.Id, "Dismissed when medium risk", UserId);

        // 2. Recompute where stock is same (120m) but consumption is higher (20m), causing risk to become HIGH (120/20 = 6 < 10)
        var highRiskRecompute = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        // Risk worsened from MEDIUM to HIGH -> alert re-created!
        highRiskRecompute.Id.Should().NotBe(mediumAlert.Id);
        highRiskRecompute.RiskLevel.Should().Be(ShortageRiskLevels.High);
        highRiskRecompute.Status.Should().Be(ShortageAlertStatuses.Open);

        var activeAlerts = await _db.ShortageAlerts
            .Where(x => x.FacilityId == FacilityId && x.MedicineId == MedicineId && ShortageAlertStatuses.Active.Contains(x.Status))
            .ToListAsync();
        activeAlerts.Should().HaveCount(1);
    }

    [Fact]
    public async Task Guard_RecreatedWhenSuppressionWindowExpires()
    {
        // 1. Create and dismiss alert with DismissedAt set to 2 days ago
        var created = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        await _shortageService.DismissShortageAsync(created.Id, "Old dismissal", UserId);

        var alertEntity = await _db.ShortageAlerts.FirstAsync(x => x.Id == created.Id);
        alertEntity.DismissedAt = DateTime.UtcNow.AddDays(-2);
        await _db.SaveChangesAsync();

        // 2. Set MaximumSuppressionWindow to 24 hours
        _shortageService.MaximumSuppressionWindow = TimeSpan.FromHours(24);

        // 3. Recompute with same stock
        var recomputed = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        // Window expired -> new alert created!
        recomputed.Id.Should().NotBe(created.Id);
        recomputed.Status.Should().Be(ShortageAlertStatuses.Open);
    }
}
