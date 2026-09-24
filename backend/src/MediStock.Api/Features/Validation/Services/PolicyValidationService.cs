using MediStock.Api.Domain.Rules;
using MediStock.Api.Security;

namespace MediStock.Api.Features.Validation.Services;

public sealed class PolicyValidationService
{
    private readonly FacilityAuthorizationService _facilityAuthorizationService;

    public PolicyValidationService(
        FacilityAuthorizationService facilityAuthorizationService)
    {
        _facilityAuthorizationService = facilityAuthorizationService;
    }

    public ValidationResult ValidateQuantity(
        int quantity)
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

    public ValidationResult ValidateStorageCompatibility(
        bool isCompatible)
    {
        if (!isCompatible)
        {
            return ValidationResult.Failure(
                "STORAGE_INCOMPATIBLE",
                "Destination facility storage conditions are incompatible with the medicine requirements.");
        }

        return ValidationResult.Success();
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
        var quantityResult = ValidateQuantity(transferQuantity);

        if (!quantityResult.IsValid)
        {
            return quantityResult;
        }

        var minimumStockResult = ValidateMinimumStock(
            sourceStock,
            reservedStock,
            minimumStock,
            transferQuantity);

        if (!minimumStockResult.IsValid)
        {
            return minimumStockResult;
        }

        var expiryResult = ValidateExpiry(
            expiryDate,
            currentDate);

        if (!expiryResult.IsValid)
        {
            return expiryResult;
        }

        var storageResult = ValidateStorageCompatibility(
            storageCompatible);

        if (!storageResult.IsValid)
        {
            return storageResult;
        }

        return ValidationResult.Success();
    }
}
