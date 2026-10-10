using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;
namespace MediStock.UnitTests;

using FluentAssertions;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

/// <summary>
/// Automatic shortage detection for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// Covers the four behaviours added on top of the existing CRUD:
///   1. current stock read from the Inventory balance (on hand - reserved)
///   2. automatic evaluation and the scan
///   3. one active alert per facility and medicine (no duplicates)
///   4. auto-resolve when stock covers the lead time
/// plus the idempotent reorder-rule seed for develop's real facilities.
/// </summary>
public class ShortageAutomationTests : IDisposable
{
    private static readonly Guid FacilityId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid MedicineId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherMedicineId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    private readonly ApplicationDbContext _db;
    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly ShortageService _shortageService;
    private readonly ShortageEvaluationService _evaluationService;

    public ShortageAutomationTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"medistock-automation-{Guid.NewGuid()}")
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

    // -----------------------------------------------------------------------
    // 1. Current stock from Inventory
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentStock_IsOnHandMinusReserved()
    {
        await SeedBalanceAsync(onHand: 150, reserved: 30);

        var stock = await _shortageService.GetCurrentStockAsync(FacilityId, MedicineId);

        stock!.QuantityOnHand.Should().Be(150m);
        stock.QuantityReserved.Should().Be(30m);
        stock.AvailableQuantity.Should().Be(120m);
    }

    [Fact]
    public async Task GetCurrentStock_NeverReportsNegativeAvailability()
    {
        await SeedBalanceAsync(onHand: 10, reserved: 25);

        var stock = await _shortageService.GetCurrentStockAsync(FacilityId, MedicineId);

        stock!.AvailableQuantity.Should().Be(0m);
    }

    [Fact]
    public async Task GetCurrentStock_IsNullWhenInventoryHasNoBalance()
    {
        (await _shortageService.GetCurrentStockAsync(FacilityId, MedicineId)).Should().BeNull();
    }

    [Fact]
    public async Task CreateShortage_ReadsStockFromInventoryWhenNoneIsSupplied()
    {
        await SeedBalanceAsync(onHand: 150, reserved: 30);

        var alert = await _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        // 120 available at 20/day = 6 days < 10: the blueprint worked example.
        alert.CurrentStock.Should().Be(120m);
        alert.DaysRemaining.Should().Be(6);
        alert.RiskLevel.Should().Be(ShortageRiskLevels.High);
    }

    [Fact]
    public async Task CreateShortage_PrefersASuppliedStockFigure()
    {
        await SeedBalanceAsync(onHand: 150, reserved: 30);

        var alert = await _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = 60m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        alert.CurrentStock.Should().Be(60m);
        alert.DaysRemaining.Should().Be(3);
    }

    [Fact]
    public async Task CreateShortage_ReportsMissingStockRatherThanAssumingZero()
    {
        var act = () => _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        await act.Should().ThrowAsync<ShortageStockNotFoundException>();
        (await _db.ShortageAlerts.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Recalculate_ReadsStockFromInventoryWhenNoneIsSupplied()
    {
        await SeedBalanceAsync(onHand: 120, reserved: 0);

        var alert = await _shortageService.RecalculateShortageAsync(new ShortageRecalculateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        alert.CurrentStock.Should().Be(120m);
        alert.DaysRemaining.Should().Be(6);
    }

    // -----------------------------------------------------------------------
    // 3. No duplicates
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CreateShortage_Again_UpdatesTheExistingAlertInsteadOfDuplicating()
    {
        var first = await RaiseAsync(stock: 120m);
        first.ExistingAlertUpdated.Should().BeFalse();

        var second = await RaiseAsync(stock: 60m);

        second.Id.Should().Be(first.Id);
        second.ExistingAlertUpdated.Should().BeTrue();
        second.CurrentStock.Should().Be(60m);
        second.DaysRemaining.Should().Be(3);
        second.UpdatedAt.Should().NotBeNull();
        (await _db.ShortageAlerts.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task CreateShortage_Again_KeepsAnAcknowledgedStatus()
    {
        var first = await RaiseAsync(stock: 120m);
        await _shortageService.UpdateShortageAsync(
            first.Id,
            new ShortageUpdateRequest { Status = ShortageAlertStatuses.Acknowledged });

        var second = await RaiseAsync(stock: 100m);

        second.Id.Should().Be(first.Id);
        second.Status.Should().Be(ShortageAlertStatuses.Acknowledged);
    }

    [Fact]
    public async Task CreateShortage_AfterTheAlertWasResolved_RaisesANewOne()
    {
        var first = await RaiseAsync(stock: 120m);
        await _shortageService.ResolveShortageAsync(first.Id);

        var second = await RaiseAsync(stock: 120m);

        second.Id.Should().NotBe(first.Id);
        second.ExistingAlertUpdated.Should().BeFalse();
        (await _db.ShortageAlerts.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task CreateShortage_ForAnotherMedicine_IsAnotherAlert()
    {
        await RaiseAsync(stock: 120m);

        var other = await _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = OtherMedicineId,
            CurrentStock = 120m,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

        other.ExistingAlertUpdated.Should().BeFalse();
        (await _db.ShortageAlerts.CountAsync()).Should().Be(2);
    }

    // -----------------------------------------------------------------------
    // Manual resolve and re-open keep the new timestamps consistent
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ManualResolve_RecordsWhenButNoAutomaticReason()
    {
        var alert = await RaiseAsync(stock: 120m);

        var resolved = await _shortageService.ResolveShortageAsync(alert.Id);

        resolved!.ResolvedAt.Should().NotBeNull();
        resolved.ResolutionReason.Should().BeNull();
    }

    [Fact]
    public async Task ReopeningAResolvedAlert_ClearsTheResolution()
    {
        var alert = await RaiseAsync(stock: 120m);
        await _shortageService.ResolveShortageAsync(alert.Id);

        var reopened = await _shortageService.UpdateShortageAsync(
            alert.Id,
            new ShortageUpdateRequest { Status = ShortageAlertStatuses.Open });

        reopened!.Status.Should().Be(ShortageAlertStatuses.Open);
        reopened.ResolvedAt.Should().BeNull();
        reopened.ResolutionReason.Should().BeNull();
    }

    // -----------------------------------------------------------------------
    // 2 and 4. Automatic evaluation and auto-resolve
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Evaluate_RaisesAnAlertWhenCoverIsShorterThanLeadTime()
    {
        await SeedScenarioAsync(onHand: 120, leadTimeDays: 10);

        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Created);
        result.Alert!.CurrentStock.Should().Be(120m);
        result.Alert.AverageDailyConsumption.Should().Be(20m);
        result.Alert.DaysRemaining.Should().Be(6);
        result.Alert.Status.Should().Be(ShortageAlertStatuses.Open);
    }

    [Fact]
    public async Task Evaluate_Again_UpdatesTheSameAlert()
    {
        await SeedScenarioAsync(onHand: 120, leadTimeDays: 10);
        var first = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        await SetOnHandAsync(80);
        var second = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        second.Outcome.Should().Be(ShortageEvaluationOutcomes.Updated);
        second.Alert!.Id.Should().Be(first.Alert!.Id);
        second.Alert.CurrentStock.Should().Be(80m);
        (await _db.ShortageAlerts.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Evaluate_AutoResolvesWhenStockNowCoversLeadTime()
    {
        await SeedScenarioAsync(onHand: 120, leadTimeDays: 10);
        var raised = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        // Stock received: 400 / 20 = 20 days, which covers the 10 day lead time.
        await SetOnHandAsync(400);
        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Resolved);
        result.Reason.Should().Be("Stock now covers lead time");

        var stored = await _db.ShortageAlerts.AsNoTracking().SingleAsync(x => x.Id == raised.Alert!.Id);
        stored.Status.Should().Be(ShortageAlertStatuses.Resolved);
        stored.ResolutionReason.Should().Be(ShortageAlertStatuses.StockCoversLeadTimeReason);
        stored.ResolvedAt.Should().NotBeNull();
        stored.CurrentStock.Should().Be(400m);
        stored.RequiresTransfer.Should().BeFalse();
    }

    [Fact]
    public async Task Evaluate_AlsoResolvesAnAcknowledgedAlert()
    {
        await SeedScenarioAsync(onHand: 120, leadTimeDays: 10);
        var raised = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);
        await _shortageService.UpdateShortageAsync(
            raised.Alert!.Id,
            new ShortageUpdateRequest { Status = ShortageAlertStatuses.Acknowledged });

        await SetOnHandAsync(400);
        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Resolved);
    }

    [Fact]
    public async Task Evaluate_DoesNothingWhenThereIsNoRiskAndNoAlert()
    {
        await SeedScenarioAsync(onHand: 400, leadTimeDays: 10);

        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.NoChange);
        (await _db.ShortageAlerts.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Evaluate_SkipsWithoutAReorderRule()
    {
        await SeedBalanceAsync(onHand: 120, reserved: 0);
        await SeedConsumptionAsync(days: 30, quantityPerDay: 20m);

        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Skipped);
        result.Reason.Should().Be(ShortageEvaluationService.NoReorderRuleReason);
        (await _db.ShortageAlerts.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Evaluate_SkipsWithoutAnInventoryBalanceRatherThanAssumingZero()
    {
        await SeedRuleAsync(leadTimeDays: 10);
        await SeedConsumptionAsync(days: 30, quantityPerDay: 20m);

        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Skipped);
        result.Reason.Should().Be(ShortageEvaluationService.NoInventoryBalanceReason);
        (await _db.ShortageAlerts.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Evaluate_UsesStockNetOfReservations()
    {
        // 300 on hand would be 15 days; with 180 reserved only 120 is usable: 6 days.
        await SeedScenarioAsync(onHand: 300, leadTimeDays: 10, reserved: 180);

        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Created);
        result.Alert!.CurrentStock.Should().Be(120m);
    }

    [Fact]
    public async Task TryEvaluate_NeverThrows()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"medistock-broken-{Guid.NewGuid()}")
            .Options;
        var broken = new ApplicationDbContext(options);
        var consumption = new ConsumptionService(broken, NullLogger<ConsumptionService>.Instance);
        var forecast = new ForecastService(broken, consumption, NullLogger<ForecastService>.Instance);
        var shortage = new ShortageService(broken, consumption, forecast, NullLogger<ShortageService>.Instance);
        var evaluation = new ShortageEvaluationService(
            broken,
            consumption,
            forecast,
            shortage,
            NullLogger<ShortageEvaluationService>.Instance);

        // A disposed context makes every query throw.
        broken.Dispose();

        var result = await evaluation.TryEvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Failed);
        result.Reason.Should().NotBeNullOrWhiteSpace();
    }

    // -----------------------------------------------------------------------
    // Default rule for medicines without a configured one
    // -----------------------------------------------------------------------

    [Fact]
    public async Task EffectiveRule_IsTheConfiguredRuleWhenOneExists()
    {
        await SeedFacilityAndMedicineAsync(minimumStockLevel: 40);
        await SeedRuleAsync(leadTimeDays: 12);

        var effective = await _forecastService.GetEffectiveReorderRuleAsync(FacilityId, MedicineId);

        effective!.IsDefault.Should().BeFalse();
        effective.Source.Should().Be(EffectiveReorderRule.SourceConfigured);
        effective.Rule.LeadTimeDays.Should().Be(12);
    }

    [Fact]
    public async Task EffectiveRule_FallsBackToTheDefaultForAKnownMedicine()
    {
        await SeedFacilityAndMedicineAsync(minimumStockLevel: 40);

        var effective = await _forecastService.GetEffectiveReorderRuleAsync(FacilityId, MedicineId);

        effective!.IsDefault.Should().BeTrue();
        effective.Source.Should().Be(EffectiveReorderRule.SourceDefault);
        effective.Rule.LeadTimeDays.Should().Be(ReorderRuleDefaults.LeadTimeDays);
        effective.Rule.MinimumStock.Should().Be(40m);
        effective.Rule.ReorderPoint.Should().Be(80m);
        effective.Rule.SafetyStock.Should().Be(20m);
        // The default is computed, never stored.
        (await _db.ReorderRules.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task EffectiveRule_UsesTheDefaultMinimumWhenTheMedicineHasNone()
    {
        await SeedFacilityAndMedicineAsync(minimumStockLevel: 0);

        var effective = await _forecastService.GetEffectiveReorderRuleAsync(FacilityId, MedicineId);

        effective!.Rule.MinimumStock.Should().Be(ReorderRuleDefaults.MinimumStock);
    }

    [Fact]
    public async Task EffectiveRule_IsNullForAnUnknownMedicineOrFacility()
    {
        (await _forecastService.GetEffectiveReorderRuleAsync(FacilityId, MedicineId)).Should().BeNull();
        (await _forecastService.GetLeadTimeDaysAsync(FacilityId, MedicineId)).Should().Be(0);
    }

    [Fact]
    public async Task LeadTime_UsesTheDefaultForAKnownMedicineWithoutARule()
    {
        await SeedFacilityAndMedicineAsync(minimumStockLevel: 40);

        (await _forecastService.GetLeadTimeDaysAsync(FacilityId, MedicineId))
            .Should().Be(ReorderRuleDefaults.LeadTimeDays);
    }

    [Fact]
    public async Task Evaluate_UsesTheDefaultRuleForAMedicineWithoutOne()
    {
        // A medicine added through Inventory with no reorder rule: 120 / 20 = 6 days
        // against the default 7 day lead time is a shortage.
        await SeedFacilityAndMedicineAsync(minimumStockLevel: 40);
        await SeedBalanceAsync(onHand: 120, reserved: 0);
        await SeedConsumptionAsync(days: 30, quantityPerDay: 20m);

        var result = await _evaluationService.EvaluateAsync(FacilityId, MedicineId);

        result.Outcome.Should().Be(ShortageEvaluationOutcomes.Created);
        result.Alert!.LeadTimeDays.Should().Be(ReorderRuleDefaults.LeadTimeDays);
    }

    [Fact]
    public async Task Scan_IncludesMedicinesThatOnlyHaveTheDefaultRule()
    {
        await SeedFacilityAndMedicineAsync(minimumStockLevel: 40);
        await SeedBalanceAsync(onHand: 120, reserved: 0);
        await SeedConsumptionAsync(days: 30, quantityPerDay: 20m);

        var scan = await _evaluationService.ScanAsync();

        scan.Evaluated.Should().Be(1);
        scan.Created.Should().Be(1);
    }

    [Fact]
    public async Task Scan_EvaluatesOnlyPairsWithConsumptionHistory()
    {
        // At risk: history, rule and balance.
        await SeedScenarioAsync(onHand: 120, leadTimeDays: 10);

        // A rule but no consumption history: not part of the scan.
        _db.ReorderRules.Add(NewRule(OtherMedicineId, leadTimeDays: 10));
        await _db.SaveChangesAsync();

        var scan = await _evaluationService.ScanAsync();

        scan.Evaluated.Should().Be(1);
        scan.Created.Should().Be(1);
        scan.Results.Single().MedicineId.Should().Be(MedicineId);
    }

    [Fact]
    public async Task Scan_ResolvesAfterStockIsReceived()
    {
        await SeedScenarioAsync(onHand: 120, leadTimeDays: 10);
        (await _evaluationService.ScanAsync()).Created.Should().Be(1);

        await SetOnHandAsync(400);
        var scan = await _evaluationService.ScanAsync();

        scan.Resolved.Should().Be(1);
        (await _db.ShortageAlerts.SingleAsync()).Status.Should().Be(ShortageAlertStatuses.Resolved);
    }

    [Fact]
    public async Task Scan_CountsASkippedPair()
    {
        // History and a rule, but Inventory has no balance.
        await SeedRuleAsync(leadTimeDays: 10);
        await SeedConsumptionAsync(days: 30, quantityPerDay: 20m);

        var scan = await _evaluationService.ScanAsync();

        scan.Evaluated.Should().Be(1);
        scan.Skipped.Should().Be(1);
    }

    // -----------------------------------------------------------------------
    // 5. Reorder rules for develop's real facilities
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RealFacilitySeed_CreatesARuleForEveryRealFacilityAndMedicine()
    {
        await SeedRealReferenceDataAsync();

        await DemandSeedData.SeedRealFacilityReorderRulesAsync(_db);
        await _db.SaveChangesAsync();

        var rules = await _db.ReorderRules.ToListAsync();
        rules.Should().HaveCount(
            DemandSeedData.RealFacilityIds.Length * DemandSeedData.RealMedicineIds.Length);
        rules.Should().OnlyContain(x => x.LeadTimeDays == DemandSeedData.DefaultLeadTimeDays);

        // Minimum comes from the medicine's own MinimumStockLevel (Paracetamol: 100).
        var paracetamol = rules.First(x => x.MedicineId == SeedData.ParacetamolId);
        paracetamol.MinimumStock.Should().Be(100m);
        paracetamol.ReorderPoint.Should().Be(200m);
        paracetamol.SafetyStock.Should().Be(50m);
    }

    [Fact]
    public async Task RealFacilitySeed_IsIdempotent()
    {
        await SeedRealReferenceDataAsync();

        await DemandSeedData.SeedRealFacilityReorderRulesAsync(_db);
        await _db.SaveChangesAsync();
        await DemandSeedData.SeedRealFacilityReorderRulesAsync(_db);
        await _db.SaveChangesAsync();

        (await _db.ReorderRules.CountAsync()).Should().Be(
            DemandSeedData.RealFacilityIds.Length * DemandSeedData.RealMedicineIds.Length);
    }

    [Fact]
    public async Task RealFacilitySeed_NeverOverwritesAnExistingRule()
    {
        await SeedRealReferenceDataAsync();
        _db.ReorderRules.Add(new ReorderRule
        {
            Id = Guid.NewGuid(),
            FacilityId = SeedData.CentralFacilityId,
            MedicineId = SeedData.ParacetamolId,
            MinimumStock = 999m,
            ReorderPoint = 999m,
            SafetyStock = 999m,
            LeadTimeDays = 21
        });
        await _db.SaveChangesAsync();

        await DemandSeedData.SeedRealFacilityReorderRulesAsync(_db);
        await _db.SaveChangesAsync();

        var kept = await _db.ReorderRules.SingleAsync(x =>
            x.FacilityId == SeedData.CentralFacilityId && x.MedicineId == SeedData.ParacetamolId);
        kept.LeadTimeDays.Should().Be(21);
        kept.MinimumStock.Should().Be(999m);
    }

    [Fact]
    public async Task RealFacilitySeed_SkipsReferenceDataThatIsNotInTheDatabase()
    {
        // No facilities or medicines at all: nothing to attach a rule to.
        await DemandSeedData.SeedRealFacilityReorderRulesAsync(_db);
        await _db.SaveChangesAsync();

        (await _db.ReorderRules.CountAsync()).Should().Be(0);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private Task<ShortageResponse> RaiseAsync(decimal stock) =>
        _shortageService.CreateShortageAsync(new ShortageCreateRequest
        {
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            CurrentStock = stock,
            AverageDailyConsumption = 20m,
            LeadTimeDays = 10
        });

    private async Task SeedScenarioAsync(int onHand, int leadTimeDays, int reserved = 0)
    {
        await SeedBalanceAsync(onHand, reserved);
        await SeedRuleAsync(leadTimeDays);
        await SeedConsumptionAsync(days: 30, quantityPerDay: 20m);
    }

    private async Task SeedBalanceAsync(int onHand, int reserved)
    {
        _db.InventoryBalances.Add(new InventoryBalance
        {
            Id = Guid.NewGuid(),
            FacilityId = FacilityId,
            MedicineId = MedicineId,
            QuantityOnHand = onHand,
            QuantityReserved = reserved
        });

        await _db.SaveChangesAsync();
    }

    private async Task SetOnHandAsync(int onHand)
    {
        var balance = await _db.InventoryBalances.SingleAsync(x =>
            x.FacilityId == FacilityId && x.MedicineId == MedicineId);
        balance.QuantityOnHand = onHand;

        await _db.SaveChangesAsync();
    }

    private async Task SeedRuleAsync(int leadTimeDays)
    {
        _db.ReorderRules.Add(NewRule(MedicineId, leadTimeDays));
        await _db.SaveChangesAsync();
    }

    private static ReorderRule NewRule(Guid medicineId, int leadTimeDays) => new()
    {
        Id = Guid.NewGuid(),
        FacilityId = FacilityId,
        MedicineId = medicineId,
        MinimumStock = 100m,
        ReorderPoint = 200m,
        SafetyStock = 50m,
        LeadTimeDays = leadTimeDays
    };

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

    private async Task SeedFacilityAndMedicineAsync(int minimumStockLevel)
    {
        _db.Facilities.Add(new Facility { Id = FacilityId, Code = "TEST-FAC", Name = "Test facility" });
        _db.Medicines.Add(new Medicine
        {
            Id = MedicineId,
            Code = "TEST-MED",
            Name = "Thyroid-5",
            MinimumStockLevel = minimumStockLevel
        });

        await _db.SaveChangesAsync();
    }

    private async Task SeedRealReferenceDataAsync()
    {
        foreach (var facilityId in DemandSeedData.RealFacilityIds)
        {
            _db.Facilities.Add(new Facility { Id = facilityId, Code = facilityId.ToString()[..8], Name = "Facility" });
        }

        var minimums = new Dictionary<Guid, int>
        {
            [SeedData.ParacetamolId] = 100,
            [SeedData.AmoxicillinId] = 50,
            [SeedData.IbuprofenId] = 100,
            [SeedData.CetirizineId] = 50,
            [SeedData.OmeprazoleId] = 50,
            [SeedData.AzithromycinId] = 25,
            [SeedData.VitaminCId] = 0 // falls back to the default minimum
        };

        foreach (var (medicineId, minimum) in minimums)
        {
            _db.Medicines.Add(new Medicine
            {
                Id = medicineId,
                Code = medicineId.ToString()[..8],
                Name = "Medicine",
                MinimumStockLevel = minimum
            });
        }

        await _db.SaveChangesAsync();
    }
}

