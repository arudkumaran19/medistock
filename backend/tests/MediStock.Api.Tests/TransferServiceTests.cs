using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using MediStock.Api.Data;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Redistribution.Validators;
using Microsoft.Extensions.DependencyInjection;
using MediStock.Api.Common;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Services;

namespace MediStock.Api.Tests;

public class TransferServiceTests
{
    private MediStockDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<MediStockDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new MediStockDbContext(options);
    }

    [Fact]
    public async Task FullLifecycle_EndToEnd_MaintainsInventoryAndAuditHistory()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();

        var destFacilityId = Guid.NewGuid();
        var sourceFacilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        // Seed Facilities
        var destFacility = new Facility
        {
            Id = destFacilityId,
            Name = "Karapitiya Teaching Hospital",
            FacilityCode = "FAC-GAL",
            Latitude = 6.06,
            Longitude = 80.22,
            IsActive = true
        };
        var sourceFacility = new Facility
        {
            Id = sourceFacilityId,
            Name = "National Hospital Colombo",
            FacilityCode = "FAC-COL",
            Latitude = 6.91,
            Longitude = 79.86,
            IsActive = true
        };

        db.Facilities.AddRange(destFacility, sourceFacility);

        // Seed Medicine
        db.Medicines.Add(new Medicine
        {
            Id = medicineId,
            Name = "Amoxicillin 500mg",
            GenericName = "Amoxicillin",
            Sku = "MED-AMX-TEST-01",
            UnitOfMeasure = "capsules",
            Category = "Antibiotics",
            IsActive = true
        });

        // Seed Source Inventory (Stock: 1000, Safety: 200, Reserved: 0 -> Surplus: 800)
        var sourceInventory = new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = sourceFacilityId,
            MedicineId = medicineId,
            StockOnHand = 1000,
            SafetyStockThreshold = 200,
            ReservedStock = 0,
            BatchNumber = "BAT-TEST-01",
            ExpiryDate = DateTime.UtcNow.AddYears(1)
        };
        db.FacilityInventories.Add(sourceInventory);
        await db.SaveChangesAsync();

        var routingMock = new Mock<IRoutingService>();
        routingMock.Setup(r => r.CalculateRouteAsync(It.IsAny<Facility>(), It.IsAny<Facility>(), default))
            .ReturnsAsync(new RouteResponse
            {
                DistanceKm = 125m,
                DurationMinutes = 115m,
                Provider = "MockRoute"
            });

        var candidateMock = new Mock<ICandidateFacilityService>();
        var validator = new TransferValidator();
        var loggerMock = new Mock<ILogger<TransferService>>();

        var service = new TransferService(db, routingMock.Object, candidateMock.Object, validator, loggerMock.Object);

        // 1. Create Transfer Request (Draft)
        var createRequest = new CreateTransferRequest
        {
            DestinationFacilityId = destFacilityId,
            SourceFacilityId = sourceFacilityId,
            Priority = TransferPriority.High,
            Notes = "Shortage in intensive care",
            Items = new List<CreateTransferItemDto>
            {
                new()
                {
                    MedicineId = medicineId,
                    MedicineName = "Amoxicillin 500mg",
                    RequestedQuantity = 300,
                    UnitOfMeasure = "capsules"
                }
            }
        };

        var createResult = await service.CreateTransferAsync(createRequest, userId);
        createResult.Success.Should().BeTrue();
        var transferId = createResult.Data!.Id;
        createResult.Data.Status.Should().Be(TransferStatus.Draft);
        createResult.Data.EstimatedDistanceKm.Should().Be(125m);

        // 2. Submit Transfer Request (Draft -> Requested)
        var submitResult = await service.SubmitTransferRequestAsync(transferId, userId, "Ready for supervisor approval");
        submitResult.Success.Should().BeTrue();
        submitResult.Data!.Status.Should().Be(TransferStatus.Requested);

        // 3. Approve Transfer Request internally (Requested -> Approved)
        var approveResult = await service.ApproveTransferInternalAsync(transferId, userId, "Approved by Central Coordinator");
        approveResult.Success.Should().BeTrue();
        approveResult.Data!.Status.Should().Be(TransferStatus.Approved);

        // 4. Reserve Inventory at Source (Approved -> Reserved)
        var transferItem = approveResult.Data.Items.First();
        var reserveRequest = new ReserveTransferRequest
        {
            UserId = userId,
            Notes = "Reserved from shelf A3",
            ItemAllocations = new List<ReserveItemAllocationDto>
            {
                new()
                {
                    TransferItemId = transferItem.Id,
                    AllocatedQuantity = 300,
                    BatchNumber = "BAT-TEST-01"
                }
            }
        };

        var reserveResult = await service.ReserveTransferAsync(transferId, reserveRequest);
        reserveResult.Success.Should().BeTrue();
        reserveResult.Data!.Status.Should().Be(TransferStatus.Reserved);

        // Verify inventory locked: ReservedStock should be 300
        var updatedSourceInv = await db.FacilityInventories.FirstAsync(fi => fi.Id == sourceInventory.Id);
        updatedSourceInv.ReservedStock.Should().Be(300);

        // 5. Receive Transfer at Destination (Dispatched -> Received)
        // Note: For receiving, we simulate dispatch first
        var transferEntity = await db.TransferRequests.FirstAsync(t => t.Id == transferId);
        transferEntity.Status = TransferStatus.Dispatched;
        transferEntity.DispatchedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var receiveRequest = new ReceiveTransferRequest
        {
            ReceivedByUserId = userId,
            Notes = "Verified all 300 units intact",
            VerifiedItems = new List<ReceiveItemVerificationDto>
            {
                new()
                {
                    TransferItemId = transferItem.Id,
                    ReceivedQuantity = 300,
                    BatchNumber = "BAT-TEST-01"
                }
            }
        };

        var receiveResult = await service.ReceiveTransferAsync(transferId, receiveRequest);
        receiveResult.Success.Should().BeTrue();
        receiveResult.Data!.Status.Should().Be(TransferStatus.Received);
        receiveResult.Data.ReceivedAt.Should().NotBeNull();

        // Verify final inventory state:
        // Source Stock: was 1000, now 700. Source Reserved: was 300, now 0.
        var finalSourceInv = await db.FacilityInventories.FirstAsync(fi => fi.Id == sourceInventory.Id);
        finalSourceInv.StockOnHand.Should().Be(700);
        finalSourceInv.ReservedStock.Should().Be(0);

        // Destination Stock: should now have 300
        var destInv = await db.FacilityInventories.FirstOrDefaultAsync(fi => fi.FacilityId == destFacilityId && fi.MedicineId == medicineId);
        destInv.Should().NotBeNull();
        destInv!.StockOnHand.Should().Be(300);

        // Verify Audit Status History ledger
        var finalTransfer = await service.GetTransferByIdAsync(transferId);
        finalTransfer!.StatusHistory.Should().HaveCountGreaterOrEqualTo(4);
    }

    [Fact]
    public async Task ReceiveTransfer_WithFlatPayload_SucceedsAndUpdatesInventory()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();
        var destFacilityId = Guid.NewGuid();
        var sourceFacilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Facilities.AddRange(
            new Facility { Id = destFacilityId, Name = "Dest Facility", FacilityCode = "DF-01", Latitude = 6.9, Longitude = 79.8, IsActive = true },
            new Facility { Id = sourceFacilityId, Name = "Source Facility", FacilityCode = "SF-01", Latitude = 7.2, Longitude = 80.6, IsActive = true });

        db.Medicines.Add(new Medicine
        {
            Id = medicineId,
            Name = "Paracetamol 500mg",
            GenericName = "Paracetamol",
            Sku = "MED-PARA-01",
            Category = "Analgesic",
            UnitOfMeasure = "tablets",
            IsActive = true
        });

        var sourceInventory = new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = sourceFacilityId,
            MedicineId = medicineId,
            StockOnHand = 500,
            SafetyStockThreshold = 50,
            ReservedStock = 200,
            BatchNumber = "BAT-SRC-01",
            ExpiryDate = DateTime.UtcNow.AddYears(1),
            UpdatedAt = DateTime.UtcNow
        };
        db.FacilityInventories.Add(sourceInventory);

        var transferItem = new TransferItem
        {
            Id = Guid.NewGuid(),
            MedicineId = medicineId,
            MedicineName = "Paracetamol 500mg",
            RequestedQuantity = 200,
            AllocatedQuantity = 200,
            UnitOfMeasure = "tablets"
        };

        var transfer = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-FLAT-001",
            SourceFacilityId = sourceFacilityId,
            DestinationFacilityId = destFacilityId,
            Status = TransferStatus.Dispatched,
            DispatchedAt = DateTime.UtcNow,
            Priority = TransferPriority.High,
            RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = new List<TransferItem> { transferItem }
        };
        db.TransferRequests.Add(transfer);
        await db.SaveChangesAsync();

        var routingMock = new Mock<IRoutingService>();
        var candidateMock = new Mock<ICandidateFacilityService>();
        var validator = new TransferValidator();
        var loggerMock = new Mock<ILogger<TransferService>>();
        var service = new TransferService(db, routingMock.Object, candidateMock.Object, validator, loggerMock.Object);

        // Act - Send flat fields as Flutter does
        var flatReceiveRequest = new ReceiveTransferRequest
        {
            ReceivedByUserId = userId,
            ReceivedQuantity = 195,
            BatchNumber = "BAT-SRC-01",
            DiscrepancyReason = "5 damaged in transit",
            Notes = "Verified on mobile app"
        };

        var receiveResult = await service.ReceiveTransferAsync(transfer.Id, flatReceiveRequest);

        // Assert
        receiveResult.Success.Should().BeTrue();
        receiveResult.Data!.Status.Should().Be(TransferStatus.Received);
        receiveResult.Data.ReceivedAt.Should().NotBeNull();

        // Source inventory decremented
        var updatedSourceInv = await db.FacilityInventories.FirstAsync(fi => fi.Id == sourceInventory.Id);
        updatedSourceInv.StockOnHand.Should().Be(300); // 500 - 200 allocated
        updatedSourceInv.ReservedStock.Should().Be(0);   // 200 - 200

        // Destination inventory created with received quantity 195
        var destInv = await db.FacilityInventories.FirstOrDefaultAsync(fi => fi.FacilityId == destFacilityId && fi.MedicineId == medicineId);
        destInv.Should().NotBeNull();
        destInv!.StockOnHand.Should().Be(195);
    }

    [Fact]
    public async Task ReserveTransfer_WhenAllocatedQuantityExceedsSurplus_FailsAndDoesNotLockInventory()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();

        var destFacilityId = Guid.NewGuid();
        var sourceFacilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Facilities.AddRange(
            new Facility { Id = destFacilityId, Name = "Dest", FacilityCode = "D1", Latitude = 6, Longitude = 80, IsActive = true },
            new Facility { Id = sourceFacilityId, Name = "Source", FacilityCode = "S1", Latitude = 7, Longitude = 80, IsActive = true });

        // Seed Medicine
        db.Medicines.Add(new Medicine
        {
            Id = medicineId,
            Name = "Med",
            GenericName = "Med",
            Sku = "MED-TEST-02",
            UnitOfMeasure = "tablets",
            Category = "General",
            IsActive = true
        });

        // Available surplus = 500 - 450 - 0 = 50 units
        db.FacilityInventories.Add(new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = sourceFacilityId,
            MedicineId = medicineId,
            StockOnHand = 500,
            SafetyStockThreshold = 450,
            ReservedStock = 0
        });
        await db.SaveChangesAsync();

        var routingMock = new Mock<IRoutingService>();
        routingMock.Setup(r => r.CalculateRouteAsync(It.IsAny<Facility>(), It.IsAny<Facility>(), default))
            .ReturnsAsync(new RouteResponse { DistanceKm = 20m, DurationMinutes = 25m, Provider = "Mock" });

        var service = new TransferService(
            db,
            routingMock.Object,
            new Mock<ICandidateFacilityService>().Object,
            new TransferValidator(),
            new Mock<ILogger<TransferService>>().Object);

        // Create & Approve transfer
        var createResult = await service.CreateTransferAsync(new CreateTransferRequest
        {
            DestinationFacilityId = destFacilityId,
            SourceFacilityId = sourceFacilityId,
            Items = new List<CreateTransferItemDto>
            {
                new() { MedicineId = medicineId, MedicineName = "Med", RequestedQuantity = 200 }
            }
        }, userId);

        await service.SubmitTransferRequestAsync(createResult.Data!.Id, userId);
        await service.ApproveTransferInternalAsync(createResult.Data.Id, userId);

        // Act: Attempt to reserve 100 units when surplus is only 50
        var reserveResult = await service.ReserveTransferAsync(createResult.Data.Id, new ReserveTransferRequest
        {
            UserId = userId,
            ItemAllocations = new List<ReserveItemAllocationDto>
            {
                new() { TransferItemId = createResult.Data.Items.First().Id, AllocatedQuantity = 100 }
            }
        });

        // Assert: Must fail gracefully and leave ReservedStock at 0
        reserveResult.Success.Should().BeFalse();
        reserveResult.Message.Should().Contain("Available surplus at source is only 50 units");

        var sourceInv = await db.FacilityInventories.FirstAsync(fi => fi.FacilityId == sourceFacilityId);
        sourceInv.ReservedStock.Should().Be(0);
    }

    [Fact]
    public async Task ReserveTransfer_WithFlatPayload_SucceedsAndLocksInventory()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();

        var destFacilityId = Guid.NewGuid();
        var sourceFacilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Facilities.AddRange(
            new Facility { Id = destFacilityId, Name = "Dest", FacilityCode = "D1", Latitude = 6, Longitude = 80, IsActive = true },
            new Facility { Id = sourceFacilityId, Name = "Source", FacilityCode = "S1", Latitude = 7, Longitude = 80, IsActive = true });

        db.Medicines.Add(new Medicine
        {
            Id = medicineId,
            Name = "Amoxicillin 500mg",
            GenericName = "Amoxicillin",
            Sku = "MED-AMX-01",
            UnitOfMeasure = "capsules",
            Category = "Antibiotics",
            IsActive = true
        });

        // Surplus = 1000 - 200 - 0 = 800
        db.FacilityInventories.Add(new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = sourceFacilityId,
            MedicineId = medicineId,
            StockOnHand = 1000,
            SafetyStockThreshold = 200,
            ReservedStock = 0,
            BatchNumber = "BAT-SRC-99"
        });
        await db.SaveChangesAsync();

        var service = new TransferService(
            db,
            new Mock<IRoutingService>().Object,
            new Mock<ICandidateFacilityService>().Object,
            new TransferValidator(),
            new Mock<ILogger<TransferService>>().Object);

        var createResult = await service.CreateTransferAsync(new CreateTransferRequest
        {
            DestinationFacilityId = destFacilityId,
            SourceFacilityId = sourceFacilityId,
            Items = new List<CreateTransferItemDto>
            {
                new() { MedicineId = medicineId, MedicineName = "Amoxicillin 500mg", RequestedQuantity = 200 }
            }
        }, userId);

        await service.SubmitTransferRequestAsync(createResult.Data!.Id, userId);
        await service.ApproveTransferInternalAsync(createResult.Data.Id, userId);

        // Act: Reserve with flat-field payload as sent by React web frontend
        var reserveResult = await service.ReserveTransferAsync(createResult.Data.Id, new ReserveTransferRequest
        {
            UserId = userId,
            SourceFacilityId = sourceFacilityId,
            MedicineId = medicineId,
            QuantityToReserve = 200,
            Notes = "Managerial stock reservation locked via portal."
        });

        // Assert
        reserveResult.Success.Should().BeTrue();
        reserveResult.Data!.Status.Should().Be(TransferStatus.Reserved);
        reserveResult.Data.Items.First().AllocatedQuantity.Should().Be(200);

        var sourceInv = await db.FacilityInventories.FirstAsync(fi => fi.FacilityId == sourceFacilityId);
        sourceInv.ReservedStock.Should().Be(200);
    }

    [Fact]
    public async Task ReceiveTransfer_WhenAllocatedQuantityIsZero_FallsBackToRequestedQuantityForSourceDeduction()
    {
        // Arrange: Simulate a transfer where reservation was bypassed or broken (AllocatedQuantity is 0)
        using var db = CreateInMemoryDbContext();

        var destFacilityId = Guid.NewGuid();
        var sourceFacilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Facilities.AddRange(
            new Facility { Id = destFacilityId, Name = "Dest Facility", FacilityCode = "DF-01", Latitude = 6.9, Longitude = 79.8, IsActive = true },
            new Facility { Id = sourceFacilityId, Name = "Source Facility", FacilityCode = "SF-01", Latitude = 7.2, Longitude = 80.6, IsActive = true });

        db.Medicines.Add(new Medicine
        {
            Id = medicineId,
            Name = "Amoxicillin 500mg",
            GenericName = "Amoxicillin",
            Sku = "MED-AMX-01",
            UnitOfMeasure = "capsules",
            Category = "Antibiotics",
            IsActive = true
        });

        var sourceInventory = new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = sourceFacilityId,
            MedicineId = medicineId,
            StockOnHand = 600,
            SafetyStockThreshold = 100,
            ReservedStock = 0,
            BatchNumber = "BAT-ZERO-01",
            ExpiryDate = DateTime.UtcNow.AddYears(1)
        };
        db.FacilityInventories.Add(sourceInventory);

        var transferItem = new TransferItem
        {
            Id = Guid.NewGuid(),
            MedicineId = medicineId,
            MedicineName = "Amoxicillin 500mg",
            RequestedQuantity = 150,
            AllocatedQuantity = 0, // AllocatedQuantity is 0 because reservation was broken
            UnitOfMeasure = "capsules"
        };

        var transfer = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-ZERO-ALLOC-001",
            SourceFacilityId = sourceFacilityId,
            DestinationFacilityId = destFacilityId,
            Status = TransferStatus.Dispatched,
            DispatchedAt = DateTime.UtcNow,
            Priority = TransferPriority.Medium,
            RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = new List<TransferItem> { transferItem }
        };
        db.TransferRequests.Add(transfer);
        await db.SaveChangesAsync();

        var service = new TransferService(
            db,
            new Mock<IRoutingService>().Object,
            new Mock<ICandidateFacilityService>().Object,
            new TransferValidator(),
            new Mock<ILogger<TransferService>>().Object);

        // Act: Receive transfer
        var receiveRequest = new ReceiveTransferRequest
        {
            ReceivedByUserId = userId,
            ReceivedQuantity = 150,
            BatchNumber = "BAT-ZERO-01",
            Notes = "Received 150 units"
        };

        var result = await service.ReceiveTransferAsync(transfer.Id, receiveRequest);

        // Assert: Source inventory must be decremented by RequestedQuantity (150)
        result.Success.Should().BeTrue();
        var updatedSourceInv = await db.FacilityInventories.FirstAsync(fi => fi.Id == sourceInventory.Id);
        updatedSourceInv.StockOnHand.Should().Be(450, "StockOnHand should decrement by RequestedQuantity (600 - 150 = 450) when AllocatedQuantity was 0");

        var destInv = await db.FacilityInventories.FirstOrDefaultAsync(fi => fi.FacilityId == destFacilityId && fi.MedicineId == medicineId);
        destInv.Should().NotBeNull();
        destInv!.StockOnHand.Should().Be(150);
    }

    [Fact]
    public async Task ProposeCandidate_AssignsSourceFacility_AndGetRouteSucceeds()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();

        var destFacilityId = Guid.NewGuid();
        var sourceFacilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var destFacility = new Facility { Id = destFacilityId, Name = "Karapitiya", FacilityCode = "DF-01", Latitude = 6.06, Longitude = 80.22, IsActive = true };
        var sourceFacility = new Facility { Id = sourceFacilityId, Name = "Colombo", FacilityCode = "SF-01", Latitude = 6.91, Longitude = 79.86, IsActive = true };
        db.Facilities.AddRange(destFacility, sourceFacility);

        var transfer = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-NO-SOURCE-001",
            SourceFacilityId = null, // Initially null
            DestinationFacilityId = destFacilityId,
            DestinationFacility = destFacility,
            Status = TransferStatus.Draft,
            Priority = TransferPriority.High,
            RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.TransferRequests.Add(transfer);
        await db.SaveChangesAsync();

        var routingMock = new Mock<IRoutingService>();
        routingMock.Setup(r => r.CalculateRouteAsync(It.IsAny<Facility>(), It.IsAny<Facility>(), default))
            .ReturnsAsync(new RouteResponse { DistanceKm = 115m, DurationMinutes = 110m, Provider = "OpenRouteService", PolylineGeometry = "geom_poly" });

        var service = new TransferService(
            db,
            routingMock.Object,
            new Mock<ICandidateFacilityService>().Object,
            new TransferValidator(),
            new Mock<ILogger<TransferService>>().Object);

        // Before proposing candidate, GetRoute must fail because SourceFacilityId is null
        var initialRouteResult = await service.GetRouteForTransferAsync(transfer.Id);
        initialRouteResult.Success.Should().BeFalse();
        initialRouteResult.Message.Should().Contain("Transfer does not have an assigned source facility");

        // Act: Propose/Select Source Facility
        var proposeResult = await service.ProposeCandidateInternalAsync(transfer.Id, sourceFacilityId, userId);

        // Assert: SourceFacilityId is now assigned, status is Proposed
        proposeResult.Success.Should().BeTrue();
        proposeResult.Data!.SourceFacilityId.Should().Be(sourceFacilityId);
        proposeResult.Data.Status.Should().Be(TransferStatus.Proposed);

        // Subsequent GetRoute now succeeds
        var afterRouteResult = await service.GetRouteForTransferAsync(transfer.Id);
        afterRouteResult.Success.Should().BeTrue();
        afterRouteResult.Data!.DistanceKm.Should().Be(115m);
    }

    [Fact]
    public async Task SubmitTransferRequest_WhenWorkflowServiceAvailable_AutoTriggersAIPlanningWorkflow()
    {
        using var db = CreateInMemoryDbContext();
        var destFacilityId = Guid.NewGuid();
        var medicineId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Facilities.Add(new Facility { Id = destFacilityId, Name = "Test Dest Hospital", City = "Kandy", Latitude = 7.29, Longitude = 80.63, IsActive = true });
        db.Medicines.Add(new Medicine { Id = medicineId, Name = "Amoxicillin", UnitOfMeasure = "capsules" });

        var transfer = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-AUTO-AI-01",
            DestinationFacilityId = destFacilityId,
            Status = TransferStatus.Draft,
            RequestedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = new List<TransferItem>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    MedicineId = medicineId,
                    MedicineName = "Amoxicillin",
                    RequestedQuantity = 50,
                    UnitOfMeasure = "capsules"
                }
            }
        };
        db.TransferRequests.Add(transfer);
        await db.SaveChangesAsync();

        var workflowMock = new Mock<IWorkflowService>();
        var runId = Guid.NewGuid();
        workflowMock.Setup(w => w.StartPlanningWorkflowAsync(It.Is<StartWorkflowRequest>(r => r.TransferRequestId == transfer.Id && r.ShortageQuantity == 50), default))
            .ReturnsAsync(ApiResponse<WorkflowResponse>.Ok(new WorkflowResponse { Id = runId, Status = WorkflowStatus.WaitingForApproval }, "Workflow triggered"));

        var serviceCollection = new ServiceCollection();
        serviceCollection.AddSingleton(workflowMock.Object);
        var serviceProvider = serviceCollection.BuildServiceProvider();

        var service = new TransferService(
            db,
            new Mock<IRoutingService>().Object,
            new Mock<ICandidateFacilityService>().Object,
            new TransferValidator(),
            new Mock<ILogger<TransferService>>().Object,
            serviceProvider);

        var result = await service.SubmitTransferRequestAsync(transfer.Id, userId);

        result.Success.Should().BeTrue();
        workflowMock.Verify(w => w.StartPlanningWorkflowAsync(It.IsAny<StartWorkflowRequest>(), default), Times.Once);
        result.Data!.WorkflowRunId.Should().Be(runId);
    }
}


