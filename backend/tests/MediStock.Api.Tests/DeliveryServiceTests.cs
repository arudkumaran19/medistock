using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Procurement.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement;

namespace MediStock.Api.Tests;

public sealed class DeliveryServiceTests
{
    private static (
        ApplicationDbContext Db,
        DeliveryService DeliveryService,
        Guid PurchaseOrderId,
        Guid MedicineId,
        Guid FacilityId)
        Create()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var db = new ApplicationDbContext(options);

        var supplierId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var purchaseOrderId = Guid.NewGuid();

        db.Suppliers.Add(new Supplier
        {
            Id = supplierId,
            Name = "Test Supplier",
            ContactPerson = "Test Contact",
            Email = "supplier@test.com",
            Phone = "0770000000",
            Address = "Test Address",
            LeadTimeDays = 7,
            IsActive = true
        });

        db.Facilities.Add(new Facility
        {
            Id = facilityId,
            Code = "TEST-F",
            Name = "Test Facility"
        });

        db.Medicines.Add(new Medicine
        {
            Id = medicineId,
            Code = "TEST-001",
            Name = "Test Medicine",
            Unit = "tablet",
            MinimumStockLevel = 10,
            IsActive = true
        });

        db.PurchaseOrders.Add(new PurchaseOrder
        {
            Id = purchaseOrderId,
            SupplierId = supplierId,
            FacilityId = facilityId,
            Status = PurchaseOrderStatus.Approved,
            RequestedAt = DateTime.UtcNow.AddDays(-2),
            ApprovedAt = DateTime.UtcNow.AddDays(-1),
            Items = new List<PurchaseOrderItem>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    PurchaseOrderId = purchaseOrderId,
                    MedicineId = medicineId,
                    RequestedQuantity = 20,
                    UnitPrice = 100
                }
            }
        });

        db.SaveChanges();

        var inventoryService = new InventoryService(db);

        var deliveryService = new DeliveryService(
            db,
            inventoryService);

        return (
            db,
            deliveryService,
            purchaseOrderId,
            medicineId,
            facilityId);
    }

    private static DeliveryRequest ValidDeliveryRequest(
        Guid medicineId,
        int quantity = 20)
    {
        return new DeliveryRequest(
            ExpectedAt: DateTime.UtcNow.AddDays(2),
            TrackingNumber: "TRACK-001",
            Notes: "Test delivery",
            Items: new List<DeliveryItemRequest>
            {
                new(
                    MedicineId: medicineId,
                    Quantity: quantity,
                    BatchNumber: "BATCH-001",
                    ExpiryDateUtc: DateTime.UtcNow.AddDays(365),
                    ManufacturingDateUtc: DateTime.UtcNow.AddDays(-30))
            });
    }

    [Fact]
    public async Task Create_creates_pending_delivery_for_approved_purchase_order()
    {
        var (
            db,
            deliveryService,
            purchaseOrderId,
            _,
            _) = Create();

        var request = new DeliveryRequest(
            ExpectedAt: DateTime.UtcNow.AddDays(2),
            TrackingNumber: "TRACK-001",
            Notes: "Test delivery",
            Items: null);

        var result = await deliveryService.CreateAsync(
            purchaseOrderId,
            request,
            default);

        Assert.Equal(purchaseOrderId, result.PurchaseOrderId);
        Assert.Equal("Pending", result.Status);
        Assert.Equal("TRACK-001", result.TrackingNumber);
        Assert.Equal("Test delivery", result.Notes);

        Assert.Equal(
            1,
            await db.Deliveries.CountAsync());
    }

    [Fact]
    public async Task Create_rejects_delivery_for_unapproved_purchase_order()
    {
        var (
            db,
            deliveryService,
            purchaseOrderId,
            _,
            _) = Create();

        var purchaseOrder = await db.PurchaseOrders
            .SingleAsync(x => x.Id == purchaseOrderId);

        purchaseOrder.Status = PurchaseOrderStatus.Draft;

        await db.SaveChangesAsync();

        var request = new DeliveryRequest(
            null,
            null,
            null,
            null);

        var error = await Assert.ThrowsAsync<ProcurementException>(
            () => deliveryService.CreateAsync(
                purchaseOrderId,
                request,
                default));

        Assert.Equal(
            "PURCHASE_ORDER_NOT_APPROVED",
            error.Code);
    }

    [Fact]
    public async Task Create_rejects_second_active_delivery_for_same_purchase_order()
    {
        var (
            _,
            deliveryService,
            purchaseOrderId,
            _,
            _) = Create();

        var request = ValidDeliveryRequest(
            Guid.NewGuid());

        // We only need CreateAsync here, so Items are not validated.
        await deliveryService.CreateAsync(
            purchaseOrderId,
            request,
            default);

        var error = await Assert.ThrowsAsync<ProcurementException>(
            () => deliveryService.CreateAsync(
                purchaseOrderId,
                request,
                default));

        Assert.Equal(
            "DELIVERY_ALREADY_EXISTS",
            error.Code);
    }

    [Fact]
    public async Task Delivering_stock_increases_inventory_quantity()
    {
        var (
            db,
            deliveryService,
            purchaseOrderId,
            medicineId,
            facilityId) = Create();

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            ValidDeliveryRequest(medicineId, 20),
            default);

        var result = await deliveryService.UpdateStatusAsync(
            delivery.Id,
            DeliveryStatus.Delivered,
            ValidDeliveryRequest(medicineId, 20),
            default);

        Assert.Equal(
            "Delivered",
            result.Status);

        var balance = await db.InventoryBalances
            .SingleAsync(x =>
                x.MedicineId == medicineId &&
                x.FacilityId == facilityId);

        Assert.Equal(
            20,
            balance.QuantityOnHand);
    }

    [Fact]
    public async Task Delivering_stock_creates_inventory_batch()
    {
        var (
            db,
            deliveryService,
            purchaseOrderId,
            medicineId,
            facilityId) = Create();

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            ValidDeliveryRequest(medicineId, 20),
            default);

        await deliveryService.UpdateStatusAsync(
            delivery.Id,
            DeliveryStatus.Delivered,
            ValidDeliveryRequest(medicineId, 20),
            default);

        var batch = await db.MedicineBatches
            .SingleAsync();

        Assert.Equal(
            medicineId,
            batch.MedicineId);

        Assert.Equal(
            facilityId,
            batch.FacilityId);

        Assert.Equal(
            "BATCH-001",
            batch.BatchNumber);

        Assert.Equal(
            20,
            batch.QuantityOnHand);
    }

    [Fact]
    public async Task Delivering_stock_creates_receipt_audit_transaction()
    {
        var (
            db,
            deliveryService,
            purchaseOrderId,
            medicineId,
            facilityId) = Create();

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            ValidDeliveryRequest(medicineId, 20),
            default);

        await deliveryService.UpdateStatusAsync(
            delivery.Id,
            DeliveryStatus.Delivered,
            ValidDeliveryRequest(medicineId, 20),
            default);

        var transaction = await db.StockTransactions
            .SingleAsync();

        Assert.Equal(
            medicineId,
            transaction.MedicineId);

        Assert.Equal(
            facilityId,
            transaction.FacilityId);

        Assert.Equal(
            StockTransactionType.Receipt,
            transaction.Type);

        Assert.Equal(
            20,
            transaction.Quantity);

        Assert.Equal(
            20,
            transaction.BalanceAfter);
    }

    [Fact]
    public async Task Delivering_stock_marks_purchase_order_as_received()
    {
        var (
            db,
            deliveryService,
            purchaseOrderId,
            medicineId,
            _) = Create();

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            ValidDeliveryRequest(medicineId),
            default);

        await deliveryService.UpdateStatusAsync(
            delivery.Id,
            DeliveryStatus.Delivered,
            ValidDeliveryRequest(medicineId),
            default);

        var purchaseOrder = await db.PurchaseOrders
            .SingleAsync(x => x.Id == purchaseOrderId);

        Assert.Equal(
            PurchaseOrderStatus.Received,
            purchaseOrder.Status);

        Assert.NotNull(
            purchaseOrder.ReceivedAt);
    }

    [Fact]
    public async Task Delivering_stock_sets_delivery_delivered_at()
    {
        var (
            db,
            deliveryService,
            purchaseOrderId,
            medicineId,
            _) = Create();

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            ValidDeliveryRequest(medicineId),
            default);

        var result = await deliveryService.UpdateStatusAsync(
            delivery.Id,
            DeliveryStatus.Delivered,
            ValidDeliveryRequest(medicineId),
            default);

        Assert.Equal(
            "Delivered",
            result.Status);

        Assert.NotNull(
            result.DeliveredAt);
    }

    [Fact]
    public async Task Delivering_without_items_is_rejected()
    {
        var (
            _,
            deliveryService,
            purchaseOrderId,
            _,
            _) = Create();

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            new DeliveryRequest(
                null,
                null,
                null,
                null),
            default);

        var error = await Assert.ThrowsAsync<ProcurementException>(
            () => deliveryService.UpdateStatusAsync(
                delivery.Id,
                DeliveryStatus.Delivered,
                new DeliveryRequest(
                    null,
                    null,
                    null,
                    null),
                default));

        Assert.Equal(
            "DELIVERY_ITEMS_REQUIRED",
            error.Code);
    }

    [Fact]
    public async Task Delivering_wrong_quantity_is_rejected()
    {
        var (
            _,
            deliveryService,
            purchaseOrderId,
            medicineId,
            _) = Create();

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            ValidDeliveryRequest(medicineId),
            default);

        var request = ValidDeliveryRequest(
            medicineId,
            19);

        var error = await Assert.ThrowsAsync<ProcurementException>(
            () => deliveryService.UpdateStatusAsync(
                delivery.Id,
                DeliveryStatus.Delivered,
                request,
                default));

        Assert.Equal(
            "DELIVERY_QUANTITY_MISMATCH",
            error.Code);
    }

    [Fact]
    public async Task Delivered_delivery_cannot_be_completed_again()
    {
        var (
            _,
            deliveryService,
            purchaseOrderId,
            medicineId,
            _) = Create();

        var request = ValidDeliveryRequest(
            medicineId,
            20);

        var delivery = await deliveryService.CreateAsync(
            purchaseOrderId,
            request,
            default);

        await deliveryService.UpdateStatusAsync(
            delivery.Id,
            DeliveryStatus.Delivered,
            request,
            default);

        var error = await Assert.ThrowsAsync<ProcurementException>(
            () => deliveryService.UpdateStatusAsync(
                delivery.Id,
                DeliveryStatus.Delivered,
                request,
                default));

        Assert.Equal(
            "DELIVERY_ALREADY_COMPLETED",
            error.Code);
    }
}