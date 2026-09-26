using MediStock.Api.Domain.Rules;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Validation.DTOs;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Validation.Services;

public sealed class PolicyValidationService
{
    private readonly FacilityAuthorizationService _facilityAuthorizationService;
    private readonly ApplicationDbContext? _dbContext;

    public PolicyValidationService(
        FacilityAuthorizationService facilityAuthorizationService)
        : this(facilityAuthorizationService, null)
    {
    }

    public PolicyValidationService(
        FacilityAuthorizationService facilityAuthorizationService,
        ApplicationDbContext? dbContext)
    {
        _facilityAuthorizationService = facilityAuthorizationService;
        _dbContext = dbContext;
    }

    public ValidationResult ValidateQuantity(int quantity)
    {
        if (quantity <= 0)
        {
            return ValidationResult.Failure(
                "INVALID_QUANTITY",
                "Quantity must be greater than zero.");
        }

        return ValidationResult.Success();
    }

    public ValidationResult ValidateMinimumStock(
        int sourceStock,
        int reservedStock,
        int minimumStock,
        int transferQuantity)
    {
        return MinimumStockRule.Validate(
            sourceStock,
            reservedStock,
            minimumStock,
            transferQuantity);
    }

    public ValidationResult ValidateExpiry(
        DateOnly expiryDate,
        DateOnly currentDate)
    {
        return ExpiryRule.Validate(
            expiryDate,
            currentDate);
    }

    public async Task<ValidationResult> ValidateAuthorizationAsync(
        Guid facilityId,
        CancellationToken cancellationToken = default)
    {
        var authorized =
            await _facilityAuthorizationService.CanAccessFacilityAsync(
                facilityId,
                cancellationToken);

        if (!authorized)
        {
            return ValidationResult.Failure(
                "UNAUTHORIZED_FACILITY_ACCESS",
                "User is not authorized to access the specified facility.");
        }

        return ValidationResult.Success();
    }

    public ValidationResult ValidateStorageCompatibility(bool isCompatible)
    {
        return StorageCompatibilityRule.Validate(isCompatible);
    }

    public ValidationResult ValidateTransfer(
        int sourceStock,
        int reservedStock,
        int minimumStock,
        int transferQuantity,
        DateOnly expiryDate,
        DateOnly currentDate,
        bool storageCompatible)
    {
        return TransferPolicy.Validate(
            sourceStock,
            reservedStock,
            minimumStock,
            transferQuantity,
            expiryDate,
            currentDate,
            storageCompatible,
            isAuthorized: true);
    }

    public ValidationResult ValidateSupplierEligibility(Supplier? supplier)
    {
        if (supplier is null)
        {
            return ValidationResult.Failure(
                "SUPPLIER_NOT_FOUND",
                "Supplier was not found.");
        }

        if (!supplier.IsActive)
        {
            return ValidationResult.Failure(
                "SUPPLIER_INACTIVE",
                "Supplier is inactive and cannot accept purchase orders.");
        }

        if (supplier.LeadTimeDays < 0)
        {
            return ValidationResult.Failure(
                "INVALID_LEAD_TIME",
                "Supplier lead time cannot be negative.");
        }

        return ValidationResult.Success();
    }

    public bool CheckApprovalRequirement(
        decimal totalAmount,
        int totalQuantity,
        decimal amountThreshold = 10000m,
        int quantityThreshold = 500)
    {
        return totalAmount >= amountThreshold || totalQuantity >= quantityThreshold;
    }

    public async Task<ValidateProcurementResponse> ValidateProcurementAsync(
        ValidateProcurementRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.SupplierId == Guid.Empty)
        {
            return new ValidateProcurementResponse(
                false,
                "SUPPLIER_REQUIRED",
                "Supplier ID is required.",
                false,
                0m,
                0);
        }

        if (request.FacilityId == Guid.Empty)
        {
            return new ValidateProcurementResponse(
                false,
                "FACILITY_REQUIRED",
                "Facility ID is required.",
                false,
                0m,
                0);
        }

        if (request.Items is null || request.Items.Count == 0)
        {
            return new ValidateProcurementResponse(
                false,
                "ITEMS_REQUIRED",
                "At least one item is required for procurement.",
                false,
                0m,
                0);
        }

        var duplicateMedicine = request.Items
            .GroupBy(i => i.MedicineId)
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicateMedicine is not null)
        {
            return new ValidateProcurementResponse(
                false,
                "DUPLICATE_MEDICINE",
                "A medicine cannot appear more than once in the same procurement request.",
                false,
                0m,
                0);
        }

        int totalQuantity = 0;
        decimal totalEstimatedCost = 0m;

        foreach (var item in request.Items)
        {
            if (item.MedicineId == Guid.Empty)
            {
                return new ValidateProcurementResponse(
                    false,
                    "MEDICINE_REQUIRED",
                    "Medicine ID is required for each item.",
                    false,
                    0m,
                    0);
            }

            if (item.RequestedQuantity <= 0)
            {
                return new ValidateProcurementResponse(
                    false,
                    "INVALID_QUANTITY",
                    "Requested quantity must be greater than zero.",
                    false,
                    0m,
                    0);
            }

            if (item.UnitPrice < 0)
            {
                return new ValidateProcurementResponse(
                    false,
                    "INVALID_UNIT_PRICE",
                    "Unit price cannot be negative.",
                    false,
                    0m,
                    0);
            }

            totalQuantity += item.RequestedQuantity;
            totalEstimatedCost += item.RequestedQuantity * item.UnitPrice;
        }

        int leadTimeDays = 0;

        if (_dbContext is not null)
        {
            var supplier = await _dbContext.Suppliers
                .AsNoTracking()
                .SingleOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);

            var supplierResult = ValidateSupplierEligibility(supplier);
            if (!supplierResult.IsValid)
            {
                return new ValidateProcurementResponse(
                    false,
                    supplierResult.Code,
                    supplierResult.Message,
                    false,
                    totalEstimatedCost,
                    0);
            }

            leadTimeDays = supplier!.LeadTimeDays;
        }

        bool requiresApproval = CheckApprovalRequirement(totalEstimatedCost, totalQuantity);

        return new ValidateProcurementResponse(
            true,
            "VALID",
            "Procurement policy validation passed.",
            requiresApproval,
            totalEstimatedCost,
            leadTimeDays);
    }
}
