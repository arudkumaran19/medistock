using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Features.Inventory.Validators;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Inventory.Services;

public sealed class BatchService(ApplicationDbContext db)
{
    public async Task<IReadOnlyList<BatchResponse>> GetActiveAsync(Guid? facilityId, CancellationToken cancellationToken)
    {
        var query = db.MedicineBatches.AsNoTracking().Include(x => x.Medicine).Where(x => x.Medicine.IsActive && x.Facility.IsActive && x.QuantityOnHand > 0);
        if (facilityId.HasValue) query = query.Where(x => x.FacilityId == facilityId.Value);
        return await query.OrderBy(x => x.ExpiryDateUtc).Select(x => new BatchResponse(x.Id, x.MedicineId, x.Medicine.Name, x.FacilityId, x.BatchNumber, x.QuantityOnHand, x.ExpiryDateUtc, x.ManufacturingDateUtc)).ToListAsync(cancellationToken);
    }

    public async Task<BatchResponse> CreateAsync(CreateMedicineBatchRequest request, CancellationToken cancellationToken)
    {
        InventoryValidator.ValidateQuantity(request.Quantity);
        var batchNumber = InventoryValidator.ValidateBatchNumber(request.BatchNumber);
        InventoryValidator.ValidateBatchDates(request.ExpiryDateUtc, request.ManufacturingDateUtc);
        var medicine = await db.Medicines.FindAsync([request.MedicineId], cancellationToken) ?? throw new InventoryException("MEDICINE_NOT_FOUND", "Medicine was not found.");
        if (!medicine.IsActive) throw new InventoryException("MEDICINE_INACTIVE", "Medicine is archived and cannot receive stock.");
        if (!await db.Facilities.AnyAsync(x => x.Id == request.FacilityId && x.IsActive, cancellationToken)) throw new InventoryException("FACILITY_NOT_FOUND", "Facility was not found.");
        var existing = await db.MedicineBatches.FirstOrDefaultAsync(x => x.MedicineId == request.MedicineId && x.FacilityId == request.FacilityId && x.BatchNumber == batchNumber, cancellationToken);
        if (existing is not null) throw new InventoryException("BATCH_EXISTS", "A batch with this medicine, facility, and batch number already exists.");
        var batch = new MedicineBatch { Id = Guid.NewGuid(), MedicineId = request.MedicineId, FacilityId = request.FacilityId, BatchNumber = batchNumber, QuantityOnHand = request.Quantity, ExpiryDateUtc = request.ExpiryDateUtc.ToUniversalTime(), ManufacturingDateUtc = request.ManufacturingDateUtc.ToUniversalTime() };
        db.MedicineBatches.Add(batch);
        var balance = await db.InventoryBalances.FirstOrDefaultAsync(x => x.MedicineId == request.MedicineId && x.FacilityId == request.FacilityId, cancellationToken);
        if (balance is null)
        {
            balance = new InventoryBalance { Id = Guid.NewGuid(), MedicineId = request.MedicineId, FacilityId = request.FacilityId, QuantityOnHand = request.Quantity };
            db.InventoryBalances.Add(balance);
        }
        else balance.QuantityOnHand += request.Quantity;
        db.StockTransactions.Add(new StockTransaction { Id = Guid.NewGuid(), MedicineId = request.MedicineId, FacilityId = request.FacilityId, MedicineBatchId = batch.Id, Type = Domain.Enums.StockTransactionType.Receipt, Quantity = request.Quantity, BalanceAfter = balance.QuantityOnHand, Reason = "Batch created", CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        return new BatchResponse(batch.Id, medicine.Id, medicine.Name, batch.FacilityId, batch.BatchNumber, batch.QuantityOnHand, batch.ExpiryDateUtc, batch.ManufacturingDateUtc);
    }

    public async Task<BatchResponse?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        return await db.MedicineBatches.AsNoTracking().Include(x => x.Medicine).Where(x => x.Id == id).Select(x => new BatchResponse(x.Id, x.MedicineId, x.Medicine.Name, x.FacilityId, x.BatchNumber, x.QuantityOnHand, x.ExpiryDateUtc, x.ManufacturingDateUtc)).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<BatchResponse?> LookupAsync(string batchNumber, CancellationToken cancellationToken)
    {
        return await db.MedicineBatches.AsNoTracking().Include(x => x.Medicine).Where(x => x.BatchNumber == batchNumber).Select(x => new BatchResponse(x.Id, x.MedicineId, x.Medicine.Name, x.FacilityId, x.BatchNumber, x.QuantityOnHand, x.ExpiryDateUtc, x.ManufacturingDateUtc)).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<BatchResponse> RetireAsync(Guid id, RetireBatchRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new InventoryException("REASON_REQUIRED", "A retirement reason is required.");
        var batch = await db.MedicineBatches.Include(x => x.Medicine).FirstOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new InventoryException("BATCH_NOT_FOUND", "Batch was not found.");
        if (batch.QuantityOnHand <= 0) throw new InventoryException("BATCH_ALREADY_RETIRED", "Batch has no remaining stock to retire.");
        var balance = await db.InventoryBalances.FirstOrDefaultAsync(x => x.MedicineId == batch.MedicineId && x.FacilityId == batch.FacilityId, cancellationToken) ?? throw new InventoryException("INVENTORY_NOT_FOUND", "Inventory balance was not found.");
        if (balance.QuantityOnHand < batch.QuantityOnHand || balance.QuantityOnHand - batch.QuantityOnHand < balance.QuantityReserved) throw new InventoryException("BATCH_BALANCE_INCONSISTENT", "Batch cannot be retired because its stock is inconsistent with the available inventory balance.");

        await using var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var retiredQuantity = batch.QuantityOnHand;
        batch.QuantityOnHand = 0;
        balance.QuantityOnHand -= retiredQuantity;
        balance.UpdatedAtUtc = DateTime.UtcNow;
        db.StockTransactions.Add(new StockTransaction { Id = Guid.NewGuid(), MedicineId = batch.MedicineId, FacilityId = batch.FacilityId, MedicineBatchId = batch.Id, Type = Domain.Enums.StockTransactionType.Adjustment, Quantity = -retiredQuantity, BalanceAfter = balance.QuantityOnHand, Reason = request.Reason.Trim(), CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return new BatchResponse(batch.Id, batch.MedicineId, batch.Medicine.Name, batch.FacilityId, batch.BatchNumber, batch.QuantityOnHand, batch.ExpiryDateUtc, batch.ManufacturingDateUtc);
    }
}
