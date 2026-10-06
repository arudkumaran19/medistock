using System.Security.Claims;
using MediStock.Api.Domain.Entities;
using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Procurement.Services;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MediStock.UnitTests;

public sealed class ProcurementServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _dbContext;

    public ProcurementServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _dbContext = new ApplicationDbContext(options);
        _dbContext.Database.EnsureCreated();
    }

    [Fact]
    public async Task CreateAsync_ThrowsArgumentNullException_WhenRequestIsNull()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => service.CreateAsync(null!, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenSupplierIdIsEmpty()
    {
        var service = CreateService();
        var request = new PurchaseOrderRequest(
            Guid.Empty,
            Guid.NewGuid(),
            [new PurchaseOrderItemRequest(Guid.NewGuid(), 10, 50m)]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("SUPPLIER_REQUIRED", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenFacilityIdIsEmpty()
    {
        var service = CreateService();
        var request = new PurchaseOrderRequest(
            Guid.NewGuid(),
            Guid.Empty,
            [new PurchaseOrderItemRequest(Guid.NewGuid(), 10, 50m)]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("FACILITY_REQUIRED", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenItemsAreEmpty()
    {
        var service = CreateService();
        var request = new PurchaseOrderRequest(
            Guid.NewGuid(),
            Guid.NewGuid(),
            []);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("ITEMS_REQUIRED", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenSupplierNotFound()
    {
        var (facilityId, _) = await SeedFacilityAndMedicineAsync();
        var service = CreateService();

        var request = new PurchaseOrderRequest(
            Guid.NewGuid(),
            facilityId,
            [new PurchaseOrderItemRequest(Guid.NewGuid(), 10, 50m)]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("SUPPLIER_NOT_FOUND", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenFacilityNotFound()
    {
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var request = new PurchaseOrderRequest(
            supplierId,
            Guid.NewGuid(),
            [new PurchaseOrderItemRequest(Guid.NewGuid(), 10, 50m)]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("FACILITY_NOT_FOUND", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenMedicineIdIsEmpty()
    {
        var (facilityId, _) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var request = new PurchaseOrderRequest(
            supplierId,
            facilityId,
            [new PurchaseOrderItemRequest(Guid.Empty, 10, 50m)]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("MEDICINE_REQUIRED", ex.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task CreateAsync_ThrowsProcurementException_WhenQuantityIsInvalid(int quantity)
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var request = new PurchaseOrderRequest(
            supplierId,
            facilityId,
            [new PurchaseOrderItemRequest(medicineId, quantity, 50m)]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("INVALID_QUANTITY", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenUnitPriceIsNegative()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var request = new PurchaseOrderRequest(
            supplierId,
            facilityId,
            [new PurchaseOrderItemRequest(medicineId, 10, -1m)]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("INVALID_UNIT_PRICE", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_ThrowsProcurementException_WhenDuplicateMedicinePresent()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var request = new PurchaseOrderRequest(
            supplierId,
            facilityId,
            [
                new PurchaseOrderItemRequest(medicineId, 10, 50m),
                new PurchaseOrderItemRequest(medicineId, 5, 50m)
            ]);

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("DUPLICATE_MEDICINE", ex.Code);
    }

    [Fact]
    public async Task CreateAsync_CreatesOrderInDraftStatus_WhenRequestIsValid()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var request = new PurchaseOrderRequest(
            supplierId,
            facilityId,
            [new PurchaseOrderItemRequest(medicineId, 25, 120.50m)]);

        var result = await service.CreateAsync(request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(supplierId, result.SupplierId);
        Assert.Equal(facilityId, result.FacilityId);
        Assert.Equal(PurchaseOrderStatus.Draft.ToString(), result.Status);
        Assert.Single(result.Items);
        Assert.Equal(medicineId, result.Items[0].MedicineId);
        Assert.Equal(25, result.Items[0].RequestedQuantity);
        Assert.Equal(120.50m, result.Items[0].UnitPrice);
        Assert.Null(result.ApprovedAt);
        Assert.Null(result.ApprovedById);
    }

    [Fact]
    public async Task GetAllAsync_FiltersOrdersCorrectly()
    {
        var (facility1, medId) = await SeedFacilityAndMedicineAsync();
        var facility2 = Guid.NewGuid();
        _dbContext.Facilities.Add(new Facility { Id = facility2, Name = "Hospital 2", Code = "HOSP2", Address = "Kandy", IsActive = true });
        var supplier1 = await SeedSupplierAsync();
        var supplier2 = Guid.NewGuid();
        _dbContext.Suppliers.Add(new Supplier { Id = supplier2, Name = "Sup 2", ContactPerson = "CP", Email = "s2@test.com", Phone = "123", Address = "A", LeadTimeDays = 2, IsActive = true });
        await _dbContext.SaveChangesAsync();

        var po1 = new PurchaseOrder { Id = Guid.NewGuid(), FacilityId = facility1, SupplierId = supplier1, Status = PurchaseOrderStatus.Draft, RequestedAt = DateTime.UtcNow.AddMinutes(-10) };
        var po2 = new PurchaseOrder { Id = Guid.NewGuid(), FacilityId = facility1, SupplierId = supplier2, Status = PurchaseOrderStatus.PendingApproval, RequestedAt = DateTime.UtcNow.AddMinutes(-5) };
        var po3 = new PurchaseOrder { Id = Guid.NewGuid(), FacilityId = facility2, SupplierId = supplier1, Status = PurchaseOrderStatus.Approved, RequestedAt = DateTime.UtcNow };

        _dbContext.PurchaseOrders.AddRange(po1, po2, po3);
        await _dbContext.SaveChangesAsync();

        var service = CreateService();

        var all = await service.GetAllAsync(CancellationToken.None);
        Assert.Equal(3, all.Count);

        var byFacility = await service.GetAllAsync(facility1, null, null, CancellationToken.None);
        Assert.Equal(2, byFacility.Count);

        var byStatus = await service.GetAllAsync(null, PurchaseOrderStatus.Approved, null, CancellationToken.None);
        Assert.Single(byStatus);
        Assert.Equal(po3.Id, byStatus[0].Id);

        var bySupplier = await service.GetAllAsync(null, null, supplier2, CancellationToken.None);
        Assert.Single(bySupplier);
        Assert.Equal(po2.Id, bySupplier[0].Id);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenIdIsEmptyOrNotFound()
    {
        var service = CreateService();

        var emptyResult = await service.GetByIdAsync(Guid.Empty, CancellationToken.None);
        Assert.Null(emptyResult);

        var notFoundResult = await service.GetByIdAsync(Guid.NewGuid(), CancellationToken.None);
        Assert.Null(notFoundResult);
    }

    [Fact]
    public async Task SubmitAsync_TransitionsDraftToPendingApproval()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.Draft,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 15m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var result = await service.SubmitAsync(po.Id, CancellationToken.None);

        Assert.Equal(PurchaseOrderStatus.PendingApproval.ToString(), result.Status);
    }

    [Fact]
    public async Task SubmitAsync_TransitionsRevisionRequiredToPendingApproval()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.RevisionRequired,
            RevisionReason = "Needs price adjustment",
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 15m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var result = await service.SubmitAsync(po.Id, CancellationToken.None);

        Assert.Equal(PurchaseOrderStatus.PendingApproval.ToString(), result.Status);
    }

    [Fact]
    public async Task SubmitAsync_ThrowsProcurementException_WhenOrderNotInDraftOrRevision()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var service = CreateService();

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.Approved,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 15m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.SubmitAsync(po.Id, CancellationToken.None));

        Assert.Equal("INVALID_PURCHASE_ORDER_STATE", ex.Code);
    }

    [Fact]
    public async Task ApproveAsync_TransitionsPendingToApproved_AndSetsApproverInfo()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var approverId = Guid.NewGuid();
        var service = CreateService(approverId);

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.PendingApproval,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 15m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var result = await service.ApproveAsync(po.Id, CancellationToken.None);

        Assert.Equal(PurchaseOrderStatus.Approved.ToString(), result.Status);
        Assert.NotNull(result.ApprovedAt);
        Assert.Equal(approverId, result.ApprovedById);
        Assert.Null(result.RejectionReason);
        Assert.Null(result.RevisionReason);
    }

    [Fact]
    public async Task RejectAsync_ThrowsProcurementException_WhenReasonIsMissing()
    {
        var service = CreateService();

        var ex = await Assert.ThrowsAsync<ProcurementException>(
            () => service.RejectAsync(Guid.NewGuid(), new PurchaseOrderWorkflowRequest("   "), CancellationToken.None));

        Assert.Equal("REASON_REQUIRED", ex.Code);
    }

    [Fact]
    public async Task RejectAsync_TransitionsPendingToRejected_AndRecordsReasonAndApprover()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var approverId = Guid.NewGuid();
        var service = CreateService(approverId);

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.PendingApproval,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 15m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var result = await service.RejectAsync(
            po.Id,
            new PurchaseOrderWorkflowRequest("Budget exceeded for this quarter."),
            CancellationToken.None);

        Assert.Equal(PurchaseOrderStatus.Rejected.ToString(), result.Status);
        Assert.Equal("Budget exceeded for this quarter.", result.RejectionReason);
        Assert.Equal(approverId, result.ApprovedById);
    }

    [Fact]
    public async Task RequestRevisionAsync_TransitionsPendingToRevisionRequired_AndRecordsReason()
    {
        var (facilityId, medicineId) = await SeedFacilityAndMedicineAsync();
        var supplierId = await SeedSupplierAsync();
        var approverId = Guid.NewGuid();
        var service = CreateService(approverId);

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.PendingApproval,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 15m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var result = await service.RequestRevisionAsync(
            po.Id,
            new PurchaseOrderWorkflowRequest("Please renegotiate unit price."),
            CancellationToken.None);

        Assert.Equal(PurchaseOrderStatus.RevisionRequired.ToString(), result.Status);
        Assert.Equal("Please renegotiate unit price.", result.RevisionReason);
        Assert.Equal(approverId, result.ApprovedById);
    }

    // Helper methods

    private ProcurementService CreateService(Guid? currentUserId = null)
    {
        var currentUserService = CreateCurrentUserService(currentUserId);
        return new ProcurementService(_dbContext, currentUserService);
    }

    private static CurrentUserService CreateCurrentUserService(Guid? userId)
    {
        var httpContext = new DefaultHttpContext();
        if (userId.HasValue)
        {
            httpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                        new Claim(ClaimTypes.Email, "test@medistock.com")
                    ],
                    authenticationType: "Test"));
        }

        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        return new CurrentUserService(httpContextAccessor);
    }

    private async Task<(Guid FacilityId, Guid MedicineId)> SeedFacilityAndMedicineAsync()
    {
        var facility = new Facility
        {
            Id = Guid.NewGuid(),
            Name = "Colombo National Hospital",
            Code = "CNH-01",
            Address = "Colombo",
            IsActive = true
        };

        var medicine = new Medicine
        {
            Id = Guid.NewGuid(),
            Name = "Paracetamol 500mg",
            Code = "MED-001",
            Unit = "Tablet",
            MinimumStockLevel = 100,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Facilities.Add(facility);
        _dbContext.Medicines.Add(medicine);
        await _dbContext.SaveChangesAsync();

        return (facility.Id, medicine.Id);
    }

    private async Task<Guid> SeedSupplierAsync()
    {
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = "State Pharmaceuticals Corporation",
            ContactPerson = "John Doe",
            Email = "spc@gov.lk",
            Phone = "0112345678",
            Address = "Colombo 01",
            LeadTimeDays = 5,
            IsActive = true
        };

        _dbContext.Suppliers.Add(supplier);
        await _dbContext.SaveChangesAsync();

        return supplier.Id;
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        _connection.Dispose();
    }
}
