using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Services;

namespace MediStock.Api.Tests;

public class WorkflowServiceTests
{
    private MediStockDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<MediStockDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new MediStockDbContext(options);
    }

    [Fact]
    public async Task ApprovalService_WhenApproved_AutomaticallyTransitionsLinkedTransferToApproved()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();

        var transferId = Guid.NewGuid();
        var approverId = Guid.NewGuid();
        var destId = Guid.NewGuid();

        db.Facilities.Add(new Facility { Id = destId, Name = "Hospital", FacilityCode = "H1", Latitude = 6, Longitude = 80, IsActive = true });

        // Linked transfer request in Requested status
        var transfer = new MediStock.Api.Features.Redistribution.Models.TransferRequest
        {
            Id = transferId,
            TransferNumber = "TR-TEST-001",
            DestinationFacilityId = destId,
            Status = TransferStatus.Requested,
            RequestedByUserId = Guid.NewGuid()
        };
        db.TransferRequests.Add(transfer);

        // WorkflowRun in WaitingForApproval status linked to transfer
        var run = new MediStock.Api.Features.Workflow.Models.WorkflowRun
        {
            Id = Guid.NewGuid(),
            WorkflowType = "RedistributionPlanning",
            Status = WorkflowStatus.WaitingForApproval,
            InitiatorUserId = Guid.NewGuid()
        };
        db.WorkflowRuns.Add(run);

        transfer.WorkflowRunId = run.Id;
        await db.SaveChangesAsync();

        var transferServiceMock = new Mock<ITransferService>();
        transferServiceMock
            .Setup(ts => ts.ApproveTransferInternalAsync(transferId, approverId, It.IsAny<string?>(), default))
            .ReturnsAsync(ApiResponse<TransferResponse>.Ok(new TransferResponse { Id = transferId, Status = TransferStatus.Approved }));

        var stateService = new WorkflowStateService(db, new Mock<ILogger<WorkflowStateService>>().Object);
        var loggerMock = new Mock<ILogger<ApprovalService>>();

        var approvalService = new ApprovalService(db, transferServiceMock.Object, stateService, loggerMock.Object);

        // Act: Management approves the workflow proposal
        var approvalResult = await approvalService.ApproveAsync(run.Id, new ApprovalRequest
        {
            ApproverUserId = approverId,
            DecisionNotes = "Verified budget and priority"
        });

        // Assert
        approvalResult.Success.Should().BeTrue();
        approvalResult.Data!.Status.Should().Be(WorkflowStatus.Approved);

        // Assert TransferService was invoked to transition transfer to Approved
        transferServiceMock.Verify(ts => ts.ApproveTransferInternalAsync(transferId, approverId, "Verified budget and priority", default), Times.Once);

        // Assert audit and approval record written to DB
        var savedApproval = await db.Approvals.FirstOrDefaultAsync(a => a.WorkflowRunId == run.Id);
        savedApproval.Should().NotBeNull();
        savedApproval!.Status.Should().Be(WorkflowStatus.Approved);
        savedApproval.ApproverUserId.Should().Be(approverId);
    }

    [Fact]
    public async Task ApprovalService_WhenRejected_AutomaticallyTransitionsLinkedTransferToRejected()
    {
        // Arrange
        using var db = CreateInMemoryDbContext();

        var transferId = Guid.NewGuid();
        var approverId = Guid.NewGuid();
        var destId = Guid.NewGuid();

        db.Facilities.Add(new Facility { Id = destId, Name = "Hospital", FacilityCode = "H1", Latitude = 6, Longitude = 80, IsActive = true });

        var transfer = new MediStock.Api.Features.Redistribution.Models.TransferRequest
        {
            Id = transferId,
            TransferNumber = "TR-TEST-002",
            DestinationFacilityId = destId,
            Status = TransferStatus.Requested,
            RequestedByUserId = Guid.NewGuid()
        };
        db.TransferRequests.Add(transfer);

        var run = new MediStock.Api.Features.Workflow.Models.WorkflowRun
        {
            Id = Guid.NewGuid(),
            WorkflowType = "RedistributionPlanning",
            Status = WorkflowStatus.WaitingForApproval,
            InitiatorUserId = Guid.NewGuid()
        };
        db.WorkflowRuns.Add(run);
        transfer.WorkflowRunId = run.Id;
        await db.SaveChangesAsync();

        var transferServiceMock = new Mock<ITransferService>();
        transferServiceMock
            .Setup(ts => ts.RejectTransferInternalAsync(transferId, approverId, It.IsAny<string>(), default))
            .ReturnsAsync(ApiResponse<TransferResponse>.Ok(new TransferResponse { Id = transferId, Status = TransferStatus.Rejected }));

        var stateService = new WorkflowStateService(db, new Mock<ILogger<WorkflowStateService>>().Object);
        var loggerMock = new Mock<ILogger<ApprovalService>>();

        var approvalService = new ApprovalService(db, transferServiceMock.Object, stateService, loggerMock.Object);

        // Act: Manager rejects proposal
        var rejectResult = await approvalService.RejectAsync(run.Id, new ApprovalRequest
        {
            ApproverUserId = approverId,
            DecisionNotes = "Insufficient transport budget"
        });

        // Assert
        rejectResult.Success.Should().BeTrue();
        rejectResult.Data!.Status.Should().Be(WorkflowStatus.Rejected);

        // Assert TransferService was invoked to transition transfer to Rejected
        transferServiceMock.Verify(ts => ts.RejectTransferInternalAsync(transferId, approverId, "Insufficient transport budget", default), Times.Once);
    }
}
