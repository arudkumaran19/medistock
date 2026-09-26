using System;
using System.Collections.Generic;
using FluentAssertions;
using Xunit;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Redistribution.Validators;

namespace MediStock.Api.Tests;

public class TransferValidatorTests
{
    private readonly TransferValidator _validator = new();

    [Fact]
    public void ValidateCreate_WhenDestinationMissing_ReturnsError()
    {
        var request = new CreateTransferRequest
        {
            DestinationFacilityId = Guid.Empty,
            Items = new List<CreateTransferItemDto>
            {
                new() { MedicineId = Guid.NewGuid(), MedicineName = "Paracetamol", RequestedQuantity = 100 }
            }
        };

        var (isValid, errors) = _validator.ValidateCreate(request);

        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("Destination facility ID is required"));
    }

    [Fact]
    public void ValidateCreate_WhenItemsEmpty_ReturnsError()
    {
        var request = new CreateTransferRequest
        {
            DestinationFacilityId = Guid.NewGuid(),
            Items = new List<CreateTransferItemDto>()
        };

        var (isValid, errors) = _validator.ValidateCreate(request);

        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("at least one item"));
    }

    [Fact]
    public void ValidateCreate_WhenQuantityZeroOrNegative_ReturnsError()
    {
        var request = new CreateTransferRequest
        {
            DestinationFacilityId = Guid.NewGuid(),
            Items = new List<CreateTransferItemDto>
            {
                new() { MedicineId = Guid.NewGuid(), MedicineName = "Paracetamol", RequestedQuantity = 0 }
            }
        };

        var (isValid, errors) = _validator.ValidateCreate(request);

        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("greater than zero"));
    }

    [Theory]
    [InlineData(TransferStatus.Draft, TransferStatus.Requested, true)]
    [InlineData(TransferStatus.Draft, TransferStatus.Proposed, true)]
    [InlineData(TransferStatus.Draft, TransferStatus.Cancelled, true)]
    [InlineData(TransferStatus.Proposed, TransferStatus.Requested, true)]
    [InlineData(TransferStatus.Requested, TransferStatus.Approved, true)]
    [InlineData(TransferStatus.Requested, TransferStatus.Rejected, true)]
    [InlineData(TransferStatus.Approved, TransferStatus.Reserved, true)]
    [InlineData(TransferStatus.Reserved, TransferStatus.Dispatched, true)]
    [InlineData(TransferStatus.Dispatched, TransferStatus.Received, true)]
    [InlineData(TransferStatus.Draft, TransferStatus.Received, false)] // Cannot skip directly to Received
    [InlineData(TransferStatus.Received, TransferStatus.Draft, false)] // Cannot reopen completed
    [InlineData(TransferStatus.Rejected, TransferStatus.Approved, false)] // Cannot transition terminal state
    [InlineData(TransferStatus.Approved, TransferStatus.Dispatched, false)] // Cannot dispatch before reservation
    public void ValidateStatusTransition_EnforcesDeterministicStateMachine(
        TransferStatus current,
        TransferStatus target,
        bool expectedValid)
    {
        var (isValid, error) = _validator.ValidateStatusTransition(current, target);

        isValid.Should().Be(expectedValid);
        if (!expectedValid)
        {
            error.Should().NotBeNullOrWhiteSpace();
            error.Should().Contain($"Invalid status transition from '{current}' to '{target}'");
        }
    }
}
