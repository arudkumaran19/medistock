using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Features.Inventory.Validators;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Inventory.Services;

public sealed class MedicineService(ApplicationDbContext db)
{
    public async Task<MedicineResponse> CreateAsync(CreateMedicineRequest request, CancellationToken cancellationToken)
    {
        var code = InventoryValidator.ValidateMedicineCode(request.Code);
        var name = InventoryValidator.ValidateMedicineName(request.Name);
        var unit = InventoryValidator.ValidateUnit(request.Unit);
        var minimumStockLevel = InventoryValidator.ValidateMinimumStockLevel(request.MinimumStockLevel);
        if (await db.Medicines.AnyAsync(x => x.Code == code, cancellationToken)) throw new InventoryException("MEDICINE_CODE_EXISTS", "A medicine with this code already exists.");
        var medicine = new MediStock.Api.Features.Inventory.Models.Medicine { Id = Guid.NewGuid(), Code = code, Name = name, Unit = unit, MinimumStockLevel = minimumStockLevel };
        db.Medicines.Add(medicine);
        await db.SaveChangesAsync(cancellationToken);
        return new MedicineResponse(medicine.Id, medicine.Code, medicine.Name, medicine.Unit, medicine.MinimumStockLevel, medicine.IsActive);
    }

    public async Task<MedicineResponse> UpdateAsync(Guid id, UpdateMedicineRequest request, CancellationToken cancellationToken)
    {
        var name = InventoryValidator.ValidateMedicineName(request.Name);
        var unit = InventoryValidator.ValidateUnit(request.Unit);
        var minimumStockLevel = InventoryValidator.ValidateMinimumStockLevel(request.MinimumStockLevel);
        var medicine = await db.Medicines.FirstOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new InventoryException("MEDICINE_NOT_FOUND", "Medicine was not found.");
        if (!medicine.IsActive) throw new InventoryException("MEDICINE_INACTIVE", "Archived medicine cannot be edited.");
        medicine.Name = name;
        medicine.Unit = unit;
        medicine.MinimumStockLevel = minimumStockLevel;
        await db.SaveChangesAsync(cancellationToken);
        return new MedicineResponse(medicine.Id, medicine.Code, medicine.Name, medicine.Unit, medicine.MinimumStockLevel, medicine.IsActive);
    }

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
