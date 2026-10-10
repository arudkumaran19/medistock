using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Hubs;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Redistribution.Validators;

namespace MediStock.Api.Tests;

public class NotificationTests
{
    private MediStockDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<MediStockDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new MediStockDbContext(options);
    }

    [Fact]
    public async Task TransferNotificationService_BroadcastNotificationCreatedAsync_SendsToTransferGroupAndManagers()
    {
        // Arrange
        var hubContextMock = new Mock<IHubContext<TransferHub, ITransferHubClient>>();
        var clientsMock = new Mock<IHubClients<ITransferHubClient>>();
        var transferClientMock = new Mock<ITransferHubClient>();
        var managerClientMock = new Mock<ITransferHubClient>();

        var transferId = Guid.NewGuid();
        var transferGroupName = $"transfer_{transferId.ToString().ToLowerInvariant()}";

        clientsMock.Setup(c => c.Group(transferGroupName)).Returns(transferClientMock.Object);
        clientsMock.Setup(c => c.Group("managers")).Returns(managerClientMock.Object);
        hubContextMock.Setup(h => h.Clients).Returns(clientsMock.Object);

        var loggerMock = new Mock<ILogger<TransferNotificationService>>();
        var service = new TransferNotificationService(hubContextMock.Object, loggerMock.Object);

        var notificationDto = new TransferNotificationResponse
        {
            Id = Guid.NewGuid(),
            TransferId = transferId,
            Audience = "FieldOfficer",
            Title = "Your medicines are on the way",
            Message = "Field courier has picked up items and is en route.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        // Act
        await service.BroadcastNotificationCreatedAsync(notificationDto);

        // Assert
        transferClientMock.Verify(c => c.NotificationCreated(notificationDto), Times.Once);
        managerClientMock.Verify(c => c.NotificationCreated(notificationDto), Times.Once);
    }

    [Fact]
    public async Task TransferService_DispatchTransferAsync_CreatesFieldOfficerAndManagerNotifications()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var transferId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var destFacility = new Facility
        {
            Id = Guid.NewGuid(),
            Name = "Teaching Hospital Kandy",
            FacilityCode = "FAC-KND",
            IsActive = true
        };
        dbContext.Facilities.Add(destFacility);

        var transfer = new TransferRequest
        {
            Id = transferId,
            TransferNumber = "TR-NOTIF-001",
            Status = TransferStatus.Reserved,
            RequestedByUserId = requesterId,
            DestinationFacilityId = destFacility.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.TransferRequests.Add(transfer);
        await dbContext.SaveChangesAsync();

        var notificationServiceMock = new Mock<ITransferNotificationService>();
        var routingServiceMock = new Mock<IRoutingService>();
        var candidateFacilityServiceMock = new Mock<ICandidateFacilityService>();
        var validator = new TransferValidator();
        var loggerMock = new Mock<ILogger<TransferService>>();

        var service = new TransferService(
            dbContext,
            routingServiceMock.Object,
            candidateFacilityServiceMock.Object,
            validator,
            loggerMock.Object,
            notificationService: notificationServiceMock.Object);

        // Act
        var result = await service.DispatchTransferAsync(transferId, new DispatchTransferRequest
        {
            UserId = requesterId,
            CarrierName = "Test Courier"
        });

        // Assert
        result.Success.Should().BeTrue(because: result.Message ?? string.Join(", ", result.Errors));
        var notifications = await dbContext.TransferNotifications
            .Where(n => n.TransferId == transferId)
            .ToListAsync();

        notifications.Should().HaveCount(2);

        var fieldOfficerNotif = notifications.FirstOrDefault(n => n.Audience == "FieldOfficer");
        fieldOfficerNotif.Should().NotBeNull();
        fieldOfficerNotif!.Title.Should().Be("Your medicines are on the way");
        fieldOfficerNotif.RecipientUserId.Should().Be(requesterId);
        fieldOfficerNotif.IsRead.Should().BeFalse();

        var managerNotif = notifications.FirstOrDefault(n => n.Audience == "Manager");
        managerNotif.Should().NotBeNull();
        managerNotif!.Title.Should().Be("Transfer In Transit");
        managerNotif.IsRead.Should().BeFalse();

        notificationServiceMock.Verify(
            s => s.BroadcastNotificationCreatedAsync(It.IsAny<TransferNotificationResponse>(), default),
            Times.Exactly(2));
    }

    [Fact]
    public async Task TransferService_AllStatusTransitions_CreateFieldOfficerAndManagerNotifications()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var requesterId = Guid.NewGuid();

        var sourceFac = new Facility
        {
            Id = Guid.NewGuid(),
            Name = "National Hospital Colombo",
            FacilityCode = "FAC-COL",
            IsActive = true
        };
        var destFac = new Facility
        {
            Id = Guid.NewGuid(),
            Name = "Teaching Hospital Kandy",
            FacilityCode = "FAC-KND",
            IsActive = true
        };
        var med = new Medicine
        {
            Id = Guid.NewGuid(),
            Name = "Amoxicillin 500mg",
            GenericName = "Amoxicillin",
            Sku = "MED-AMX-001",
            UnitOfMeasure = "capsules"
        };
        dbContext.Facilities.AddRange(sourceFac, destFac);
        dbContext.Medicines.Add(med);
        await dbContext.SaveChangesAsync();

        var notificationServiceMock = new Mock<ITransferNotificationService>();
        var routingServiceMock = new Mock<IRoutingService>();
        routingServiceMock.Setup(r => r.CalculateRouteAsync(It.IsAny<Facility>(), It.IsAny<Facility>(), default))
            .ReturnsAsync(new RouteResponse
            {
                DistanceKm = 115.5m,
                DurationMinutes = 154,
                Provider = "OSRM"
            });

        var candidateFacilityServiceMock = new Mock<ICandidateFacilityService>();
        var validator = new TransferValidator();
        var loggerMock = new Mock<ILogger<TransferService>>();

        var service = new TransferService(
            dbContext,
            routingServiceMock.Object,
            candidateFacilityServiceMock.Object,
            validator,
            loggerMock.Object,
            notificationService: notificationServiceMock.Object);

        // 1. Submit: Draft -> Requested
        var tr1 = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-SUBMIT-001",
            Status = TransferStatus.Draft,
            RequestedByUserId = requesterId,
            DestinationFacilityId = destFac.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.TransferRequests.Add(tr1);
        await dbContext.SaveChangesAsync();

        var submitResult = await service.SubmitTransferRequestAsync(tr1.Id, requesterId);
        submitResult.Success.Should().BeTrue();
        var submitNotifs = await dbContext.TransferNotifications.Where(n => n.TransferId == tr1.Id).ToListAsync();
        submitNotifs.Should().HaveCount(2);
        submitNotifs.Should().Contain(n => n.Audience == "FieldOfficer" && n.Title == "Your request was submitted");
        submitNotifs.Should().Contain(n => n.Audience == "Manager" && n.Title == "New Transfer Requested");

        // 2. Propose: Requested -> Proposed
        var tr2 = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-PROP-001",
            Status = TransferStatus.Requested,
            RequestedByUserId = requesterId,
            DestinationFacilityId = destFac.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.TransferRequests.Add(tr2);
        await dbContext.SaveChangesAsync();

        var propResult = await service.ProposeCandidateInternalAsync(tr2.Id, sourceFac.Id, Guid.NewGuid());
        propResult.Success.Should().BeTrue();
        var propNotifs = await dbContext.TransferNotifications.Where(n => n.TransferId == tr2.Id).ToListAsync();
        propNotifs.Should().HaveCount(2);
        propNotifs.Should().Contain(n => n.Audience == "FieldOfficer" && n.Title == "Source facility proposed");
        propNotifs.Should().Contain(n => n.Audience == "Manager" && n.Title == "Proposal Ready for Review");

        // 3. Approve: Proposed -> Approved
        var tr3 = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-APP-001",
            Status = TransferStatus.Proposed,
            RequestedByUserId = requesterId,
            SourceFacilityId = sourceFac.Id,
            DestinationFacilityId = destFac.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.TransferRequests.Add(tr3);
        await dbContext.SaveChangesAsync();

        var appResult = await service.ApproveTransferInternalAsync(tr3.Id, Guid.NewGuid());
        appResult.Success.Should().BeTrue();
        var appNotifs = await dbContext.TransferNotifications.Where(n => n.TransferId == tr3.Id).ToListAsync();
        appNotifs.Should().HaveCount(2);
        appNotifs.Should().Contain(n => n.Audience == "FieldOfficer" && (n.Title == "New delivery task" || n.Title == "Transfer approved"));
        appNotifs.Should().Contain(n => n.Audience == "Manager" && (n.Title == "Transfer Approved & Assigned" || n.Title == "Transfer Approved"));

        // 4. Reserve: Approved -> Reserved
        var item4 = new TransferItem
        {
            Id = Guid.NewGuid(),
            MedicineId = med.Id,
            MedicineName = med.Name,
            RequestedQuantity = 50,
            AllocatedQuantity = 50,
            UnitOfMeasure = "capsules"
        };
        var tr4 = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-RES-001",
            Status = TransferStatus.Approved,
            RequestedByUserId = requesterId,
            SourceFacilityId = sourceFac.Id,
            DestinationFacilityId = destFac.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = new List<TransferItem> { item4 }
        };
        dbContext.FacilityInventories.Add(new FacilityInventory
        {
            Id = Guid.NewGuid(),
            FacilityId = sourceFac.Id,
            MedicineId = med.Id,
            StockOnHand = 200,
            ReservedStock = 0,
            BatchNumber = "B-001"
        });
        dbContext.TransferRequests.Add(tr4);
        await dbContext.SaveChangesAsync();

        var resResult = await service.ReserveTransferAsync(tr4.Id, new ReserveTransferRequest
        {
            UserId = requesterId,
            ItemAllocations = new List<ReserveItemAllocationDto>
            {
                new() { TransferItemId = item4.Id, AllocatedQuantity = 50, BatchNumber = "B-001" }
            }
        });
        resResult.Success.Should().BeTrue();
        var resNotifs = await dbContext.TransferNotifications.Where(n => n.TransferId == tr4.Id).ToListAsync();
        resNotifs.Should().HaveCount(2);
        resNotifs.Should().Contain(n => n.Audience == "FieldOfficer" && n.Title == "Medicines reserved");
        resNotifs.Should().Contain(n => n.Audience == "Manager" && n.Title == "Stock Reserved at Depot");

        // 5. Receive: Dispatched -> Received
        var item5 = new TransferItem
        {
            Id = Guid.NewGuid(),
            MedicineId = med.Id,
            MedicineName = med.Name,
            RequestedQuantity = 30,
            AllocatedQuantity = 30,
            UnitOfMeasure = "capsules"
        };
        var tr5 = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-REC-001",
            Status = TransferStatus.Dispatched,
            RequestedByUserId = requesterId,
            SourceFacilityId = sourceFac.Id,
            DestinationFacilityId = destFac.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = new List<TransferItem> { item5 }
        };
        dbContext.TransferRequests.Add(tr5);
        await dbContext.SaveChangesAsync();

        var recResult = await service.ReceiveTransferAsync(tr5.Id, new ReceiveTransferRequest
        {
            ReceivedByUserId = requesterId,
            VerifiedItems = new List<ReceiveItemVerificationDto>
            {
                new() { TransferItemId = item5.Id, ReceivedQuantity = 30, BatchNumber = "B-001" }
            }
        });
        recResult.Success.Should().BeTrue();
        var recNotifs = await dbContext.TransferNotifications.Where(n => n.TransferId == tr5.Id).ToListAsync();
        recNotifs.Should().HaveCount(2);
        recNotifs.Should().Contain(n => n.Audience == "FieldOfficer" && n.Title == "Medicines delivered");
        recNotifs.Should().Contain(n => n.Audience == "Manager" && n.Title == "Delivery Completed");

        // 6. Reject: Proposed -> Rejected
        var tr6 = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-REJ-001",
            Status = TransferStatus.Proposed,
            RequestedByUserId = requesterId,
            SourceFacilityId = sourceFac.Id,
            DestinationFacilityId = destFac.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.TransferRequests.Add(tr6);
        await dbContext.SaveChangesAsync();

        var rejResult = await service.RejectTransferInternalAsync(tr6.Id, Guid.NewGuid(), "Insufficient quota");
        rejResult.Success.Should().BeTrue();
        var rejNotifs = await dbContext.TransferNotifications.Where(n => n.TransferId == tr6.Id).ToListAsync();
        rejNotifs.Should().HaveCount(2);
        rejNotifs.Should().Contain(n => n.Audience == "FieldOfficer" && n.Title == "Transfer rejected");
        rejNotifs.Should().Contain(n => n.Audience == "Manager" && n.Title == "Transfer Rejected");
    }

    [Fact]
    public async Task NotificationController_GetNotifications_And_MarkAsRead_WorkCorrectly()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var transferId = Guid.NewGuid();

        var notif1 = new TransferNotification
        {
            Id = Guid.NewGuid(),
            TransferId = transferId,
            Audience = "FieldOfficer",
            Title = "Title 1",
            Message = "Message 1",
            IsRead = false,
            CreatedAt = DateTime.UtcNow.AddMinutes(-5)
        };
        var notif2 = new TransferNotification
        {
            Id = Guid.NewGuid(),
            TransferId = transferId,
            Audience = "Manager",
            Title = "Title 2",
            Message = "Message 2",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.TransferNotifications.AddRange(notif1, notif2);
        await dbContext.SaveChangesAsync();

        var controller = new NotificationController(dbContext);

        // Act: Filter by Audience = FieldOfficer
        var listResult = await controller.GetNotifications(audience: "FieldOfficer") as OkObjectResult;
        listResult.Should().NotBeNull();
        var pagedResponse = listResult!.Value as PagedResponse<TransferNotificationResponse>;
        pagedResponse.Should().NotBeNull();
        pagedResponse!.Items.Should().HaveCount(1);
        pagedResponse.Items[0].Title.Should().Be("Title 1");

        // Act: Mark notif1 as read
        var readResult = await controller.MarkAsRead(notif1.Id) as OkObjectResult;
        readResult.Should().NotBeNull();
        var readResponse = readResult!.Value as ApiResponse<TransferNotificationResponse>;
        readResponse!.Success.Should().BeTrue();
        readResponse.Data!.IsRead.Should().BeTrue();

        // Act: Mark all as read for Manager
        var markAllResult = await controller.MarkAllAsRead(audience: "Manager") as OkObjectResult;
        markAllResult.Should().NotBeNull();
        var markAllResponse = markAllResult!.Value as ApiResponse<int>;
        markAllResponse!.Success.Should().BeTrue();
        markAllResponse.Data.Should().Be(1);

        // Verify in DB all are read
        var unreadCount = await dbContext.TransferNotifications.CountAsync(n => !n.IsRead);
        unreadCount.Should().Be(0);
    }
}
