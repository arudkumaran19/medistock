using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Inventory.Services;

public sealed class MedicineService(ApplicationDbContext db)
{
    public async Task<MedicineResponse> ArchiveAsync(Guid id, ArchiveMedicineRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new InventoryException("REASON_REQUIRED", "An archive reason is required.");
        var medicine = await db.Medicines.FirstOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new InventoryException("MEDICINE_NOT_FOUND", "Medicine was not found.");
        if (!medicine.IsActive) return new MedicineResponse(medicine.Id, medicine.Code, medicine.Name, medicine.Unit, medicine.MinimumStockLevel, false);
        var hasStock = await db.InventoryBalances.AnyAsync(x => x.MedicineId == id && (x.QuantityOnHand > 0 || x.QuantityReserved > 0), cancellationToken)
            || await db.MedicineBatches.AnyAsync(x => x.MedicineId == id && x.QuantityOnHand > 0, cancellationToken);
        if (hasStock) throw new InventoryException("MEDICINE_HAS_STOCK", "Medicine cannot be archived while stock remains.");
        medicine.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return new MedicineResponse(medicine.Id, medicine.Code, medicine.Name, medicine.Unit, medicine.MinimumStockLevel, false);
    }
}