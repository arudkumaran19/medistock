using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;
using MediStock.Api.Common;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Services;

namespace MediStock.Api.Tests;

public class TransferControllerTests
{
    private readonly Mock<ITransferService> _transferServiceMock = new();
    private readonly TransferController _controller;

    public TransferControllerTests()
    {
        _controller = new TransferController(_transferServiceMock.Object);
    }

    [Fact]
    public void TransferController_StrictlyExposesOnlyThe8SpecifiedEndpoints()
    {
        // Get all public action methods on TransferController
        var actionMethods = typeof(TransferController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName)
            .ToList();

        // Must have exactly 8 action methods
        actionMethods.Should().HaveCount(8, "TransferController must strictly expose only the 8 blueprint endpoints");

        var methodNames = actionMethods.Select(m => m.Name).ToList();
        methodNames.Should().Contain(nameof(TransferController.GetTransfers));
        methodNames.Should().Contain(nameof(TransferController.GetTransferById));
        methodNames.Should().Contain(nameof(TransferController.CreateTransfer));
        methodNames.Should().Contain(nameof(TransferController.SubmitRequest));
        methodNames.Should().Contain(nameof(TransferController.ReserveTransfer));
        methodNames.Should().Contain(nameof(TransferController.ReceiveTransfer));
        methodNames.Should().Contain(nameof(TransferController.GetCandidates));
        methodNames.Should().Contain(nameof(TransferController.GetRoute));

        // Must NOT contain Approve or Reject
        methodNames.Should().NotContain("ApproveTransfer");
        methodNames.Should().NotContain("RejectTransfer");
    }

    [Fact]
    public async Task GetTransfers_ReturnsOkWithPagedResponse()
    {
        // Arrange
        var pagedResponse = new PagedResponse<TransferResponse>(
            new List<TransferResponse>
            {
                new() { Id = Guid.NewGuid(), TransferNumber = "TR-001", Status = TransferStatus.Draft }
            },
            totalCount: 1,
            pageNumber: 1,
            pageSize: 20);

        _transferServiceMock
            .Setup(s => s.GetTransfersAsync(1, 20, null, "createdAt", "desc", null, null, default))
            .ReturnsAsync(pagedResponse);

        // Act
        var result = await _controller.GetTransfers();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var value = okResult.Value.Should().BeOfType<PagedResponse<TransferResponse>>().Subject;
        value.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetTransferById_WhenNotFound_Returns404NotFound()
    {
        // Arrange
        var nonExistentId = Guid.NewGuid();
        _transferServiceMock
            .Setup(s => s.GetTransferByIdAsync(nonExistentId, default))
            .ReturnsAsync((TransferResponse?)null);

        // Act
        var result = await _controller.GetTransferById(nonExistentId);

        // Assert
        var notFoundResult = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        var error = notFoundResult.Value.Should().BeOfType<ErrorResponse>().Subject;
        error.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task CreateTransfer_WhenValid_Returns201Created()
    {
        // Arrange
        var transferId = Guid.NewGuid();
        var request = new CreateTransferRequest
        {
            DestinationFacilityId = Guid.NewGuid(),
            Items = new List<CreateTransferItemDto>
            {
                new() { MedicineId = Guid.NewGuid(), MedicineName = "Paracetamol", RequestedQuantity = 100 }
            }
        };

        var transferResponse = new TransferResponse
        {
            Id = transferId,
            TransferNumber = "TR-2026-001",
            Status = TransferStatus.Draft
        };

        _transferServiceMock
            .Setup(s => s.CreateTransferAsync(request, It.IsAny<Guid>(), default))
            .ReturnsAsync(ApiResponse<TransferResponse>.Ok(transferResponse));

        // Act
        var result = await _controller.CreateTransfer(request);

        // Assert
        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.StatusCode.Should().Be(201);
        var response = createdResult.Value.Should().BeOfType<ApiResponse<TransferResponse>>().Subject;
        response.Data!.Id.Should().Be(transferId);
    }
}
