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

    // Supplier validation (procurement branch — required by SupplierService)
    public static void ValidateSupplier(SupplierRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ProcurementException(
                "SUPPLIER_NAME_REQUIRED",
                "Supplier name is required.");

        if (request.Name.Trim().Length > 200)
            throw new ProcurementException(
                "SUPPLIER_NAME_TOO_LONG",
                "Supplier name cannot exceed 200 characters.");

        if (string.IsNullOrWhiteSpace(request.ContactPerson))
            throw new ProcurementException(
                "SUPPLIER_CONTACT_REQUIRED",
                "Contact person is required.");

        if (request.ContactPerson.Trim().Length > 150)
            throw new ProcurementException(
                "SUPPLIER_CONTACT_TOO_LONG",
                "Contact person cannot exceed 150 characters.");

        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ProcurementException(
                "SUPPLIER_EMAIL_REQUIRED",
                "Supplier email is required.");

        var trimmedEmail = request.Email.Trim();
        if (trimmedEmail.Length > 254 || !trimmedEmail.Contains('@') || !trimmedEmail.Contains('.'))
            throw new ProcurementException(
                "INVALID_EMAIL_FORMAT",
                "Supplier email must be a valid email address.");

        if (string.IsNullOrWhiteSpace(request.Phone))
            throw new ProcurementException(
                "SUPPLIER_PHONE_REQUIRED",
                "Supplier phone is required.");

        if (request.Phone.Trim().Length > 30)
            throw new ProcurementException(
                "SUPPLIER_PHONE_TOO_LONG",
                "Supplier phone cannot exceed 30 characters.");

        if (string.IsNullOrWhiteSpace(request.Address))
            throw new ProcurementException(
                "SUPPLIER_ADDRESS_REQUIRED",
                "Supplier address is required.");

        if (request.Address.Trim().Length > 500)
            throw new ProcurementException(
                "SUPPLIER_ADDRESS_TOO_LONG",
                "Supplier address cannot exceed 500 characters.");

        if (request.LeadTimeDays < 0)
            throw new ProcurementException(
                "INVALID_LEAD_TIME",
                "Lead time days must be greater than or equal to zero.");
    }
}