using MediStock.Api.Controllers;
using MediStock.Api.Domain.Entities;
using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Procurement.Services;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace MediStock.UnitTests;

public sealed class ApprovalControllerTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _dbContext;
    private readonly Guid _approverId = Guid.NewGuid();

    public ApprovalControllerTests()
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
    public async Task GetPendingApprovals_ReturnsOnlyPendingOrders()
    {
        var (facilityId, supplierId, medicineId) = await SeedDataAsync();
        var po1 = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.PendingApproval,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 50m }]
        };
        var po2 = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.Draft,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 5, UnitPrice = 20m }]
        };
        _dbContext.PurchaseOrders.AddRange(po1, po2);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.GetPendingApprovals(facilityId, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var orders = Assert.IsAssignableFrom<IReadOnlyList<PurchaseOrderResponse>>(okResult.Value);
        Assert.Single(orders);
        Assert.Equal(po1.Id, orders[0].Id);
    }

    [Fact]
    public async Task Approve_ReturnsApprovedOrderWithApproverDetails()
    {
        var (facilityId, supplierId, medicineId) = await SeedDataAsync();
        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.PendingApproval,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 50m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.Approve(po.Id, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<PurchaseOrderResponse>(okResult.Value);
        Assert.Equal(PurchaseOrderStatus.Approved.ToString(), response.Status);
        Assert.Equal(_approverId, response.ApprovedById);
        Assert.NotNull(response.ApprovedAt);
    }

    [Fact]
    public async Task Reject_ReturnsRejectedOrderWithReason()
    {
        var (facilityId, supplierId, medicineId) = await SeedDataAsync();
        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.PendingApproval,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 50m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.Reject(
            po.Id,
            new PurchaseOrderWorkflowRequest("Unapproved high-cost item requested."),
            CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<PurchaseOrderResponse>(okResult.Value);
        Assert.Equal(PurchaseOrderStatus.Rejected.ToString(), response.Status);
        Assert.Equal("Unapproved high-cost item requested.", response.RejectionReason);
        Assert.Equal(_approverId, response.ApprovedById);
    }

    [Fact]
    public async Task RequestRevision_ReturnsRevisionRequiredOrderWithReason()
    {
        var (facilityId, supplierId, medicineId) = await SeedDataAsync();
        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            SupplierId = supplierId,
            Status = PurchaseOrderStatus.PendingApproval,
            RequestedAt = DateTime.UtcNow,
            Items = [new PurchaseOrderItem { Id = Guid.NewGuid(), MedicineId = medicineId, RequestedQuantity = 10, UnitPrice = 50m }]
        };
        _dbContext.PurchaseOrders.Add(po);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        var result = await controller.RequestRevision(
            po.Id,
            new PurchaseOrderWorkflowRequest("Quantity exceeds monthly quota; revise to 5 units."),
            CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<PurchaseOrderResponse>(okResult.Value);
        Assert.Equal(PurchaseOrderStatus.RevisionRequired.ToString(), response.Status);
        Assert.Equal("Quantity exceeds monthly quota; revise to 5 units.", response.RevisionReason);
        Assert.Equal(_approverId, response.ApprovedById);
    }

    private ApprovalController CreateController()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, _approverId.ToString()),
                    new Claim(ClaimTypes.Email, "approver@medistock.com")
                ],
                authenticationType: "Test"));

        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var currentUserService = new CurrentUserService(httpContextAccessor);
        var procurementService = new ProcurementService(_dbContext, currentUserService);

        return new ApprovalController(procurementService);
    }

    private async Task<(Guid FacilityId, Guid SupplierId, Guid MedicineId)> SeedDataAsync()
    {
        var facility = new Facility
        {
            Id = Guid.NewGuid(),
            Name = "General Hospital",
            Code = "GH-01",
            Address = "Colombo",
            IsActive = true
        };

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = "PharmaCare Ltd",
            ContactPerson = "Sam",
            Email = "sam@pharma.com",
            Phone = "0112345678",
            Address = "Colombo 03",
            LeadTimeDays = 3,
            IsActive = true
        };

        var medicine = new Medicine
        {
            Id = Guid.NewGuid(),
            Name = "Amoxicillin 500mg",
            Code = "MED-AMOX",
            Unit = "Capsule",
            MinimumStockLevel = 50,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Facilities.Add(facility);
        _dbContext.Suppliers.Add(supplier);
        _dbContext.Medicines.Add(medicine);
        await _dbContext.SaveChangesAsync();

        return (facility.Id, supplier.Id, medicine.Id);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        _connection.Dispose();
    }
}
