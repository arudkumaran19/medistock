namespace MediStock.IntegrationTests;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MediStock.Api.Common;
using MediStock.Api.Features.Demand.Models;
using Xunit;

/// <summary>
/// API and authorization tests for the frozen Demand contract.
/// Sathurstiga S. (IT24103156).
///
///   GET    /api/consumption
///   POST   /api/consumption
///   GET    /api/demand/forecasts
///   POST   /api/demand/forecast
///   GET    /api/shortages
///   GET    /api/shortages/{id}
///   POST   /api/shortages/recalculate
/// </summary>
public class DemandApiTests : IClassFixture<DemandApiFactory>
{
    private static readonly Guid FacilityId = Guid.Parse("b1000000-0000-0000-0000-000000000002");
    private static readonly Guid MedicineId = Guid.Parse("c1000000-0000-0000-0000-000000000001");

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly DemandApiFactory _factory;

    public DemandApiTests(DemandApiFactory factory) => _factory = factory;

    // -----------------------------------------------------------------------
    // Authentication and authorization
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("/api/consumption")]
    [InlineData("/api/demand/forecasts")]
    [InlineData("/api/shortages")]
    public async Task Endpoints_RejectAnUnauthenticatedCaller(string url)
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(url);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetConsumption_IsAllowedForAStoreOfficer()
    {
        var client = _factory.CreateClientAs(Constants.Roles.StoreOfficer);

        var response = await client.GetAsync($"/api/consumption?facilityId={FacilityId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task PostConsumption_IsForbiddenForASupplierOfficer()
    {
        // Supplier officers work on purchase orders and deliveries, not ward consumption.
        var client = _factory.CreateClientAs(Constants.Roles.SupplierOfficer);

        var response = await client.PostAsJsonAsync("/api/consumption", NewConsumptionBody());

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PostRecalculate_IsForbiddenForAStoreOfficer()
    {
        // Recalculation is a management operation, not a field one.
        var client = _factory.CreateClientAs(Constants.Roles.StoreOfficer);

        var response = await client.PostAsJsonAsync("/api/shortages/recalculate", NewRecalculateBody(120m));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PostForecast_IsAllowedForAFacilityManager()
    {
        var client = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await client.PostAsJsonAsync("/api/demand/forecast", new
        {
            facilityId = FacilityId,
            medicineId = MedicineId,
            windowDays = 30,
            horizonDays = 30,
            method = ForecastMethods.MovingAverage,
            leadTimeDays = 10
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // -----------------------------------------------------------------------
    // Contract shape
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetConsumption_ReturnsTheFrozenEnvelopeInCamelCase()
    {
        var client = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var payload = await client.GetStringAsync($"/api/consumption?facilityId={FacilityId}&page=1&pageSize=5");

        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        root.GetProperty("success").GetBoolean().Should().BeTrue();

        var data = root.GetProperty("data");
        data.TryGetProperty("items", out _).Should().BeTrue();
        data.GetProperty("page").GetInt32().Should().Be(1);
        data.GetProperty("pageSize").GetInt32().Should().Be(5);
        data.TryGetProperty("totalCount", out _).Should().BeTrue();
        data.TryGetProperty("totalPages", out _).Should().BeTrue();
    }

    [Fact]
    public async Task PostConsumption_WithAnInvalidBody_ReturnsTheAgreedErrorContract()
    {
        var client = _factory.CreateClientAs(Constants.Roles.StoreOfficer);

        var body = NewConsumptionBody();
        body["quantityUsed"] = -5m;

        var response = await client.PostAsJsonAsync("/api/consumption", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        root.GetProperty("success").GetBoolean().Should().BeFalse();

        var error = root.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("DEMAND_VALIDATION_ERROR");
        error.GetProperty("message").GetString().Should().Contain("quantityUsed");
        error.GetProperty("traceId").GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task GetShortageById_WhenMissing_ReturnsTheAgreedErrorContract()
    {
        var client = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await client.GetAsync($"/api/shortages/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("error").GetProperty("code").GetString()
            .Should().Be("DEMAND_NOT_FOUND");
    }

    [Fact]
    public async Task PostForecast_WithAnUnsanctionedMethod_IsRejected()
    {
        var client = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await client.PostAsJsonAsync("/api/demand/forecast", new
        {
            facilityId = FacilityId,
            medicineId = MedicineId,
            method = "ARIMA"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        document.RootElement.GetProperty("error").GetProperty("code").GetString()
            .Should().Be("DEMAND_UNSUPPORTED_FORECAST_METHOD");
    }

    // -----------------------------------------------------------------------
    // The demonstration chain, over HTTP
    // -----------------------------------------------------------------------

    /// <summary>
    /// Walks the required demonstration across the real API surface:
    /// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
    /// </summary>
    [Fact]
    public async Task DemandChain_OverHttp_ProducesAShortageAlert()
    {
        var medicineId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();

        // 1. A store officer records thirty days of consumption at 20 units a day.
        var officer = _factory.CreateClientAs(Constants.Roles.StoreOfficer);

        for (var dayOffset = 30; dayOffset >= 1; dayOffset--)
        {
            var created = await officer.PostAsJsonAsync("/api/consumption", new
            {
                facilityId,
                medicineId,
                quantityUsed = 20m,
                consumptionDate = DateTime.UtcNow.Date.AddDays(-dayOffset),
                source = "FLUTTER_CONSUMPTION_ENTRY"
            });

            created.StatusCode.Should().Be(HttpStatusCode.Created);
        }

        // 2, 3 and 4. A manager recalculates: the forecast, stockout and alert are derived.
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);

        var response = await manager.PostAsJsonAsync("/api/shortages/recalculate", new
        {
            facilityId,
            medicineId,
            currentStock = 120m,
            leadTimeDays = 10,
            windowDays = 30
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var alert = document.RootElement.GetProperty("data");

        alert.GetProperty("averageDailyConsumption").GetDecimal().Should().Be(20m);
        alert.GetProperty("daysRemaining").GetInt32().Should().Be(6);
        alert.GetProperty("leadTimeDays").GetInt32().Should().Be(10);
        alert.GetProperty("riskLevel").GetString().Should().Be(ShortageRiskLevels.High);
        alert.GetProperty("requiresTransfer").GetBoolean().Should().BeTrue();
        alert.GetProperty("demandForecastId").GetString().Should().NotBeNullOrWhiteSpace();

        // The alert is retrievable by id afterwards.
        var alertId = alert.GetProperty("id").GetGuid();
        var fetched = await manager.GetAsync($"/api/shortages/{alertId}");

        fetched.StatusCode.Should().Be(HttpStatusCode.OK);

        // And it appears in the dashboard list filtered to high risk.
        var listed = await manager.GetStringAsync(
            $"/api/shortages?facilityId={facilityId}&riskLevel=HIGH");

        using var listDocument = JsonDocument.Parse(listed);
        listDocument.RootElement
            .GetProperty("data")
            .GetProperty("totalCount")
            .GetInt32()
            .Should().BeGreaterThan(0);
    }

    private static Dictionary<string, object?> NewConsumptionBody() => new()
    {
        ["facilityId"] = FacilityId,
        ["medicineId"] = MedicineId,
        ["quantityUsed"] = 20m,
        ["consumptionDate"] = DateTime.UtcNow.Date.AddDays(-1),
        ["source"] = "FLUTTER_CONSUMPTION_ENTRY"
    };

    private static Dictionary<string, object?> NewRecalculateBody(decimal currentStock) => new()
    {
        ["facilityId"] = FacilityId,
        ["medicineId"] = MedicineId,
        ["currentStock"] = currentStock,
        ["averageDailyConsumption"] = 20m,
        ["leadTimeDays"] = 10
    };
}
