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
    string Unit,
    string UnitDisplay,
    string? PackBreakdown = null
);
