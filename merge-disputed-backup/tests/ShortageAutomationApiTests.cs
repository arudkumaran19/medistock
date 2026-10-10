using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;
namespace MediStock.IntegrationTests;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MediStock.Api.Common;
using MediStock.Api.Controllers;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Inventory.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

/// <summary>
/// API tests for automatic shortage detection. Sathurstiga S. (IT24103156).
///
///   POST /api/consumption           raises or refreshes the alert automatically
///   POST /api/shortages             one active alert per facility and medicine
///   POST /api/shortages/scan        re-evaluates and auto-resolves
///   GET  /api/shortages/current-stock
///   POST /internal/tools/forecast   projectedStockout reads Inventory when stock is omitted
///
/// Every test uses its own facility and medicine, because the hosted in-memory
/// database is shared across the class.
/// </summary>
public class ShortageAutomationApiTests : IClassFixture<DemandApiFactory>
{
    private readonly DemandApiFactory _factory;

    public ShortageAutomationApiTests(DemandApiFactory factory) => _factory = factory;

    // -----------------------------------------------------------------------
    // Automatic evaluation after consumption
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RecordingConsumption_RaisesTheAlertAutomatically()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 120, leadTimeDays: 10, historyDays: 29);

        // The thirtieth day of 20 units arrives through the API, as from Flutter.
        var response = await RecordConsumptionAsync(facilityId, medicineId);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var alerts = await AlertsAsync(facilityId, medicineId);
        alerts.Should().ContainSingle();
        alerts[0].Status.Should().Be(ShortageAlertStatuses.Open);
        alerts[0].CurrentStock.Should().Be(120m);
        alerts[0].DaysRemaining.Should().Be(6);
    }

    [Fact]
    public async Task RecordingMoreConsumption_UpdatesTheSameAlert()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 120, leadTimeDays: 10, historyDays: 29);

        await RecordConsumptionAsync(facilityId, medicineId);
        await RecordConsumptionAsync(facilityId, medicineId, quantity: 40m);

        var alerts = await AlertsAsync(facilityId, medicineId);
        alerts.Should().ContainSingle();
        alerts[0].UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RecordingConsumption_WithoutARule_StillSavesAndRaisesNothing()
    {
        // No rule and no inventory: the check is skipped, the save is unaffected.
        var (facilityId, medicineId) = NewPair();

        var response = await RecordConsumptionAsync(facilityId, medicineId);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        (await AlertsAsync(facilityId, medicineId)).Should().BeEmpty();
    }

    [Fact]
    public async Task DeletingConsumption_ReEvaluatesAndCanResolve()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 150, leadTimeDays: 10, historyDays: 0);

        // One mis-keyed day of 300 gives 10/day: 150 / 10 = 15 days, no risk. Then a
        // second mis-keyed 300 gives 20/day: 7 days < 10, an alert.
        await RecordConsumptionAsync(facilityId, medicineId, quantity: 300m);
        var second = await RecordConsumptionAsync(facilityId, medicineId, quantity: 300m, daysAgo: 2);
        (await AlertsAsync(facilityId, medicineId)).Should().ContainSingle(x => x.Status == ShortageAlertStatuses.Open);

        // Deleting the mistake drops the rate back and the alert resolves itself.
        var id = await ReadIdAsync(second);
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        (await manager.DeleteAsync($"/api/consumption/{id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var alert = (await AlertsAsync(facilityId, medicineId)).Single();
        alert.Status.Should().Be(ShortageAlertStatuses.Resolved);
        alert.ResolutionReason.Should().Be(ShortageAlertStatuses.StockCoversLeadTimeReason);
    }

    // -----------------------------------------------------------------------
    // Scan now
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Scan_AutoResolvesAfterStockIsReceived()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 120, leadTimeDays: 10, historyDays: 30);
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        (await manager.PostAsync("/api/shortages/scan", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await AlertsAsync(facilityId, medicineId)).Should().ContainSingle(x => x.Status == ShortageAlertStatuses.Open);

        // Stock received in Inventory: 400 / 20 = 20 days, which covers 10.
        await _factory.WithDbAsync(async db =>
        {
            var balance = await db.InventoryBalances.SingleAsync(x => x.FacilityId == facilityId);
            balance.QuantityOnHand = 400;
            await db.SaveChangesAsync();
        });

        var scan = await manager.PostAsync("/api/shortages/scan", null);
        scan.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(await scan.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("data").GetProperty("resolved").GetInt32().Should().BeGreaterThan(0);

        var alert = (await AlertsAsync(facilityId, medicineId)).Single();
        alert.Status.Should().Be(ShortageAlertStatuses.Resolved);
        alert.ResolutionReason.Should().Be("Stock now covers lead time");
    }

    [Fact]
    public async Task Scan_IsForbiddenForAStoreOfficer()
    {
        var officer = _factory.CreateClientAs(Constants.Roles.StoreOfficer);

        var response = await officer.PostAsync("/api/shortages/scan", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // -----------------------------------------------------------------------
    // Raise alert: stock from Inventory, no duplicates
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CurrentStock_ReturnsOnHandMinusReserved()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 150, reserved: 30, leadTimeDays: null, historyDays: 0);
        var officer = _factory.CreateClientAs(Constants.Roles.StoreOfficer);

        var response = await officer.GetAsync(
            $"/api/shortages/current-stock?facilityId={facilityId}&medicineId={medicineId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("data").GetProperty("availableQuantity").GetDecimal().Should().Be(120m);
    }

    [Fact]
    public async Task CurrentStock_Is404WhenInventoryHasNoBalance()
    {
        var (facilityId, medicineId) = NewPair();
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await manager.GetAsync(
            $"/api/shortages/current-stock?facilityId={facilityId}&medicineId={medicineId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ErrorCodeAsync(response)).Should().Be("DEMAND_STOCK_NOT_FOUND");
    }

    [Fact]
    public async Task RaiseAlert_WithoutStock_UsesTheInventoryBalance()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 120, leadTimeDays: null, historyDays: 0);
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await manager.PostAsJsonAsync("/api/shortages", new
        {
            facilityId,
            medicineId,
            averageDailyConsumption = 20m,
            leadTimeDays = 10
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("data").GetProperty("currentStock").GetDecimal().Should().Be(120m);
    }

    [Fact]
    public async Task RaiseAlert_WithoutStockOrBalance_IsRejected()
    {
        var (facilityId, medicineId) = NewPair();
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await manager.PostAsJsonAsync("/api/shortages", new
        {
            facilityId,
            medicineId,
            averageDailyConsumption = 20m,
            leadTimeDays = 10
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ErrorCodeAsync(response)).Should().Be("DEMAND_STOCK_NOT_FOUND");
    }

    [Fact]
    public async Task RaiseAlert_Twice_UpdatesTheExistingAlert()
    {
        var (facilityId, medicineId) = NewPair();
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        var body = new
        {
            facilityId,
            medicineId,
            currentStock = 120m,
            averageDailyConsumption = 20m,
            leadTimeDays = 10
        };

        var first = await manager.PostAsJsonAsync("/api/shortages", body);
        var second = await manager.PostAsJsonAsync("/api/shortages", body);

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        using var firstDoc = JsonDocument.Parse(await first.Content.ReadAsStringAsync());
        using var secondDoc = JsonDocument.Parse(await second.Content.ReadAsStringAsync());
        var firstData = firstDoc.RootElement.GetProperty("data");
        var secondData = secondDoc.RootElement.GetProperty("data");

        secondData.GetProperty("id").GetGuid().Should().Be(firstData.GetProperty("id").GetGuid());
        firstData.GetProperty("existingAlertUpdated").GetBoolean().Should().BeFalse();
        secondData.GetProperty("existingAlertUpdated").GetBoolean().Should().BeTrue();
        (await AlertsAsync(facilityId, medicineId)).Should().ContainSingle();
    }

    // -----------------------------------------------------------------------
    // Agent tool: stock from Inventory
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ProjectedStockoutTool_ReadsInventoryWhenStockIsOmitted()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 120, leadTimeDays: 10, historyDays: 30);

        var response = await ServiceClient().PostAsJsonAsync("/internal/tools/forecast", new
        {
            operation = "projectedStockout",
            arguments = new { facilityId, medicineId, windowDays = 30 }
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");
        data.GetProperty("currentStock").GetDecimal().Should().Be(120m);
        data.GetProperty("daysRemaining").GetInt32().Should().Be(6);
        data.GetProperty("stockSource").GetString().Should().Be("INVENTORY");
    }

    [Fact]
    public async Task ProjectedStockoutTool_ReportsAMissingBalanceRatherThanGuessing()
    {
        var (facilityId, medicineId) = NewPair();

        var response = await ServiceClient().PostAsJsonAsync("/internal/tools/forecast", new
        {
            operation = "projectedStockout",
            arguments = new { facilityId, medicineId, averageDailyConsumption = 20, leadTimeDays = 10 }
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ErrorCodeAsync(response)).Should().Be("DEMAND_STOCK_NOT_FOUND");
    }

    [Fact]
    public async Task ProjectedStockoutTool_StillUsesASuppliedStock()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 9999, leadTimeDays: 10, historyDays: 0);

        var response = await ServiceClient().PostAsJsonAsync("/internal/tools/forecast", new
        {
            operation = "projectedStockout",
            arguments = new { facilityId, medicineId, currentStock = 120, averageDailyConsumption = 20, leadTimeDays = 10 }
        });

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");
        data.GetProperty("currentStock").GetDecimal().Should().Be(120m);
        data.GetProperty("stockSource").GetString().Should().Be("REQUEST");
    }

    [Fact]
    public async Task ShortageThresholdTool_UsesTheDefaultForAKnownMedicineWithoutARule()
    {
        var (facilityId, medicineId) = NewPair();
        await _factory.WithDbAsync(async db =>
        {
            db.Facilities.Add(new Facility { Id = facilityId, Code = $"F-{facilityId:N}"[..12], Name = "Test facility" });
            db.Medicines.Add(new Medicine
            {
                Id = medicineId,
                Code = $"M-{medicineId:N}"[..12],
                Name = "Thyroid-5",
                MinimumStockLevel = 40
            });
            await db.SaveChangesAsync();
        });

        var response = await ServiceClient().PostAsJsonAsync("/internal/tools/forecast", new
        {
            operation = "shortageThreshold",
            arguments = new { facilityId, medicineId }
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");
        data.GetProperty("leadTimeDays").GetInt32().Should().Be(ReorderRuleDefaults.LeadTimeDays);
        data.GetProperty("minimumStock").GetDecimal().Should().Be(40m);
        data.GetProperty("source").GetString().Should().Be("DEFAULT");
    }

    [Fact]
    public async Task ShortageThresholdTool_ReportsAConfiguredRuleAsConfigured()
    {
        var (facilityId, medicineId) = NewPair();
        await SeedAsync(facilityId, medicineId, onHand: 10, leadTimeDays: 12, historyDays: 0);

        var response = await ServiceClient().PostAsJsonAsync("/internal/tools/forecast", new
        {
            operation = "shortageThreshold",
            arguments = new { facilityId, medicineId }
        });

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");
        data.GetProperty("leadTimeDays").GetInt32().Should().Be(12);
        data.GetProperty("source").GetString().Should().Be("CONFIGURED");
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static (Guid FacilityId, Guid MedicineId) NewPair() => (Guid.NewGuid(), Guid.NewGuid());

    private HttpClient ServiceClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(InternalToolsController.ServiceTokenHeader, DemandApiFactory.ServiceToken);

        return client;
    }

    private Task SeedAsync(
        Guid facilityId,
        Guid medicineId,
        int onHand,
        int? leadTimeDays,
        int historyDays,
        int reserved = 0)
    {
        return _factory.WithDbAsync(async db =>
        {
            db.InventoryBalances.Add(new InventoryBalance
            {
                Id = Guid.NewGuid(),
                FacilityId = facilityId,
                MedicineId = medicineId,
                QuantityOnHand = onHand,
                QuantityReserved = reserved
            });

            if (leadTimeDays is { } lead)
            {
                db.ReorderRules.Add(new ReorderRule
                {
                    Id = Guid.NewGuid(),
                    FacilityId = facilityId,
                    MedicineId = medicineId,
                    MinimumStock = 100m,
                    ReorderPoint = 200m,
                    SafetyStock = 50m,
                    LeadTimeDays = lead
                });
            }

            // Days 2..historyDays+1 ago, so a test can still record "yesterday".
            for (var dayOffset = historyDays + 1; dayOffset >= 2; dayOffset--)
            {
                db.ConsumptionRecords.Add(new ConsumptionRecord
                {
                    Id = Guid.NewGuid(),
                    FacilityId = facilityId,
                    MedicineId = medicineId,
                    QuantityUsed = 20m,
                    ConsumptionDate = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-dayOffset), DateTimeKind.Utc),
                    Source = "TEST",
                    CreatedAt = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync();
        });
    }

    private Task<HttpResponseMessage> RecordConsumptionAsync(
        Guid facilityId,
        Guid medicineId,
        decimal quantity = 20m,
        int daysAgo = 1)
    {
        var officer = _factory.CreateClientAs(Constants.Roles.StoreOfficer);

        return officer.PostAsJsonAsync("/api/consumption", new
        {
            facilityId,
            medicineId,
            quantityUsed = quantity,
            consumptionDate = DateTime.UtcNow.Date.AddDays(-daysAgo),
            source = "FLUTTER_CONSUMPTION_ENTRY"
        });
    }

    private async Task<List<ShortageAlert>> AlertsAsync(Guid facilityId, Guid medicineId)
    {
        List<ShortageAlert> alerts = [];

        await _factory.WithDbAsync(async db =>
        {
            alerts = await db.ShortageAlerts
                .AsNoTracking()
                .Where(x => x.FacilityId == facilityId && x.MedicineId == medicineId)
                .ToListAsync();
        });

        return alerts;
    }

    private static async Task<Guid> ReadIdAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        return document.RootElement.GetProperty("data").GetProperty("id").GetGuid();
    }

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        return document.RootElement.GetProperty("error").GetProperty("code").GetString();
    }
}

