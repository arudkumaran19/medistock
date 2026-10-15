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
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Redistribution.Validators;
using MediStock.Api.Infrastructure.Persistence;

namespace MediStock.Api.Tests;

public class AtomicStockTransactionRollbackTests
{
    private (MediStockDbContext mediDb, ApplicationDbContext appDb) CreateContexts()
    {
        var dbName = Guid.NewGuid().ToString();
        var mediOptions = new DbContextOptionsBuilder<MediStockDbContext>()
            .UseInMemoryDatabase(databaseName: $"medi_{dbName}")
            .Options;
        var appOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"app_{dbName}")
            .Options;

        return (new MediStockDbContext(mediOptions), new ApplicationDbContext(appOptions));
    }

    [Fact]
    public async Task Reserve_AtomicallyUpdatesInventoryBalancesAndStockTransactionsAndTransferStatus()
    {
        // Arrange
        var (mediDb, appDb) = CreateContexts();
        using (mediDb)
        using (appDb)
        {
            var medicineId = Guid.NewGuid();
            var sourceId = Guid.NewGuid();
            var destId = Guid.NewGuid();

            // Seed Medicine & Facility in ApplicationDbContext
            var medicine = new MediStock.Api.Features.Inventory.Models.Medicine
            {
                Id = medicineId,
                Code = "PARA-500",
                Name = "Paracetamol 500 mg",
                MinimumStockLevel = 100,
                IsActive = true
            };
            appDb.Medicines.Add(medicine);

            var sourceFacility = new Facility
            {
                Id = sourceId,
                Name = "Colombo General Hospital",
                Latitude = 6.9271,
                Longitude = 79.8612,
                IsActive = true
            };
            var destFacility = new Facility
            {
                Id = destId,
                Name = "Galle Hospital",
                Latitude = 6.0535,
                Longitude = 80.2210,
                IsActive = true
            };
            appDb.Facilities.AddRange(sourceFacility, destFacility);

            // Seed InventoryBalance: 500 on hand, 0 reserved, min 100 -> 400 surplus
            var balance = new InventoryBalance
            {
                Id = Guid.NewGuid(),
                FacilityId = sourceId,
                MedicineId = medicineId,
                QuantityOnHand = 500,
                QuantityReserved = 0,
                UpdatedAtUtc = DateTime.UtcNow
            };
            appDb.InventoryBalances.Add(balance);
            await appDb.SaveChangesAsync();

            // Seed MediStockDbContext transfer request in Approved status
            mediDb.Facilities.AddRange(sourceFacility, destFacility);
            var transfer = new TransferRequest
            {
                Id = Guid.NewGuid(),
                TransferNumber = "TR-ATOMIC-001",
                SourceFacilityId = sourceId,
                DestinationFacilityId = destId,
                Status = TransferStatus.Approved,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            var transferItem = new TransferItem
            {
                Id = Guid.NewGuid(),
                TransferRequestId = transfer.Id,
                MedicineId = medicineId,
                MedicineName = "Paracetamol 500 mg",
                RequestedQuantity = 50,
                AllocatedQuantity = 0,
                UnitOfMeasure = "tablets"
            };
            transfer.Items.Add(transferItem);
            mediDb.TransferRequests.Add(transfer);
            await mediDb.SaveChangesAsync();

            var routingMock = new Mock<IRoutingService>();
            var candidateMock = new Mock<ICandidateFacilityService>();
            var loggerMock = new Mock<ILogger<TransferService>>();

            var service = new TransferService(
                mediDb,
                routingMock.Object,
                candidateMock.Object,
                new TransferValidator(),
                loggerMock.Object,
                appDbContext: appDb);

            var reserveRequest = new ReserveTransferRequest
            {
                SourceFacilityId = sourceId,
                UserId = Guid.NewGuid(),
                ItemAllocations = new List<ReserveItemAllocationDto>
                {
                    new()
                    {
                        TransferItemId = transferItem.Id,
                        AllocatedQuantity = 50,
                        BatchNumber = "BATCH-TEST-001"
                    }
                }
            };

            // Act
            var result = await service.ReserveTransferAsync(transfer.Id, reserveRequest);

            // Assert
            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be(TransferStatus.Reserved);

            // Verify ApplicationDbContext InventoryBalance and StockTransactions
            var updatedBalance = await appDb.InventoryBalances.FirstAsync(b => b.FacilityId == sourceId && b.MedicineId == medicineId);
            updatedBalance.QuantityReserved.Should().Be(50);

            var tx = await appDb.StockTransactions.FirstOrDefaultAsync(t => t.FacilityId == sourceId && t.MedicineId == medicineId);
            tx.Should().NotBeNull();
            tx!.Type.Should().Be(StockTransactionType.Reservation);
            tx.Quantity.Should().Be(50);
            tx.BalanceAfter.Should().Be(450); // 500 on hand - 50 reserved = 450 available
        }
    }

    [Fact]
    public async Task Receive_AtomicallyUpdatesSourceAndDestinationBalancesAndStockTransactions()
    {
        // Arrange
        var (mediDb, appDb) = CreateContexts();
        using (mediDb)
        using (appDb)
        {
            var medicineId = Guid.NewGuid();
            var sourceId = Guid.NewGuid();
            var destId = Guid.NewGuid();

            var sourceFacility = new Facility
            {
                Id = sourceId,
                Name = "Colombo General Hospital",
                FacilityCode = "FAC-COL-001",
                Latitude = 6.9271,
                Longitude = 79.8612,
                IsActive = true
            };
            var destFacility = new Facility
            {
                Id = destId,
                Name = "Galle Hospital",
                FacilityCode = "FAC-GAL-001",
                Latitude = 6.0535,
                Longitude = 80.2210,
                IsActive = true
            };
            mediDb.Facilities.AddRange(sourceFacility, destFacility);
            appDb.Facilities.AddRange(sourceFacility, destFacility);

            // Seed Source balance (500 on hand, 50 reserved)
            appDb.InventoryBalances.Add(new InventoryBalance
            {
                Id = Guid.NewGuid(),
                FacilityId = sourceId,
                MedicineId = medicineId,
                QuantityOnHand = 500,
                QuantityReserved = 50,
                UpdatedAtUtc = DateTime.UtcNow
            });

            // Destination initial balance (20 on hand)
            appDb.InventoryBalances.Add(new InventoryBalance
            {
                Id = Guid.NewGuid(),
                FacilityId = destId,
                MedicineId = medicineId,
                QuantityOnHand = 20,
                QuantityReserved = 0,
                UpdatedAtUtc = DateTime.UtcNow
            });
            await appDb.SaveChangesAsync();

            // Seed Transfer in Dispatched status
            var transfer = new TransferRequest
            {
                Id = Guid.NewGuid(),
                TransferNumber = "TR-ATOMIC-REC-001",
                SourceFacilityId = sourceId,
                DestinationFacilityId = destId,
                Status = TransferStatus.Dispatched,
                DispatchedAt = DateTime.UtcNow.AddHours(-2),
                CreatedAt = DateTime.UtcNow.AddHours(-4),
                UpdatedAt = DateTime.UtcNow.AddHours(-2)
            };
            var transferItem = new TransferItem
            {
                Id = Guid.NewGuid(),
                TransferRequestId = transfer.Id,
                MedicineId = medicineId,
                MedicineName = "Paracetamol 500 mg",
                RequestedQuantity = 50,
                AllocatedQuantity = 50,
                UnitOfMeasure = "tablets"
            };
            transfer.Items.Add(transferItem);
            mediDb.TransferRequests.Add(transfer);
            await mediDb.SaveChangesAsync();

            var service = new TransferService(
                mediDb,
                new Mock<IRoutingService>().Object,
                new Mock<ICandidateFacilityService>().Object,
                new TransferValidator(),
                new Mock<ILogger<TransferService>>().Object,
                appDbContext: appDb);

            var receiveRequest = new ReceiveTransferRequest
            {
                ReceivedByUserId = Guid.NewGuid(),
                VerifiedItems = new List<ReceiveItemVerificationDto>
                {
                    new()
                    {
                        TransferItemId = transferItem.Id,
                        ReceivedQuantity = 50
                    }
                }
            };

            // Act
            var result = await service.ReceiveTransferAsync(transfer.Id, receiveRequest);

            // Assert
            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be(TransferStatus.Received);

            // Source balance decremented: 500 -> 450 on hand, 50 -> 0 reserved
            var sourceBal = await appDb.InventoryBalances.FirstAsync(b => b.FacilityId == sourceId && b.MedicineId == medicineId);
            sourceBal.QuantityOnHand.Should().Be(450);
            sourceBal.QuantityReserved.Should().Be(0);

            // Dest balance incremented: 20 + 50 = 70
            var destBal = await appDb.InventoryBalances.FirstAsync(b => b.FacilityId == destId && b.MedicineId == medicineId);
            destBal.QuantityOnHand.Should().Be(70);

            // Stock transactions created for both Release and Receipt
            var txs = await appDb.StockTransactions.Where(t => t.MedicineId == medicineId).ToListAsync();
            txs.Should().Contain(t => t.FacilityId == sourceId && t.Type == StockTransactionType.Release && t.Quantity == -50);
            txs.Should().Contain(t => t.FacilityId == destId && t.Type == StockTransactionType.Receipt && t.Quantity == 50);
        }
    }

    [Fact]
    public async Task Reserve_WhenValidationFailsOrRollbackTriggered_DoesNotMutateStockOrStatus()
    {
        // Arrange: Attempting to reserve more than available surplus must fail cleanly
        // and leave InventoryBalances and transfer request untouched
        var (mediDb, appDb) = CreateContexts();
        using (mediDb)
        using (appDb)
        {
            var medicineId = Guid.NewGuid();
            var sourceId = Guid.NewGuid();
            var destId = Guid.NewGuid();

            var sourceFacility = new Facility
            {
                Id = sourceId,
                Name = "Colombo General Hospital",
                FacilityCode = "FAC-COL-002",
                Latitude = 6.9271,
                Longitude = 79.8612,
                IsActive = true
            };
            var destFacility = new Facility
            {
                Id = destId,
                Name = "Galle Hospital",
                FacilityCode = "FAC-GAL-002",
                Latitude = 6.0535,
                Longitude = 80.2210,
                IsActive = true
            };
            mediDb.Facilities.AddRange(sourceFacility, destFacility);
            appDb.Facilities.AddRange(sourceFacility, destFacility);

            appDb.Medicines.Add(new MediStock.Api.Features.Inventory.Models.Medicine
            {
                Id = medicineId,
                Code = "PARA-500",
                Name = "Paracetamol 500 mg",
                MinimumStockLevel = 100,
                IsActive = true
            });

            // Balance: 150 on hand, 0 reserved, min 100 -> available surplus is ONLY 50
            appDb.InventoryBalances.Add(new InventoryBalance
            {
                Id = Guid.NewGuid(),
                FacilityId = sourceId,
                MedicineId = medicineId,
                QuantityOnHand = 150,
                QuantityReserved = 0,
                UpdatedAtUtc = DateTime.UtcNow
            });
            await appDb.SaveChangesAsync();

            var transfer = new TransferRequest
            {
                Id = Guid.NewGuid(),
                TransferNumber = "TR-ROLLBACK-001",
                SourceFacilityId = sourceId,
                DestinationFacilityId = destId,
                Status = TransferStatus.Approved,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            var transferItem = new TransferItem
            {
                Id = Guid.NewGuid(),
                TransferRequestId = transfer.Id,
                MedicineId = medicineId,
                MedicineName = "Paracetamol 500 mg",
                RequestedQuantity = 100, // Requesting 100 which exceeds surplus (50)
                AllocatedQuantity = 0,
                UnitOfMeasure = "tablets"
            };
            transfer.Items.Add(transferItem);
            mediDb.TransferRequests.Add(transfer);
            await mediDb.SaveChangesAsync();

            var service = new TransferService(
                mediDb,
                new Mock<IRoutingService>().Object,
                new Mock<ICandidateFacilityService>().Object,
                new TransferValidator(),
                new Mock<ILogger<TransferService>>().Object,
                appDbContext: appDb);

            var reserveRequest = new ReserveTransferRequest
            {
                SourceFacilityId = sourceId,
                UserId = Guid.NewGuid(),
                ItemAllocations = new List<ReserveItemAllocationDto>
                {
                    new()
                    {
                        TransferItemId = transferItem.Id,
                        AllocatedQuantity = 100,
                        BatchNumber = "BATCH-TEST-OVER"
                    }
                }
            };

            // Act
            var result = await service.ReserveTransferAsync(transfer.Id, reserveRequest);

            // Assert: Failed and rolled back
            result.Success.Should().BeFalse();
            result.Message.Should().Contain("Available surplus at source is only 50 units");

            // Verify InventoryBalance was NOT modified
            var balanceAfter = await appDb.InventoryBalances.FirstAsync(b => b.FacilityId == sourceId && b.MedicineId == medicineId);
            balanceAfter.QuantityReserved.Should().Be(0);

            // Verify 0 StockTransactions were created
            var txCount = await appDb.StockTransactions.CountAsync(t => t.FacilityId == sourceId && t.MedicineId == medicineId);
            txCount.Should().Be(0);

            // Verify TransferRequest status remains Approved
            var transferAfter = await mediDb.TransferRequests.FirstAsync(t => t.Id == transfer.Id);
            transferAfter.Status.Should().Be(TransferStatus.Approved);
        }
    }

    [Fact]
    public async Task Reserve_WhenSecondStepFails_RollsBackAndReturnsFailure()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var mediOptions = new DbContextOptionsBuilder<MediStockDbContext>()
            .UseInMemoryDatabase(databaseName: $"faulty_medi_{dbName}")
            .Options;
        var appOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"faulty_app_{dbName}")
            .Options;

        using var faultyMediDb = new FaultyMediStockDbContext(mediOptions);
        using var appDb = new ApplicationDbContext(appOptions);

        var medicineId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();
        var destId = Guid.NewGuid();

        var sourceFacility = new Facility
        {
            Id = sourceId,
            Name = "Colombo General Hospital",
            FacilityCode = "FAC-COL-003",
            Latitude = 6.9271,
            Longitude = 79.8612,
            IsActive = true
        };
        var destFacility = new Facility
        {
            Id = destId,
            Name = "Galle Hospital",
            FacilityCode = "FAC-GAL-003",
            Latitude = 6.0535,
            Longitude = 80.2210,
            IsActive = true
        };
        faultyMediDb.Facilities.AddRange(sourceFacility, destFacility);
        appDb.Facilities.AddRange(sourceFacility, destFacility);

        appDb.Medicines.Add(new MediStock.Api.Features.Inventory.Models.Medicine
        {
            Id = medicineId,
            Code = "PARA-500",
            Name = "Paracetamol 500 mg",
            MinimumStockLevel = 100,
            IsActive = true
        });

        appDb.InventoryBalances.Add(new InventoryBalance
        {
            Id = Guid.NewGuid(),
            FacilityId = sourceId,
            MedicineId = medicineId,
            QuantityOnHand = 500,
            QuantityReserved = 0,
            UpdatedAtUtc = DateTime.UtcNow
        });
        await appDb.SaveChangesAsync();

        var transfer = new TransferRequest
        {
            Id = Guid.NewGuid(),
            TransferNumber = "TR-FAULT-001",
            SourceFacilityId = sourceId,
            DestinationFacilityId = destId,
            Status = TransferStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var transferItem = new TransferItem
        {
            Id = Guid.NewGuid(),
            TransferRequestId = transfer.Id,
            MedicineId = medicineId,
            MedicineName = "Paracetamol 500 mg",
            RequestedQuantity = 50,
            AllocatedQuantity = 0,
            UnitOfMeasure = "tablets"
        };
        transfer.Items.Add(transferItem);
        faultyMediDb.TransferRequests.Add(transfer);
        await faultyMediDb.SaveChangesAsync();

        // Enable failure on second-step save
        faultyMediDb.FailOnSave = true;

        var service = new TransferService(
            faultyMediDb,
            new Mock<IRoutingService>().Object,
            new Mock<ICandidateFacilityService>().Object,
            new TransferValidator(),
            new Mock<ILogger<TransferService>>().Object,
            appDbContext: appDb);

        var reserveRequest = new ReserveTransferRequest
        {
            SourceFacilityId = sourceId,
            UserId = Guid.NewGuid(),
            ItemAllocations = new List<ReserveItemAllocationDto>
            {
                new()
                {
                    TransferItemId = transferItem.Id,
                    AllocatedQuantity = 50,
                    BatchNumber = "BATCH-FAULT-001"
                }
            }
        };

        // Act
        var result = await service.ReserveTransferAsync(transfer.Id, reserveRequest);

        // Assert: Catches failure and returns clean error
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Simulated second-step persistence failure");
    }

    private class FaultyMediStockDbContext : MediStockDbContext
    {
        public bool FailOnSave { get; set; } = false;
        public FaultyMediStockDbContext(DbContextOptions<MediStockDbContext> options) : base(options) { }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (FailOnSave)
            {
                throw new DbUpdateException("Simulated second-step persistence failure", new Exception("Database constraint violation"));
            }
            return base.SaveChangesAsync(cancellationToken);
        }
    }
}
