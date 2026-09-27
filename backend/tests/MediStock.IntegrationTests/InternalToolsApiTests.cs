namespace MediStock.IntegrationTests;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MediStock.Api.Common;
using MediStock.Api.Controllers;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Infrastructure.Persistence;
using Xunit;

/// <summary>
/// Internal tool endpoint tests for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
///   POST /internal/tools/consumption
///   POST /internal/tools/forecast
///
/// These verify the controlled-tool boundary the blueprint requires: the agent reaches
/// business services only through ASP.NET Core, the same deterministic validation
/// applies, and no client application can get in.
/// </summary>
public class InternalToolsApiTests : IClassFixture<DemandApiFactory>
{
    private static readonly Guid FacilityId = Guid.Parse("b1000000-0000-0000-0000-000000000002");
    private static readonly Guid MedicineId = Guid.Parse("c1000000-0000-0000-0000-000000000001");

    private readonly DemandApiFactory _factory;

    public InternalToolsApiTests(DemandApiFactory factory) => _factory = factory;

    private HttpClient ServiceClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(
            InternalToolsController.ServiceTokenHeader,
            DemandApiFactory.ServiceToken);

        return client;
    }

    private static object Body(string operation, object arguments) =>
        new { operation, arguments };

    // -----------------------------------------------------------------------
    // The boundary: clients must never reach these
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("/internal/tools/consumption")]
    [InlineData("/internal/tools/forecast")]
    public async Task ToolEndpoints_RefuseACallerWithNoServiceToken(string url)
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            url,
            Body("history", new { facilityId = FacilityId, medicineId = MedicineId }));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ToolEndpoints_RefuseAWrongServiceToken()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(
            InternalToolsController.ServiceTokenHeader,
            "not-the-right-token");

        var response = await client.PostAsJsonAsync(
            "/internal/tools/consumption",
            Body("history", new { facilityId = FacilityId, medicineId = MedicineId }));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ToolEndpoints_RefuseAValidUserJwt()
    {
        // A signed-in manager is still not the agent service. This is the rule that
        // keeps React and Flutter out of the internal agent boundary.
        var client = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await client.PostAsJsonAsync(
            "/internal/tools/consumption",
            Body("history", new { facilityId = FacilityId, medicineId = MedicineId }));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // Consumption tools
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetConsumptionHistory_ReturnsTheRecordedSeries()
    {
        var (facilityId, medicineId) = await SeedAsync(days: 10, quantityPerDay: 20m);

        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/consumption",
            Body("history", new { facilityId, medicineId, windowDays = 30 }));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");

        data.GetProperty("windowDays").GetInt32().Should().Be(30);
        data.GetProperty("entries").GetArrayLength().Should().Be(10);
    }

    [Fact]
    public async Task CalculateDailyConsumption_ReproducesTheBlueprintRate()
    {
        // 30 days at 20 a day is the worked example's consumption rate.
        var (facilityId, medicineId) = await SeedAsync(days: 30, quantityPerDay: 20m);

        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/consumption",
            Body("dailyAverage", new { facilityId, medicineId, windowDays = 30 }));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement
            .GetProperty("data")
            .GetProperty("averageDailyConsumption")
            .GetDecimal()
            .Should().Be(20m);
    }

    // -----------------------------------------------------------------------
    // Forecast tools
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CalculateForecast_ReturnsADeterministicForecast()
    {
        var (facilityId, medicineId) = await SeedAsync(days: 30, quantityPerDay: 20m);

        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("forecast", new
            {
                facilityId,
                medicineId,
                windowDays = 30,
                horizonDays = 30,
                method = ForecastMethods.MovingAverage,
                leadTimeDays = 10
            }));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");

        data.GetProperty("averageDailyConsumption").GetDecimal().Should().Be(20m);
        data.GetProperty("predictedDemand").GetDecimal().Should().Be(600m);
        data.GetProperty("forecastId").GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task CalculateForecast_AppliesTheSameValidationAsAHumanCaller()
    {
        // The agent gets no privileged path around the deterministic rules.
        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("forecast", new { facilityId = FacilityId, medicineId = MedicineId, method = "ARIMA" }));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("error").GetProperty("code").GetString()
            .Should().Be("DEMAND_UNSUPPORTED_FORECAST_METHOD");
    }

    [Fact]
    public async Task CalculateProjectedStockout_ReproducesTheBlueprintWorkedExample()
    {
        var (facilityId, medicineId) = await SeedAsync(days: 30, quantityPerDay: 20m);

        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("projectedStockout", new
            {
                facilityId,
                medicineId,
                currentStock = 120,
                averageDailyConsumption = 20,
                leadTimeDays = 10
            }));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");

        data.GetProperty("daysRemaining").GetInt32().Should().Be(6);
        data.GetProperty("riskLevel").GetString().Should().Be(ShortageRiskLevels.High);
        data.GetProperty("requiresTransfer").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task CalculateProjectedStockout_DerivesTheRateWhenTheAgentOmitsIt()
    {
        var (facilityId, medicineId) = await SeedAsync(days: 30, quantityPerDay: 20m);

        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("projectedStockout", new
            {
                facilityId,
                medicineId,
                currentStock = 120,
                leadTimeDays = 10,
                windowDays = 30
            }));

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");

        data.GetProperty("averageDailyConsumption").GetDecimal().Should().Be(20m);
        data.GetProperty("daysRemaining").GetInt32().Should().Be(6);
    }

    [Fact]
    public async Task CalculateProjectedStockout_DoesNotPersistAnAlert()
    {
        // A read-only projection. Raising an alert is a management action, and the
        // agent may probe this repeatedly while planning.
        var (facilityId, medicineId) = await SeedAsync(days: 30, quantityPerDay: 20m);

        await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("projectedStockout", new
            {
                facilityId,
                medicineId,
                currentStock = 120,
                averageDailyConsumption = 20,
                leadTimeDays = 10
            }));

        await _factory.WithDbAsync(async db =>
        {
            var alerts = db.ShortageAlerts.Count(x => x.FacilityId == facilityId);
            alerts.Should().Be(0);
            await Task.CompletedTask;
        });
    }

    [Fact]
    public async Task CalculateProjectedStockout_RejectsNegativeStock()
    {
        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("projectedStockout", new
            {
                facilityId = FacilityId,
                medicineId = MedicineId,
                currentStock = -1
            }));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetShortageThreshold_ReturnsTheConfiguredRule()
    {
        var facilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();

        await _factory.WithDbAsync(async db =>
        {
            db.ReorderRules.Add(new ReorderRule
            {
                Id = Guid.NewGuid(),
                FacilityId = facilityId,
                MedicineId = medicineId,
                MinimumStock = 150m,
                ReorderPoint = 300m,
                SafetyStock = 60m,
                LeadTimeDays = 10,
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
        });

        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("shortageThreshold", new { facilityId, medicineId }));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");

        data.GetProperty("minimumStock").GetDecimal().Should().Be(150m);
        data.GetProperty("leadTimeDays").GetInt32().Should().Be(10);
    }

    [Fact]
    public async Task GetShortageThreshold_ReportsAMissingRuleRatherThanGuessing()
    {
        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("shortageThreshold", new { facilityId = Guid.NewGuid(), medicineId = Guid.NewGuid() }));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("error").GetProperty("code").GetString()
            .Should().Be("DEMAND_THRESHOLD_NOT_FOUND");
    }

    // -----------------------------------------------------------------------
    // Envelope handling
    // -----------------------------------------------------------------------

    [Fact]
    public async Task UnknownOperation_IsRejected()
    {
        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/forecast",
            Body("dropAllTables", new { facilityId = FacilityId, medicineId = MedicineId }));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("error").GetProperty("code").GetString()
            .Should().Be(InternalToolsController.UnknownOperationCode);
    }

    [Fact]
    public async Task MissingIdentifiers_AreRejected()
    {
        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/consumption",
            Body("dailyAverage", new { windowDays = 30 }));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AnOversizedWindow_IsRejected()
    {
        var response = await ServiceClient().PostAsJsonAsync(
            "/internal/tools/consumption",
            Body("dailyAverage", new { facilityId = FacilityId, medicineId = MedicineId, windowDays = 5000 }));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<(Guid FacilityId, Guid MedicineId)> SeedAsync(int days, decimal quantityPerDay)
    {
        var facilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;

        await _factory.WithDbAsync(async db =>
        {
            for (var dayOffset = days; dayOffset >= 1; dayOffset--)
            {
                db.ConsumptionRecords.Add(new ConsumptionRecord
                {
                    Id = Guid.NewGuid(),
                    FacilityId = facilityId,
                    MedicineId = medicineId,
                    QuantityUsed = quantityPerDay,
                    ConsumptionDate = DateTime.SpecifyKind(today.AddDays(-dayOffset), DateTimeKind.Utc),
                    Source = "TEST",
                    CreatedAt = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync();
        });

        return (facilityId, medicineId);
    }
}
