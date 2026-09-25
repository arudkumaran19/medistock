using MediStock.Api.Features.Procurement;
using MediStock.Api.Features.Procurement.DTOs;

namespace MediStock.Api.Features.Procurement.Validators;

public static class ProcurementValidator
{
    public static void ValidatePurchaseOrder(PurchaseOrderRequest request)
    {
        if (request.SupplierId == Guid.Empty)
            throw new ProcurementException(
                "SUPPLIER_REQUIRED",
                "Supplier is required.");

        if (request.FacilityId == Guid.Empty)
            throw new ProcurementException(
                "FACILITY_REQUIRED",
                "Facility is required.");

        if (request.Items is null || request.Items.Count == 0)
            throw new ProcurementException(
                "ITEMS_REQUIRED",
                "At least one purchase order item is required.");

        var duplicateMedicineIds = request.Items
            .GroupBy(item => item.MedicineId)
            .Where(group => group.Key != Guid.Empty && group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        if (duplicateMedicineIds.Count > 0)
            throw new ProcurementException(
                "DUPLICATE_MEDICINE",
                "A medicine cannot appear more than once in the same purchase order.");

        foreach (var item in request.Items)
        {
            if (item.MedicineId == Guid.Empty)
                throw new ProcurementException(
                    "MEDICINE_REQUIRED",
                    "Medicine is required for every purchase order item.");

            if (item.RequestedQuantity <= 0)
                throw new ProcurementException(
                    "INVALID_QUANTITY",
                    "Requested quantity must be greater than zero.");

            if (item.UnitPrice < 0)
                throw new ProcurementException(
                    "INVALID_UNIT_PRICE",
                    "Unit price cannot be negative.");
        }
    }


}