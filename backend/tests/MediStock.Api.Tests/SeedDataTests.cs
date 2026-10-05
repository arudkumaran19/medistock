using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MediStock.Api.Tests;

public sealed class SeedDataTests
{
    private static ApplicationDbContext CreateDb() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public void Apply_adds_demo_batches_balances_and_audit_history_only_once()
    {
        using var db = CreateDb();

        SeedData.Apply(db);
        var batchCount = db.MedicineBatches.Count();
        var balanceCount = db.InventoryBalances.Count();
        var transactionCount = db.StockTransactions.Count();
        var quantities = db.InventoryBalances.ToDictionary(x => (x.MedicineId, x.FacilityId), x => (x.QuantityOnHand, x.QuantityReserved));

        SeedData.Apply(db);

        Assert.Equal(7, batchCount);
        Assert.Equal(batchCount, db.MedicineBatches.Count());
        Assert.Equal(balanceCount, db.InventoryBalances.Count());
        Assert.Equal(transactionCount, db.StockTransactions.Count());
        Assert.Equal(quantities, db.InventoryBalances.ToDictionary(x => (x.MedicineId, x.FacilityId), x => (x.QuantityOnHand, x.QuantityReserved)));
        Assert.DoesNotContain(db.MedicineBatches, x => string.IsNullOrWhiteSpace(x.BatchNumber) || x.BatchNumber == "-1");
        Assert.All(db.MedicineBatches, batch => Assert.True(batch.ExpiryDateUtc > batch.ManufacturingDateUtc));
        Assert.All(db.StockTransactions, transaction => Assert.False(string.IsNullOrWhiteSpace(transaction.Reason)));
        var vitaminC = db.Medicines.Single(x => x.Code == "VITC-DEMO");
        Assert.Equal("Vitamin C", vitaminC.Name);
        Assert.Contains(db.StockTransactions, transaction => transaction.MedicineId == vitaminC.Id && transaction.FacilityId == SeedData.CentralFacilityId && transaction.Type == MediStock.Api.Domain.Enums.StockTransactionType.Receipt);
        Assert.Contains(db.StockTransactions, transaction => transaction.MedicineId == vitaminC.Id && transaction.FacilityId == SeedData.CentralFacilityId && transaction.Type == MediStock.Api.Domain.Enums.StockTransactionType.Adjustment);
    }

    [Fact]
    public void Apply_preserves_an_existing_balance_without_adding_seed_stock_to_that_pair()
    {
        using var db = CreateDb();
        db.Facilities.Add(new Facility { Id = SeedData.CentralFacilityId, Code = "CENTRAL", Name = "Existing Central", Address = "Existing address" });
        db.Medicines.Add(new Medicine { Id = SeedData.ParacetamolId, Code = "PARA-500", Name = "Existing Paracetamol", MinimumStockLevel = 100 });
        db.InventoryBalances.Add(new InventoryBalance { Id = Guid.NewGuid(), MedicineId = SeedData.ParacetamolId, FacilityId = SeedData.CentralFacilityId, QuantityOnHand = 37 });
        db.SaveChanges();

        SeedData.Apply(db);

        var existingBalance = db.InventoryBalances.Single(x => x.MedicineId == SeedData.ParacetamolId && x.FacilityId == SeedData.CentralFacilityId);
        Assert.Equal(37, existingBalance.QuantityOnHand);
        Assert.Equal("Existing Central", db.Facilities.Single(x => x.Id == SeedData.CentralFacilityId).Name);
        Assert.Equal("Existing Paracetamol", db.Medicines.Single(x => x.Id == SeedData.ParacetamolId).Name);
        Assert.DoesNotContain(db.MedicineBatches, x => x.BatchNumber == "DEMO-PARA-CENTRAL-001");
        Assert.NotEmpty(db.MedicineBatches);
    }
}
