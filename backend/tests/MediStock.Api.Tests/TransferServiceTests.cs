using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Redistribution.Validators;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MediStock.Api.Tests;

/// <summary>
/// Transfer CRUD, lifecycle and stock movement. Redistribution vertical (Member 3).
/// Uses the real InventoryService, so reservation and delivery are tested against the
/// same balance and batch logic every other stock movement uses.
/// </summary>
public sealed class TransferServiceTests
{
    // Central Facility (Colombo) supplies Eastview (Galle) in the demo coordinates.
    private static readonly Guid Source = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Destination = Guid.Parse("99999999-9999-9999-9999-999999999999");

    private sealed record Setup(ApplicationDbContext Db, TransferService Service, InventoryService Inventory, Guid Medicine);

    private static async Task<Setup> CreateAsync(int sourceStock = 200, int minimum = 50)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new ApplicationDbContext(options);
        var medicine = Guid.NewGuid();

        db.Medicines.Add(new Medicine { Id = medicine, Code = "PARA-500", Name = "Paracetamol 500 mg", Unit = "tablet", MinimumStockLevel = minimum });
        db.Facilities.Add(new Facility { Id = Source, Code = "CENTRAL", Name = "Central Facility" });
        db.Facilities.Add(new Facility { Id = Destination, Code = "EAST", Name = "Eastview General Hospital" });
        await db.SaveChangesAsync();

        var inventory = new InventoryService(db);
        await inventory.ReceiveAsync(new ReceiveStockRequest(medicine, Source, "BATCH-101", sourceStock, DateTime.UtcNow.AddDays(200), DateTime.UtcNow.AddDays(-20)), default);

        var routing = new RoutingService();
        var service = new TransferService(db, inventory, new CandidateFacilityService(db, routing), routing, new CurrentUserService(new HttpContextAccessor()));

        return new Setup(db, service, inventory, medicine);
    }

    private static CreateTransferRequest Request(Guid medicine, int quantity = 30) => new()
    {
        MedicineId = medicine,
        DestinationFacilityId = Destination,
        Quantity = quantity,
        Priority = TransferPriority.High,
        Notes = "Outbreak",
    };

    [Fact]
    public async Task Create_submits_the_request_and_records_the_audit_trail()
    {
        var s = await CreateAsync();

        var transfer = await s.Service.CreateAsync(Request(s.Medicine));

        Assert.Equal("Requested", transfer.Status);
        Assert.StartsWith("TR-", transfer.TransferNumber);
        Assert.Equal(new[] { "Draft", "Requested" }, transfer.History.Select(h => h.ToStatus));
    }

    [Fact]
    public async Task Candidates_offer_only_stock_above_the_minimum_and_score_it()
    {
        var s = await CreateAsync(sourceStock: 200, minimum: 50);
        var transfer = await s.Service.CreateAsync(Request(s.Medicine, quantity: 30));

        var candidate = Assert.Single(await s.Service.CandidatesAsync(transfer.Id));

        Assert.Equal(150, candidate.AvailableSurplus); // 200 on hand - 0 reserved - 50 minimum
        Assert.True(candidate.CanFulfil);
        Assert.True(candidate.DistanceKm > 0);
        Assert.InRange(candidate.Score, 60m, 100m);
    }

    [Fact]
    public async Task A_facility_at_its_minimum_is_never_a_candidate()
    {
        var s = await CreateAsync(sourceStock: 50, minimum: 50);
        var transfer = await s.Service.CreateAsync(Request(s.Medicine));

        Assert.Empty(await s.Service.CandidatesAsync(transfer.Id));
    }

    [Fact]
    public async Task Proposing_a_source_that_cannot_cover_the_request_is_refused()
    {
        var s = await CreateAsync(sourceStock: 70, minimum: 50); // surplus 20
        var transfer = await s.Service.CreateAsync(Request(s.Medicine, quantity: 30));

        var error = await Assert.ThrowsAsync<TransferException>(() =>
            s.Service.ProposeAsync(transfer.Id, new ProposeSourceRequest { SourceFacilityId = Source }));

        Assert.Equal("SOURCE_INSUFFICIENT_SURPLUS", error.Code);
    }

    [Fact]
    public async Task Full_lifecycle_moves_stock_from_source_to_destination()
    {
        var s = await CreateAsync(sourceStock: 200);
        var transfer = await s.Service.CreateAsync(Request(s.Medicine, quantity: 30));

        await s.Service.ProposeAsync(transfer.Id, new ProposeSourceRequest { SourceFacilityId = Source });
        await s.Service.ApproveAsync(transfer.Id, null);

        var reserved = await s.Service.ReserveAsync(transfer.Id);
        Assert.Equal("BATCH-101", reserved.BatchNumber);
        Assert.Equal(30, (await s.Db.InventoryBalances.SingleAsync(x => x.FacilityId == Source)).QuantityReserved);

        await s.Service.DispatchAsync(transfer.Id, null);
        var delivered = await s.Service.DeliverAsync(transfer.Id, null);

        var source = await s.Db.InventoryBalances.SingleAsync(x => x.FacilityId == Source);
        var destination = await s.Db.InventoryBalances.SingleAsync(x => x.FacilityId == Destination);

        Assert.Equal("Delivered", delivered.Status);
        Assert.Equal(170, source.QuantityOnHand);
        Assert.Equal(0, source.QuantityReserved);
        Assert.Equal(30, destination.QuantityOnHand);
        Assert.Equal(30, (await s.Db.MedicineBatches.SingleAsync(x => x.FacilityId == Destination)).QuantityOnHand);
        Assert.Equal(
            new[] { "Draft", "Requested", "Proposed", "Approved", "Reserved", "InTransit", "Delivered" },
            delivered.History.Select(h => h.ToStatus));
    }

    [Fact]
    public async Task Approval_without_a_proposed_source_is_refused()
    {
        var s = await CreateAsync();
        var transfer = await s.Service.CreateAsync(Request(s.Medicine));

        var error = await Assert.ThrowsAsync<TransferException>(() => s.Service.ApproveAsync(transfer.Id, null));

        Assert.Equal("TRANSFER_NO_SOURCE", error.Code);
    }

    [Fact]
    public async Task Skipping_a_step_is_refused_by_the_state_machine()
    {
        var s = await CreateAsync();
        var transfer = await s.Service.CreateAsync(Request(s.Medicine));

        var error = await Assert.ThrowsAsync<TransferException>(() => s.Service.DispatchAsync(transfer.Id, null));

        Assert.Equal("INVALID_TRANSFER_TRANSITION", error.Code);
    }

    [Fact]
    public async Task Cancelling_a_reserved_transfer_releases_the_stock_and_keeps_the_record()
    {
        var s = await CreateAsync(sourceStock: 200);
        var transfer = await s.Service.CreateAsync(Request(s.Medicine, quantity: 30));
        await s.Service.ProposeAsync(transfer.Id, new ProposeSourceRequest { SourceFacilityId = Source });
        await s.Service.ApproveAsync(transfer.Id, null);
        await s.Service.ReserveAsync(transfer.Id);

        var cancelled = await s.Service.CancelAsync(transfer.Id, "Source needs it");

        Assert.Equal("Cancelled", cancelled.Status);
        Assert.Equal(0, (await s.Db.InventoryBalances.SingleAsync(x => x.FacilityId == Source)).QuantityReserved);
        Assert.NotNull(await s.Db.TransferRequests.FindAsync(transfer.Id)); // soft delete
    }

    [Fact]
    public async Task A_request_can_be_edited_only_before_a_manager_acts()
    {
        var s = await CreateAsync();
        var transfer = await s.Service.CreateAsync(Request(s.Medicine));

        var updated = await s.Service.UpdateAsync(transfer.Id, new UpdateTransferRequest { Quantity = 40, Priority = TransferPriority.Critical });
        Assert.Equal(40, updated.Quantity);

        await s.Service.ProposeAsync(transfer.Id, new ProposeSourceRequest { SourceFacilityId = Source });
        var error = await Assert.ThrowsAsync<TransferException>(() =>
            s.Service.UpdateAsync(transfer.Id, new UpdateTransferRequest { Quantity = 50 }));

        Assert.Equal("TRANSFER_NOT_EDITABLE", error.Code);
    }

    [Fact]
    public async Task Rejection_requires_a_reason()
    {
        var s = await CreateAsync();
        var transfer = await s.Service.CreateAsync(Request(s.Medicine));

        var error = await Assert.ThrowsAsync<TransferException>(() => s.Service.RejectAsync(transfer.Id, " "));

        Assert.Equal("REASON_REQUIRED", error.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Non_positive_quantities_are_invalid(int quantity)
    {
        Assert.NotNull(TransferValidator.ValidateCreate(new CreateTransferRequest
        {
            MedicineId = Guid.NewGuid(),
            DestinationFacilityId = Guid.NewGuid(),
            Quantity = quantity,
        }));
    }

    [Fact]
    public void Final_statuses_allow_no_further_transition()
    {
        Assert.Empty(TransferValidator.NextStatuses(TransferStatus.Delivered));
        Assert.Empty(TransferValidator.NextStatuses(TransferStatus.Rejected));
        Assert.Empty(TransferValidator.NextStatuses(TransferStatus.Cancelled));
    }
}
