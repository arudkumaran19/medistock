using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Hubs;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Redistribution.Validators;

namespace MediStock.Api.Tests;

public class TransferSignalRHubTests
{
    [Fact]
    public async Task TransferHub_JoinTransferGroup_AddsConnectionToTransferGroup()
    {
        // Arrange
        var groupsMock = new Mock<IGroupManager>();
        var hubCallerContextMock = new Mock<HubCallerContext>();
        hubCallerContextMock.Setup(c => c.ConnectionId).Returns("conn-123");

        var loggerMock = new Mock<ILogger<TransferHub>>();
        var hub = new TransferHub(loggerMock.Object)
        {
            Context = hubCallerContextMock.Object,
            Groups = groupsMock.Object
        };

        var transferId = Guid.NewGuid().ToString();

        // Act
        await hub.JoinTransferGroup(transferId);

        // Assert
        groupsMock.Verify(g => g.AddToGroupAsync("conn-123", $"transfer_{transferId.ToLowerInvariant()}", default), Times.Once);
    }

    [Fact]
    public async Task TransferHub_JoinManagerGroup_AddsConnectionToManagersGroup()
    {
        // Arrange
        var groupsMock = new Mock<IGroupManager>();
        var hubCallerContextMock = new Mock<HubCallerContext>();
        hubCallerContextMock.Setup(c => c.ConnectionId).Returns("conn-456");

        var loggerMock = new Mock<ILogger<TransferHub>>();
        var hub = new TransferHub(loggerMock.Object)
        {
            Context = hubCallerContextMock.Object,
            Groups = groupsMock.Object
        };

        // Act
        await hub.JoinManagerGroup();

        // Assert
        groupsMock.Verify(g => g.AddToGroupAsync("conn-456", "managers", default), Times.Once);
    }

    [Fact]
    public async Task TransferNotificationService_BroadcastStatusChangedAsync_SendsToTransferAndManagerGroups()
    {
        // Arrange
        var hubContextMock = new Mock<IHubContext<TransferHub, ITransferHubClient>>();
        var clientsMock = new Mock<IHubClients<ITransferHubClient>>();
        var transferClientMock = new Mock<ITransferHubClient>();
        var managerClientMock = new Mock<ITransferHubClient>();
        var loggerMock = new Mock<ILogger<TransferNotificationService>>();

        var transferId = Guid.NewGuid();
        var transferGroupName = TransferHub.GetTransferGroupName(transferId.ToString());

        clientsMock.Setup(c => c.Group(transferGroupName)).Returns(transferClientMock.Object);
        clientsMock.Setup(c => c.Group("managers")).Returns(managerClientMock.Object);
        hubContextMock.Setup(h => h.Clients).Returns(clientsMock.Object);

        var service = new TransferNotificationService(hubContextMock.Object, loggerMock.Object);

        var transfer = new TransferResponse
        {
            Id = transferId,
            TransferNumber = "TR-2026-SIGNALR",
            Status = TransferStatus.InTransit
        };

        // Act
        await service.BroadcastStatusChangedAsync(transfer);

        // Assert
        transferClientMock.Verify(c => c.TransferStatusChanged(It.Is<TransferResponse>(t => t.Id == transferId && t.Status == TransferStatus.InTransit)), Times.Once);
        managerClientMock.Verify(c => c.TransferStatusChanged(It.Is<TransferResponse>(t => t.Id == transferId && t.Status == TransferStatus.InTransit)), Times.Once);
    }

    [Fact]
    public async Task TransferNotificationService_BroadcastLocationUpdatedAsync_SendsToTransferAndManagerGroups()
    {
        // Arrange
        var hubContextMock = new Mock<IHubContext<TransferHub, ITransferHubClient>>();
        var clientsMock = new Mock<IHubClients<ITransferHubClient>>();
        var transferClientMock = new Mock<ITransferHubClient>();
        var managerClientMock = new Mock<ITransferHubClient>();
        var loggerMock = new Mock<ILogger<TransferNotificationService>>();

        var transferId = Guid.NewGuid();
        var transferGroupName = TransferHub.GetTransferGroupName(transferId.ToString());

        clientsMock.Setup(c => c.Group(transferGroupName)).Returns(transferClientMock.Object);
        clientsMock.Setup(c => c.Group("managers")).Returns(managerClientMock.Object);
        hubContextMock.Setup(h => h.Clients).Returns(clientsMock.Object);

        var service = new TransferNotificationService(hubContextMock.Object, loggerMock.Object);

        var locationDto = new TransferLocationUpdateDto
        {
            TransferId = transferId,
            Latitude = 6.9271,
            Longitude = 79.8612,
            Speed = 40.0,
            Heading = 90.0,
            Timestamp = DateTime.UtcNow
        };

        // Act
        await service.BroadcastLocationUpdatedAsync(locationDto);

        // Assert
        transferClientMock.Verify(c => c.TransferLocationUpdated(It.Is<TransferLocationUpdateDto>(l => l.TransferId == transferId && l.Latitude == 6.9271)), Times.Once);
        managerClientMock.Verify(c => c.TransferLocationUpdated(It.Is<TransferLocationUpdateDto>(l => l.TransferId == transferId && l.Latitude == 6.9271)), Times.Once);
    }

    [Theory]
    [InlineData(TransferStatus.Draft, TransferStatus.Requested, true)]
    [InlineData(TransferStatus.Requested, TransferStatus.Proposed, true)]
    [InlineData(TransferStatus.Proposed, TransferStatus.Approved, true)]
    [InlineData(TransferStatus.Proposed, TransferStatus.Rejected, true)]
    [InlineData(TransferStatus.Approved, TransferStatus.Reserved, true)]
    [InlineData(TransferStatus.Reserved, TransferStatus.InTransit, true)]
    [InlineData(TransferStatus.InTransit, TransferStatus.Delivered, true)]
    [InlineData(TransferStatus.Draft, TransferStatus.InTransit, false)]
    [InlineData(TransferStatus.Approved, TransferStatus.Delivered, false)]
    public void TransferValidator_ValidatesLifecycleStatusTransitionsCorrectly(
        TransferStatus fromStatus,
        TransferStatus toStatus,
        bool shouldBeValid)
    {
        // Arrange
        var validator = new TransferValidator();

        // Act
        var (isValid, error) = validator.ValidateStatusTransition(fromStatus, toStatus);

        // Assert
        isValid.Should().Be(shouldBeValid);
        if (!shouldBeValid)
        {
            error.Should().NotBeNullOrWhiteSpace();
        }
    }
}
