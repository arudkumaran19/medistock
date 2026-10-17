using System;

namespace MediStock.Api.Features.Inventory.DTOs;

public sealed record InventoryResponse(
    Guid Id,
    Guid MedicineId,
    string MedicineName,
    Guid FacilityId,
    string FacilityName,
    int QuantityOnHand,
    int QuantityReserved,
    int AvailableQuantity,
    int MinimumStockLevel,
    bool IsBelowMinimum,
    bool IsMedicineActive,
    string Unit = "unit",
    string UnitDisplay = "units",
    string? PackBreakdown = null
)
{
    public InventoryResponse(
        Guid id,
        Guid medicineId,
        string medicineName,
        Guid facilityId,
        string facilityName,
        int quantityOnHand,
        int quantityReserved,
        int availableQuantity,
        int minimumStockLevel,
        bool isBelowMinimum,
        bool isMedicineActive)
        : this(id, medicineId, medicineName, facilityId, facilityName, quantityOnHand, quantityReserved, availableQuantity, minimumStockLevel, isBelowMinimum, isMedicineActive, "unit", "units", null)
    {
    }
}
