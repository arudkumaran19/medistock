namespace MediStock.IntegrationTests;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using Xunit;

/// <summary>
/// Integration tests verifying the end-to-end shortage alert lifecycle, verified resolution rules,
/// status history immutability, and system-wide admin audit console endpoints.
/// </summary>
public class ShortageLifecycleAndAuditIntegrationTests : IClassFixture<DemandApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly DemandApiFactory _factory;

    public ShortageLifecycleAndAuditIntegrationTests(DemandApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ShortageResolution_WithoutVerification_ReturnsBadRequest400()
    {
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        var facilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();

        // 1. Raise a critical shortage alert: 20 units stock, 10 units/day consumption, 10 days lead time (requires 100 units).
        var createResponse = await manager.PostAsJsonAsync("/api/shortages", new ShortageCreateRequest
        {
            FacilityId = facilityId,
            MedicineId = medicineId,
            CurrentStock = 20m,
            AverageDailyConsumption = 10m,
            LeadTimeDays = 10
        });

        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var createdAlert = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ShortageResponse>>(Json);
        createdAlert.Should().NotBeNull();
        var alertId = createdAlert!.Data.Id;

        // 2. Attempt to resolve with NO verification data and insufficient inventory
        var resolveResponse = await manager.PostAsJsonAsync($"/api/shortages/{alertId}/resolve", new ShortageResolveRequest());

        resolveResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        using var doc = JsonDocument.Parse(await resolveResponse.Content.ReadAsStringAsync());
        var error = doc.RootElement.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("SHORTAGE_RESOLUTION_NOT_VERIFIED");
        error.GetProperty("message").GetString().Should().Contain("cannot be marked resolved without verification");
    }

    [Fact]
    public async Task ShortageResolution_WithClinicalAuditVerification_SucceedsAndAppendsStatusHistory()
    {
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        var facilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();

        // 1. Raise shortage alert
        var createResponse = await manager.PostAsJsonAsync("/api/shortages", new ShortageCreateRequest
        {
            FacilityId = facilityId,
            MedicineId = medicineId,
            CurrentStock = 15m,
            AverageDailyConsumption = 5m,
            LeadTimeDays = 7
        });

        var createdAlert = (await createResponse.Content.ReadFromJsonAsync<ApiResponse<ShortageResponse>>(Json))!.Data;

        // 2. Resolve with formal physical stock audit verification
        var resolveRequest = new ShortageResolveRequest
        {
            VerificationMethod = "STOCK_AUDIT",
            VerificationNotes = "Physical count conducted by chief pharmacist. Emergency replenishment added 80 units.",
            VerifiedCurrentStock = 95m
        };

        var resolveResponse = await manager.PostAsJsonAsync($"/api/shortages/{createdAlert.Id}/resolve", resolveRequest);
        resolveResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var resolvedAlert = (await resolveResponse.Content.ReadFromJsonAsync<ApiResponse<ShortageResponse>>(Json))!.Data;
        resolvedAlert.Status.Should().Be("RESOLVED");
        resolvedAlert.ResolutionVerified.Should().BeTrue();
        resolvedAlert.VerificationMethod.Should().Be("STOCK_AUDIT");
        resolvedAlert.VerificationNotes.Should().Contain("Physical count conducted");
        resolvedAlert.VerifiedBy.Should().NotBeNullOrWhiteSpace();

        // 3. Status history must track the transition
        resolvedAlert.StatusHistory.Should().NotBeEmpty();
        var resolveTransition = resolvedAlert.StatusHistory.First(h => h.ToStatus == "RESOLVED");
        resolveTransition.FromStatus.Should().Be("OPEN");
        resolveTransition.ToStatus.Should().Be("RESOLVED");
        resolveTransition.VerificationMethod.Should().Be("STOCK_AUDIT");
        resolveTransition.Notes.Should().Contain("Emergency replenishment");
    }

    [Fact]
    public async Task ShortageDuplicatePrevention_ConsolidatesAlertsAndAppendsHistory()
    {
        var manager = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        var facilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();

        // 1. Raise initial alert
        var firstResponse = await manager.PostAsJsonAsync("/api/shortages", new ShortageCreateRequest
        {
            FacilityId = facilityId,
            MedicineId = medicineId,
            CurrentStock = 10m,
            AverageDailyConsumption = 5m,
            LeadTimeDays = 5
        });
        firstResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var firstAlert = (await firstResponse.Content.ReadFromJsonAsync<ApiResponse<ShortageResponse>>(Json))!.Data;
        firstAlert.ExistingAlertUpdated.Should().BeFalse();

        // 2. Raise second alert for identical facility & medicine with updated stock
        var secondResponse = await manager.PostAsJsonAsync("/api/shortages", new ShortageCreateRequest
        {
            FacilityId = facilityId,
            MedicineId = medicineId,
            CurrentStock = 12m,
            AverageDailyConsumption = 5m,
            LeadTimeDays = 5
        });
        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var secondAlert = (await secondResponse.Content.ReadFromJsonAsync<ApiResponse<ShortageResponse>>(Json))!.Data;

        // Must update existing alert rather than duplicate
        secondAlert.Id.Should().Be(firstAlert.Id);
        secondAlert.ExistingAlertUpdated.Should().BeTrue();
        secondAlert.CurrentStock.Should().Be(12m);

        // Status history must record the update
        secondAlert.StatusHistory.Should().NotBeEmpty();
        secondAlert.StatusHistory.Should().Contain(h => h.Reason != null && h.Reason.Contains("Refreshed"));
    }

    [Fact]
    public async Task AdminAuditLogs_RequiresAdminRole_AndReturnsAuditRecords()
    {
        var nonAdmin = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        var admin = _factory.CreateClientAs(Constants.Roles.Admin);

        // 1. Non-admin is rejected with 403 Forbidden
        var forbiddenResponse = await nonAdmin.GetAsync("/api/admin/audit-logs");
        forbiddenResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 2. Admin can access audit logs
        var adminResponse = await admin.GetAsync("/api/admin/audit-logs?page=1&pageSize=10");
        adminResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var doc = JsonDocument.Parse(await adminResponse.Content.ReadAsStringAsync());
        var data = doc.RootElement.GetProperty("data");
        data.GetProperty("items").ValueKind.Should().Be(JsonValueKind.Array);
        data.GetProperty("page").GetInt32().Should().Be(1);

        // 3. Admin can access audit statistics summary
        var statsResponse = await admin.GetAsync("/api/admin/audit-logs/stats");
        statsResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var statsDoc = JsonDocument.Parse(await statsResponse.Content.ReadAsStringAsync());
        var statsData = statsDoc.RootElement.GetProperty("data");
        statsData.TryGetProperty("totalEvents", out _).Should().BeTrue();
        statsData.TryGetProperty("shortageWorkflowEvents", out _).Should().BeTrue();
    }
}
