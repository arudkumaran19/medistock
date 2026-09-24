using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MediStock.Api.Tests;

public sealed class InventoryServiceTests
{
    private static (ApplicationDbContext Db, InventoryService Service, Guid MedicineId, Guid FacilityId) Create()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new ApplicationDbContext(options);
        var medicineId = Guid.NewGuid(); var facilityId = Guid.NewGuid();
        db.Medicines.Add(new Medicine { Id = medicineId, Code = "TEST", Name = "Test medicine", MinimumStockLevel = 10 });
        db.Facilities.Add(new Facility { Id = facilityId, Code = "TEST-F", Name = "Test facility" }); db.SaveChanges();
        return (db, new InventoryService(db), medicineId, facilityId);
    }

    [Fact] public async Task Receiving_creates_batch_balance_and_audit_transaction()
    { var (db, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 20, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); Assert.Equal(1, await db.MedicineBatches.CountAsync()); Assert.Equal(20, (await db.InventoryBalances.SingleAsync()).QuantityOnHand); Assert.Equal(1, await db.StockTransactions.CountAsync()); }
    [Fact] public async Task Receiving_accepts_expiry_later_than_manufacture()
    { var (_, service, medicine, facility) = Create(); var result = await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-004", 2, new DateTime(2027, 1, 1), new DateTime(2026, 1, 1)), default); Assert.Equal("BATCH-004", (await service.GetExpiringAsync(400, default)).Single().BatchNumber); Assert.Equal(2, result.QuantityOnHand); }
    [Fact] public async Task Receiving_rejects_expiry_before_manufacture()
    { var (_, service, medicine, facility) = Create(); var error = await Assert.ThrowsAsync<InventoryException>(() => service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-005", 2, new DateTime(2025, 1, 1), new DateTime(2026, 1, 1)), default)); Assert.Equal("INVALID_BATCH_DATES", error.Code); }
    [Fact] public async Task Receiving_rejects_expiry_equal_to_manufacture()
    { var (_, service, medicine, facility) = Create(); var date = new DateTime(2026, 1, 1); var error = await Assert.ThrowsAsync<InventoryException>(() => service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-006", 2, date, date), default)); Assert.Equal("INVALID_BATCH_DATES", error.Code); }
    [Fact] public async Task Receiving_rejects_placeholder_batch_number()
    { var (_, service, medicine, facility) = Create(); var error = await Assert.ThrowsAsync<InventoryException>(() => service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "-1", 2, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default)); Assert.Equal("INVALID_BATCH_NUMBER", error.Code); }
    [Fact] public async Task Reservation_cannot_exceed_available_stock()
    { var (_, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); await Assert.ThrowsAsync<InventoryException>(() => service.ReserveAsync(new ReserveStockRequest(medicine, facility, 6, "test"), default)); }
    [Fact] public async Task Reservation_reduces_available_but_not_on_hand_stock()
    { var (_, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-003", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); var result = await service.ReserveAsync(new ReserveStockRequest(medicine, facility, 2, "test"), default); Assert.Equal(5, result.QuantityOnHand); Assert.Equal(2, result.QuantityReserved); Assert.Equal(3, result.AvailableQuantity); }
    [Fact] public async Task Adjustment_cannot_make_available_stock_negative()
    { var (_, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); await Assert.ThrowsAsync<InventoryException>(() => service.AdjustAsync(new AdjustStockRequest(medicine, facility, -6, "count"), default)); }
    [Fact] public async Task Negative_adjustment_is_allowed_when_stock_is_sufficient()
    { var (db, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-002", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); var result = await service.AdjustAsync(new AdjustStockRequest(medicine, facility, -1, "cycle count"), default); Assert.Equal(4, result.QuantityOnHand); Assert.Equal(2, await db.StockTransactions.CountAsync()); }
    [Fact] public async Task Adjustment_updates_balance_and_appends_audit_transaction()
    { var (db, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); await service.AdjustAsync(new AdjustStockRequest(medicine, facility, 2, "cycle count"), default); Assert.Equal(7, (await db.InventoryBalances.SingleAsync()).QuantityOnHand); Assert.Equal(2, await db.StockTransactions.CountAsync()); }
    [Fact] public async Task Conflicting_batch_information_is_rejected()
    { var (_, service, medicine, facility) = Create(); var expiry = DateTime.UtcNow.AddDays(100); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, expiry, DateTime.UtcNow.AddDays(-10)), default); await Assert.ThrowsAsync<InventoryException>(() => service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, expiry.AddDays(1), DateTime.UtcNow.AddDays(-10)), default)); }
    [Fact] public async Task Expiring_batches_and_minimum_stock_are_reported()
    { var (_, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(-10)), default); var balance = (await service.GetAllAsync(null, default)).Single(); Assert.True(balance.IsBelowMinimum); Assert.Single(await service.GetExpiringAsync(7, default)); }
    [Fact] public async Task Batch_identity_includes_medicine_and_facility()
    { var (db, service, medicine, facility) = Create(); var secondMedicine = Guid.NewGuid(); db.Medicines.Add(new Medicine { Id = secondMedicine, Code = "TEST-2", Name = "Second medicine" }); await db.SaveChangesAsync(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); await service.ReceiveAsync(new ReceiveStockRequest(secondMedicine, facility, "BATCH-001", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); Assert.Equal(2, await db.MedicineBatches.CountAsync()); }
    [Fact] public async Task Direct_batch_creation_updates_balance_and_audit_history()
    { var (db, _, medicine, facility) = Create(); var batchService = new BatchService(db); await batchService.CreateAsync(new CreateMedicineBatchRequest(medicine, facility, "BATCH-007", 3, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); Assert.Equal(3, (await db.InventoryBalances.SingleAsync()).QuantityOnHand); Assert.Equal(1, await db.StockTransactions.CountAsync()); }
    [Fact] public async Task Direct_batch_creation_rejects_invalid_dates()
    { var (db, _, medicine, facility) = Create(); var batchService = new BatchService(db); var date = new DateTime(2026, 1, 1); await Assert.ThrowsAsync<InventoryException>(() => batchService.CreateAsync(new CreateMedicineBatchRequest(medicine, facility, "BATCH-008", 3, date, date), default)); }
    [Fact] public async Task Archived_medicine_cannot_receive_stock()
    { var (db, _, medicine, facility) = Create(); db.Medicines.Single(x => x.Id == medicine).IsActive = false; await db.SaveChangesAsync(); var service = new InventoryService(db); var error = await Assert.ThrowsAsync<InventoryException>(() => service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-009", 1, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default)); Assert.Equal("MEDICINE_INACTIVE", error.Code); }
    [Fact] public async Task Retiring_batch_zeroes_batch_reduces_balance_and_appends_adjustment_audit()
    { var (db, _, medicine, facility) = Create(); var batchService = new BatchService(db); var created = await batchService.CreateAsync(new CreateMedicineBatchRequest(medicine, facility, "BATCH-010", 3, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); var retired = await batchService.RetireAsync(created.Id, new RetireBatchRequest("invalid demo batch"), default); var batch = await db.MedicineBatches.SingleAsync(); var balance = await db.InventoryBalances.SingleAsync(); var transaction = await db.StockTransactions.OrderByDescending(x => x.CreatedAtUtc).FirstAsync(); Assert.Equal(0, retired.QuantityOnHand); Assert.Equal(0, batch.QuantityOnHand); Assert.Equal(0, balance.QuantityOnHand); Assert.Equal(2, await db.StockTransactions.CountAsync()); Assert.Equal(Domain.Enums.StockTransactionType.Adjustment, transaction.Type); Assert.Equal(-3, transaction.Quantity); Assert.Equal(created.Id, transaction.MedicineBatchId); }
    [Fact] public async Task Retiring_batch_requires_a_reason()
    { var (db, _, medicine, facility) = Create(); var batchService = new BatchService(db); var created = await batchService.CreateAsync(new CreateMedicineBatchRequest(medicine, facility, "BATCH-011", 1, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); var error = await Assert.ThrowsAsync<InventoryException>(() => batchService.RetireAsync(created.Id, new RetireBatchRequest(" "), default)); Assert.Equal("REASON_REQUIRED", error.Code); }
    [Fact] public async Task Archive_rejects_medicine_with_stock_and_preserves_audit_history()
    { var (db, service, medicine, facility) = Create(); await service.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-001", 5, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); var archiveService = new MedicineService(db); await Assert.ThrowsAsync<InventoryException>(() => archiveService.ArchiveAsync(medicine, new ArchiveMedicineRequest("retired"), default)); Assert.True((await db.Medicines.FindAsync(medicine))!.IsActive); Assert.Equal(1, await db.StockTransactions.CountAsync()); }
    [Fact] public async Task Archive_marks_empty_medicine_inactive_without_deleting_it()
    { var (db, _, medicine, _) = Create(); var archiveService = new MedicineService(db); await archiveService.ArchiveAsync(medicine, new ArchiveMedicineRequest("discontinued"), default); Assert.False((await db.Medicines.FindAsync(medicine))!.IsActive); Assert.NotNull(await db.Medicines.FindAsync(medicine)); }

    [Fact] public async Task Medicine_creation_validates_unique_code_and_persists_catalog_fields()
    { var (db, _, _, _) = Create(); var service = new MedicineService(db); var created = await service.CreateAsync(new CreateMedicineRequest("NEW-001", "New medicine", "box", 12), default); Assert.Equal("NEW-001", created.Code); Assert.Equal(12, created.MinimumStockLevel); Assert.True(created.IsActive); await Assert.ThrowsAsync<InventoryException>(() => service.CreateAsync(new CreateMedicineRequest("NEW-001", "Duplicate", "unit", 0), default)); }

    [Fact] public async Task Medicine_update_changes_only_editable_catalog_fields()
    { var (db, _, medicine, _) = Create(); var service = new MedicineService(db); var updated = await service.UpdateAsync(medicine, new UpdateMedicineRequest("Renamed medicine", "pack", 15), default); Assert.Equal("TEST", updated.Code); Assert.Equal("Renamed medicine", updated.Name); Assert.Equal("pack", updated.Unit); Assert.Equal(15, updated.MinimumStockLevel); }

    [Fact] public async Task Transaction_history_is_read_only_and_contains_balance_after()
    { var (db, inventory, medicine, facility) = Create(); await inventory.ReceiveAsync(new ReceiveStockRequest(medicine, facility, "BATCH-012", 8, DateTime.UtcNow.AddDays(100), DateTime.UtcNow.AddDays(-10)), default); await inventory.AdjustAsync(new AdjustStockRequest(medicine, facility, -2, "cycle count"), default); var history = await new StockTransactionService(db).GetHistoryAsync(medicine, facility, default); Assert.Equal(2, history.Count); Assert.Equal("ADJUSTMENT", history[0].Type); Assert.Equal(-2, history[0].Quantity); Assert.Equal("cycle count", history[0].Reason); Assert.Equal(6, history[0].BalanceAfter); Assert.Equal("RECEIPT", history[1].Type); }
}
