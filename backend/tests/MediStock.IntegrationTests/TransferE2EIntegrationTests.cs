namespace MediStock.IntegrationTests;

using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Xunit;

using DomainMedicine = MediStock.Api.Domain.Entities.Medicine;
using InventoryMedicine = MediStock.Api.Features.Inventory.Models.Medicine;
using ProcurementSupplier = MediStock.Api.Features.Procurement.Models.Supplier;

public class TransferTestFactory : WebApplicationFactory<Program>
{
    public const string SigningKey = "medistock-integration-test-signing-key-at-least-32-bytes";
    public const string Issuer = "MediStock";
    public const string Audience = "MediStock";
    private readonly string _databaseName = $"medistock-e2e-{Guid.NewGuid()}";

    static TransferTestFactory()
    {
        Environment.SetEnvironmentVariable("JWT_SIGNING_KEY", SigningKey);
        Environment.SetEnvironmentVariable("JWT_ISSUER", Issuer);
        Environment.SetEnvironmentVariable("JWT_AUDIENCE", Audience);
        Environment.SetEnvironmentVariable("Jwt__SigningKey", SigningKey);
        Environment.SetEnvironmentVariable("Jwt__Issuer", Issuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", Audience);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Jwt:SigningKey", SigningKey);
        builder.UseSetting("JWT_SIGNING_KEY", SigningKey);
        builder.UseSetting("Jwt:Issuer", Issuer);
        builder.UseSetting("Jwt:Audience", Audience);

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.RemoveAll<ApplicationDbContext>();
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName + "-app"));

            services.RemoveAll<DbContextOptions<MediStockDbContext>>();
            services.RemoveAll<MediStockDbContext>();
            services.AddDbContext<MediStockDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName + "-medi"));
        });
    }

    public string CreateToken(string role, Guid? userId = null)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: new[]
            {
                new Claim(ClaimTypes.NameIdentifier, (userId ?? Guid.NewGuid()).ToString()),
                new Claim(ClaimTypes.Name, $"test-{role.ToLowerInvariant()}"),
                new Claim(ClaimTypes.Role, role)
            },
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public HttpClient CreateClientAs(string role, Guid? userId = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(role, userId));
        return client;
    }
}

public class TransferE2EIntegrationTests : IClassFixture<TransferTestFactory>
{
    private readonly TransferTestFactory _factory;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    public TransferE2EIntegrationTests(TransferTestFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SignalR_Negotiate_Returns401WithoutToken_And200WithAccessToken()
    {
        // 1. Without token -> 401 Unauthorized
        var anonymousClient = _factory.CreateClient();
        var unauthResponse = await anonymousClient.PostAsync("/hubs/transfers/negotiate?negotiateVersion=1", null);
        unauthResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // 2. With access_token query param (like Web useTransferSignalR and Flutter signalr_client)
        var token = _factory.CreateToken(Constants.Roles.StoreOfficer);
        var authQueryResponse = await anonymousClient.PostAsync($"/hubs/transfers/negotiate?negotiateVersion=1&access_token={token}", null);
        authQueryResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await authQueryResponse.Content.ReadAsStringAsync();
        content.Should().Contain("connectionId");

        // 3. With Authorization header
        var headerClient = _factory.CreateClientAs(Constants.Roles.StoreOfficer);
        var authHeaderResponse = await headerClient.PostAsync("/hubs/transfers/negotiate?negotiateVersion=1", null);
        authHeaderResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task E2E_CetirizineShortage_NoCandidates_SetsRejected_CreatesPendingPO_UpdatesAlert_AndVisibleInApprovals()
    {
        var negomboId = Guid.NewGuid();
        var colomboId = Guid.NewGuid();
        var cetirizineId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var alertId = Guid.NewGuid();
        var storeOfficerId = Guid.NewGuid();

        using (var scope = _factory.Services.CreateScope())
        {
            var appDb = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var mediDb = scope.ServiceProvider.GetRequiredService<MediStockDbContext>();

            var negombo = new Facility
            {
                Id = negomboId,
                Name = "Negombo Base Hospital",
                FacilityCode = $"FAC-NEG-{Guid.NewGuid():N}",
                FacilityType = "HOSPITAL",
                Latitude = 7.2083,
                Longitude = 79.8358,
                IsActive = true
            };
            var colombo = new Facility
            {
                Id = colomboId,
                Name = "National Hospital Colombo",
                FacilityCode = $"FAC-COL-{Guid.NewGuid():N}",
                FacilityType = "HOSPITAL",
                Latitude = 6.9271,
                Longitude = 79.8612,
                IsActive = true
            };
            appDb.Facilities.AddRange(negombo, colombo);
            mediDb.Facilities.AddRange(negombo, colombo);

            var domainCetirizine = new DomainMedicine
            {
                Id = cetirizineId,
                Name = "Cetirizine 10mg",
                Sku = "MED-CET-10",
                UnitOfMeasure = "tablets",
                IsActive = true
            };
            var invCetirizine = new InventoryMedicine
            {
                Id = cetirizineId,
                Name = "Cetirizine 10mg",
                Code = "MED-CET-10",
                Unit = "tablets",
                MinimumStockLevel = 100,
                IsActive = true
            };
            appDb.Medicines.Add(invCetirizine);
            mediDb.Medicines.Add(domainCetirizine);

            var supplier = new ProcurementSupplier
            {
                Id = supplierId,
                Name = "CureMed Wholesale",
                Email = "orders@curemed.com",
                LeadTimeDays = 5,
                IsActive = true
            };
            appDb.Suppliers.Add(supplier);
            mediDb.Suppliers.Add(supplier);

            var alert = new ShortageAlert
            {
                Id = alertId,
                FacilityId = negomboId,
                MedicineId = cetirizineId,
                Status = ShortageAlertStatuses.Open,
                CurrentStock = 0,
                AverageDailyConsumption = 20,
                DaysRemaining = 3,
                LeadTimeDays = 5,
                RiskLevel = ShortageRiskLevels.High
            };
            appDb.ShortageAlerts.Add(alert);

            await appDb.SaveChangesAsync();
            await mediDb.SaveChangesAsync();
        }

        var storeOfficerClient = _factory.CreateClientAs(Constants.Roles.StoreOfficer, storeOfficerId);

        // 1. Create draft transfer request for Cetirizine
        var createRequest = new CreateTransferRequest
        {
            DestinationFacilityId = negomboId,
            MedicineId = cetirizineId,
            MedicineName = "Cetirizine 10mg",
            RequestedQuantity = 50,
            Priority = TransferPriority.Medium,
            SourceShortageAlertId = alertId,
            Notes = "Requisition for Cetirizine stockout"
        };

        var createResp = await storeOfficerClient.PostAsJsonAsync("/api/transfers", createRequest);
        createResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResp.Content.ReadFromJsonAsync<ApiResponse<TransferResponse>>(JsonOptions);
        created.Should().NotBeNull();
        created!.Data.Should().NotBeNull();
        var transferId = created.Data!.Id;

        // 2. Submit transfer request -> Zero candidates found (surplus = 0)
        var submitResp = await storeOfficerClient.PostAsJsonAsync($"/api/transfers/{transferId}/request", new { notes = "Submit requisition" });
        submitResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var submitted = await submitResp.Content.ReadFromJsonAsync<ApiResponse<TransferResponse>>(JsonOptions);
        submitted.Should().NotBeNull();
        submitted!.Data.Should().NotBeNull();
        submitted.Data!.Status.Should().Be(TransferStatus.Rejected);
        submitted.Data.RejectionReason.Should().Be("No facility has surplus stock for this medicine");
        submitted.Data.PurchaseOrderId.Should().NotBeNull();
        var purchaseOrderId = submitted.Data.PurchaseOrderId!.Value;

        // 3. Verify ShortageAlert is moved to DEMAND_RAISED
        using (var scope = _factory.Services.CreateScope())
        {
            var appDb = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var updatedAlert = await appDb.ShortageAlerts.FindAsync(alertId);
            updatedAlert.Should().NotBeNull();
            updatedAlert!.Status.Should().Be(ShortageAlertStatuses.DemandRaised);
        }

        // 4. Verify Purchase Order is visible in Approvals Console (/api/approvals/pending)
        var managerClient = _factory.CreateClientAs(Constants.Roles.FacilityManager);
        var approvalsResp = await managerClient.GetAsync("/api/approvals/pending");
        approvalsResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var pendingApprovals = await approvalsResp.Content.ReadFromJsonAsync<List<PurchaseOrderResponse>>(JsonOptions);
        pendingApprovals.Should().NotBeNull();
        var po = pendingApprovals!.FirstOrDefault(p => p.Id == purchaseOrderId);
        po.Should().NotBeNull("the generated purchase order must be visible in the Approvals Console");
        po!.Status.Should().Be(PurchaseOrderStatus.PendingApproval.ToString());
        po.FacilityId.Should().Be(negomboId);
        po.Items.Should().ContainSingle(i => i.MedicineId == cetirizineId && i.RequestedQuantity == 50);
    }

    [Fact]
    public async Task E2E_ParacetamolShortage_WithSurplus_ReachesProposed()
    {
        var negomboId = Guid.NewGuid();
        var colomboId = Guid.NewGuid();
        var paracetamolId = Guid.NewGuid();
        var storeOfficerId = Guid.NewGuid();

        using (var scope = _factory.Services.CreateScope())
        {
            var appDb = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var mediDb = scope.ServiceProvider.GetRequiredService<MediStockDbContext>();

            var negombo = new Facility
            {
                Id = negomboId,
                Name = "Negombo Base Hospital",
                FacilityCode = $"FAC-NEG-{Guid.NewGuid():N}",
                FacilityType = "HOSPITAL",
                Latitude = 7.2083,
                Longitude = 79.8358,
                IsActive = true
            };
            var colombo = new Facility
            {
                Id = colomboId,
                Name = "National Hospital Colombo",
                FacilityCode = $"FAC-COL-{Guid.NewGuid():N}",
                FacilityType = "HOSPITAL",
                Latitude = 6.9271,
                Longitude = 79.8612,
                IsActive = true
            };
            appDb.Facilities.AddRange(negombo, colombo);
            mediDb.Facilities.AddRange(negombo, colombo);

            var domainParacetamol = new DomainMedicine
            {
                Id = paracetamolId,
                Name = "Paracetamol 500mg",
                Sku = $"MED-PAR-{Guid.NewGuid():N}",
                UnitOfMeasure = "tablets",
                IsActive = true
            };
            var invParacetamol = new InventoryMedicine
            {
                Id = paracetamolId,
                Name = "Paracetamol 500mg",
                Code = $"MED-PAR-{Guid.NewGuid():N}",
                Unit = "tablets",
                MinimumStockLevel = 50,
                IsActive = true
            };
            appDb.Medicines.Add(invParacetamol);
            mediDb.Medicines.Add(domainParacetamol);

            // Colombo has surplus stock: 500 on hand, 50 min stock -> surplus = 450
            var colomboBalance = new InventoryBalance
            {
                Id = Guid.NewGuid(),
                FacilityId = colomboId,
                MedicineId = paracetamolId,
                Facility = colombo,
                Medicine = invParacetamol,
                QuantityOnHand = 500,
                QuantityReserved = 0
            };
            appDb.InventoryBalances.Add(colomboBalance);

            await appDb.SaveChangesAsync();
            await mediDb.SaveChangesAsync();
        }

        var storeOfficerClient = _factory.CreateClientAs(Constants.Roles.StoreOfficer, storeOfficerId);

        // 1. Create draft transfer request for Paracetamol
        var createRequest = new CreateTransferRequest
        {
            DestinationFacilityId = negomboId,
            MedicineId = paracetamolId,
            MedicineName = "Paracetamol 500mg",
            RequestedQuantity = 100,
            Priority = TransferPriority.Medium,
            Notes = "Requisition for Paracetamol"
        };

        var createResp = await storeOfficerClient.PostAsJsonAsync("/api/transfers", createRequest);
        createResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResp.Content.ReadFromJsonAsync<ApiResponse<TransferResponse>>(JsonOptions);
        var transferId = created!.Data!.Id;

        // 2. Submit transfer request -> Surplus exists at Colombo -> Outcome is Proposed
        var submitResp = await storeOfficerClient.PostAsJsonAsync($"/api/transfers/{transferId}/request", new { notes = "Submit requisition" });
        submitResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var submitted = await submitResp.Content.ReadFromJsonAsync<ApiResponse<TransferResponse>>(JsonOptions);
        submitted.Should().NotBeNull();
        submitted!.Data.Should().NotBeNull();
        submitted.Data!.Status.Should().Be(TransferStatus.Proposed, because: $"Notes: {submitted.Data.Notes}, Message: {submitted.Message}");
        submitted.Data.SourceFacilityId.Should().Be(colomboId);
        submitted.Data.Items.Should().NotBeEmpty();
        submitted.Data.Items[0].AllocatedQuantity.Should().Be(100);
    }
}
