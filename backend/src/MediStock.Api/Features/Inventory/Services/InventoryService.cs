using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Features.Inventory.Validators;
using Microsoft.EntityFrameworkCore;

using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;

namespace MediStock.Api.Features.Inventory.Services;

public sealed class InventoryService(ApplicationDbContext db)
{
    public async Task<IReadOnlyList<InventoryResponse>> GetAllAsync(Guid? facilityId, CancellationToken cancellationToken, bool includeArchived = false)
    {
        var query = db.InventoryBalances.AsNoTracking().Include(x => x.Medicine).Include(x => x.Facility).Where(x => x.Facility.IsActive && (includeArchived || x.Medicine.IsActive)).AsQueryable();
        if (facilityId.HasValue) query = query.Where(x => x.FacilityId == facilityId.Value);
        var balances = await query.OrderBy(x => x.Medicine.Name).ToListAsync(cancellationToken);
        return balances.Select(Map).ToList();
    }

    public async Task<InventoryResponse?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var balance = await db.InventoryBalances.AsNoTracking().Include(x => x.Medicine).Include(x => x.Facility).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return balance is null ? null : Map(balance);
    }

    public async Task<InventoryResponse> ReceiveAsync(ReceiveStockRequest request, CancellationToken cancellationToken)
    {
        InventoryValidator.ValidateQuantity(request.Quantity);
        var batchNumber = InventoryValidator.ValidateBatchNumber(request.BatchNumber);
        InventoryValidator.ValidateBatchDates(request.ExpiryDateUtc, request.ManufacturingDateUtc);
        var medicine = await db.Medicines.FindAsync([request.MedicineId], cancellationToken) ?? throw new InventoryException("MEDICINE_NOT_FOUND", "Medicine was not found.");
        if (!medicine.IsActive) throw new InventoryException("MEDICINE_INACTIVE", "Medicine is archived and cannot receive stock.");
        await EnsureFacilityAsync(request.FacilityId, cancellationToken);
        var batch = await db.MedicineBatches.FirstOrDefaultAsync(x => x.MedicineId == request.MedicineId && x.FacilityId == request.FacilityId && x.BatchNumber == batchNumber, cancellationToken);
        if (batch is null)
        {
            batch = new MedicineBatch { Id = Guid.NewGuid(), MedicineId = request.MedicineId, FacilityId = request.FacilityId, BatchNumber = batchNumber, ExpiryDateUtc = request.ExpiryDateUtc.ToUniversalTime(), ManufacturingDateUtc = request.ManufacturingDateUtc.ToUniversalTime(), QuantityOnHand = request.Quantity };
            db.MedicineBatches.Add(batch);
        }
        else
        {
            if (batch.ExpiryDateUtc != request.ExpiryDateUtc.ToUniversalTime() || batch.ManufacturingDateUtc != request.ManufacturingDateUtc.ToUniversalTime()) throw new InventoryException("BATCH_CONFLICT", "Existing batch expiry or manufacturing information cannot be changed.");
            batch.QuantityOnHand += request.Quantity;
        }
        var balance = await GetOrCreateBalanceAsync(request.MedicineId, request.FacilityId, cancellationToken);
        balance.QuantityOnHand += request.Quantity;
        balance.UpdatedAtUtc = DateTime.UtcNow;
        db.StockTransactions.Add(new StockTransaction { Id = Guid.NewGuid(), MedicineId = request.MedicineId, FacilityId = request.FacilityId, MedicineBatchId = batch.Id, Type = Domain.Enums.StockTransactionType.Receipt, Quantity = request.Quantity, BalanceAfter = balance.QuantityOnHand, Reason = "Stock received", CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        return Map(balance, medicine, await db.Facilities.FindAsync([request.FacilityId], cancellationToken) ?? throw new InventoryException("FACILITY_NOT_FOUND", "Facility was not found."));
    }

    public async Task<InventoryResponse> AdjustAsync(AdjustStockRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new InventoryException("REASON_REQUIRED", "An adjustment reason is required.");
        var balance = await db.InventoryBalances.Include(x => x.Medicine).Include(x => x.Facility).FirstOrDefaultAsync(x => x.MedicineId == request.MedicineId && x.FacilityId == request.FacilityId, cancellationToken) ?? throw new InventoryException("INVENTORY_NOT_FOUND", "Inventory balance was not found.");
        if (!balance.Medicine.IsActive) throw new InventoryException("MEDICINE_INACTIVE", "Medicine is archived and cannot be adjusted.");
        var newQuantity = balance.QuantityOnHand + request.QuantityDelta;
        if (newQuantity < balance.QuantityReserved) throw new InventoryException("NEGATIVE_AVAILABLE_STOCK", "Adjustment would make available stock negative.");
        balance.QuantityOnHand = newQuantity;
        balance.UpdatedAtUtc = DateTime.UtcNow;

        // A negative adjustment has to come out of the batches that actually hold the
        // stock. Without this the balance drops but MedicineBatches keeps its quantity,
        // so the two disagree - and ArchiveAsync, which checks both, then refuses to
        // archive a medicine the UI reports as empty.
        //
        // Earliest expiry first, and batch plus balance move together in one save, which
        // is the convention BatchService.RetireAsync already follows.
        if (request.QuantityDelta < 0)
        {
            var outstanding = -request.QuantityDelta;
            var batches = await db.MedicineBatches
                .Where(x => x.MedicineId == request.MedicineId && x.FacilityId == request.FacilityId && x.QuantityOnHand > 0)
                .OrderBy(x => x.ExpiryDateUtc)
                .ToListAsync(cancellationToken);

            foreach (var batch in batches)
            {
                if (outstanding <= 0) break;
                var drawn = Math.Min(batch.QuantityOnHand, outstanding);
                batch.QuantityOnHand -= drawn;
                outstanding -= drawn;
            }
        }

        db.StockTransactions.Add(new StockTransaction { Id = Guid.NewGuid(), MedicineId = request.MedicineId, FacilityId = request.FacilityId, Type = Domain.Enums.StockTransactionType.Adjustment, Quantity = request.QuantityDelta, BalanceAfter = newQuantity, Reason = request.Reason.Trim(), CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        return Map(balance);
    }

    public async Task<InventoryResponse> ReserveAsync(ReserveStockRequest request, CancellationToken cancellationToken)
    {
        InventoryValidator.ValidateQuantity(request.Quantity);
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new InventoryException("REASON_REQUIRED", "A reservation reason is required.");
        var balance = await db.InventoryBalances.Include(x => x.Medicine).Include(x => x.Facility).FirstOrDefaultAsync(x => x.MedicineId == request.MedicineId && x.FacilityId == request.FacilityId, cancellationToken) ?? throw new InventoryException("INVENTORY_NOT_FOUND", "Inventory balance was not found.");
        if (!balance.Medicine.IsActive) throw new InventoryException("MEDICINE_INACTIVE", "Medicine is archived and cannot be reserved.");
        if (request.Quantity > balance.AvailableQuantity) throw new InventoryException("INSUFFICIENT_STOCK", "Reservation exceeds available stock.");
        balance.QuantityReserved += request.Quantity;
        balance.UpdatedAtUtc = DateTime.UtcNow;
        db.StockTransactions.Add(new StockTransaction { Id = Guid.NewGuid(), MedicineId = request.MedicineId, FacilityId = request.FacilityId, Type = Domain.Enums.StockTransactionType.Reservation, Quantity = request.Quantity, BalanceAfter = balance.AvailableQuantity, Reason = request.Reason.Trim(), CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        return Map(balance);
    }

    public async Task<IReadOnlyList<BatchResponse>> GetExpiringAsync(int days, CancellationToken cancellationToken)
    {
        if (days < 0) throw new InventoryException("INVALID_WINDOW", "Days cannot be negative.");
        var cutoff = DateTime.UtcNow.AddDays(days);
        return await db.MedicineBatches.AsNoTracking().Include(x => x.Medicine).Include(x => x.Facility).Where(x => x.Medicine.IsActive && x.Facility.IsActive && x.QuantityOnHand > 0 && x.ExpiryDateUtc <= cutoff).OrderBy(x => x.ExpiryDateUtc).Select(x => new BatchResponse(x.Id, x.MedicineId, x.Medicine.Name, x.FacilityId, x.BatchNumber, x.QuantityOnHand, x.ExpiryDateUtc, x.ManufacturingDateUtc)).ToListAsync(cancellationToken);
    }

    private async Task<InventoryBalance> GetOrCreateBalanceAsync(Guid medicineId, Guid facilityId, CancellationToken cancellationToken)
    {
        var balance = await db.InventoryBalances.FirstOrDefaultAsync(x => x.MedicineId == medicineId && x.FacilityId == facilityId, cancellationToken);
        if (balance is not null) return balance;
        balance = new InventoryBalance { Id = Guid.NewGuid(), MedicineId = medicineId, FacilityId = facilityId };
        db.InventoryBalances.Add(balance);
        return balance;
    }

    private async Task EnsureFacilityAsync(Guid facilityId, CancellationToken cancellationToken)
    {
        if (!await db.Facilities.AnyAsync(x => x.Id == facilityId && x.IsActive, cancellationToken)) throw new InventoryException("FACILITY_NOT_FOUND", "Facility was not found.");
    }

    public static string Pluralize(string? unit, int qty)
    {
        if (qty == 1) return unit ?? "unit";
        return unit?.ToLowerInvariant() switch
        {
            "tablet" or "tablets"   => "tablets",
            "capsule" or "capsules" => "capsules",
            "vial" or "vials"       => "vials",
            "bottle" or "bottles"   => "bottles",
            "strip" or "strips"     => "strips",
            "box" or "boxes"        => "boxes",
            _                       => string.IsNullOrWhiteSpace(unit) ? "units" : (unit.EndsWith("s", StringComparison.OrdinalIgnoreCase) ? unit : unit + "s")
        };
    }

    public static string FormatUnitDisplay(int qty, string? unit) =>
        $"{qty} {Pluralize(unit, qty)}";

    private static InventoryResponse Map(InventoryBalance x) => Map(x, x.Medicine, x.Facility);
    private static InventoryResponse Map(InventoryBalance x, Medicine medicine, Facility facility)
    {
        var unit = string.IsNullOrWhiteSpace(medicine?.Unit) ? "unit" : medicine.Unit;
        var unitDisplay = FormatUnitDisplay(x.QuantityOnHand, unit);
        return new(
            x.Id,
            medicine?.Id ?? x.MedicineId,
            medicine?.Name ?? "Unknown Medicine",
            facility?.Id ?? x.FacilityId,
            facility?.Name ?? "Unknown Facility",
            x.QuantityOnHand,
            x.QuantityReserved,
            x.AvailableQuantity,
            medicine?.MinimumStockLevel ?? 0,
            medicine != null && x.QuantityOnHand < medicine.MinimumStockLevel,
            medicine?.IsActive ?? true,
            unit,
            unitDisplay,
            null
        );
    }
}

public sealed class InventoryException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
