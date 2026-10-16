namespace MediStock.Api.Features.Demand.Validators;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;

/// <summary>
/// Outcome of a deterministic validation check.
/// </summary>
/// <param name="IsValid">True when the request satisfies every rule.</param>
/// <param name="Code">Machine-readable error code, null when valid.</param>
/// <param name="Message">Human-readable reason, null when valid.</param>
public readonly record struct DemandValidationResult(bool IsValid, string? Code, string? Message)
{
    public static DemandValidationResult Valid() => new(true, null, null);

    public static DemandValidationResult Invalid(string code, string message) => new(false, code, message);
}

/// <summary>
/// Deterministic request validation for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// Authoritative business validation is deterministic backend code, never LLM reasoning.
/// Every agent-originated request reaches these same rules through the controllers.
///
/// Not specified in the final blueprint: the full error-code catalogue. Only the shape
/// { success, error: { code, message, traceId } } is frozen. The codes below are scoped
/// to the Demand vertical and must be confirmed with the error-format owner,
/// Arudkumaran V. (IT24103011), before integration.
/// </summary>
public class DemandValidator
{
    public const string ValidationErrorCode = "DEMAND_VALIDATION_ERROR";
    public const string UnsupportedMethodCode = "DEMAND_UNSUPPORTED_FORECAST_METHOD";
    public const string InsufficientHistoryCode = "DEMAND_INSUFFICIENT_HISTORY";
    public const string ThresholdNotFoundCode = "DEMAND_THRESHOLD_NOT_FOUND";
    public const string NotFoundCode = "DEMAND_NOT_FOUND";
    public const string UnsupportedStatusCode = "DEMAND_UNSUPPORTED_STATUS";
    public const string StockNotFoundCode = "DEMAND_STOCK_NOT_FOUND";

    /// <summary>
    /// Longest historical window and forward horizon accepted, so a single request
    /// cannot scan an unbounded slice of the consumption table.
    /// </summary>
    public const int MaxWindowDays = 365;

    public DemandValidationResult ValidateConsumptionRequest(ConsumptionRequest request)
    {
        if (request is null)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "A consumption request body is required.");
        }

        if (request.FacilityId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "facilityId is required.");
        }

        if (request.MedicineId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "medicineId is required.");
        }

        if (request.QuantityUsed <= 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "quantityUsed must be greater than zero.");
        }

        if (request.ConsumptionDate == default)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "consumptionDate is required.");
        }

        // Consumption is a record of what has already been used, so a future date is
        // never a valid observation.
        if (request.ConsumptionDate.ToUniversalTime().Date > DateTime.UtcNow.Date)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "consumptionDate cannot be in the future.");
        }

        if (string.IsNullOrWhiteSpace(request.Source))
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "source is required.");
        }

        if (request.Source.Length > 64)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "source must be 64 characters or fewer.");
        }

        if (request.Notes is { Length: > 512 })
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "notes must be 512 characters or fewer.");
        }

        return DemandValidationResult.Valid();
    }

    public DemandValidationResult ValidateForecastRequest(ForecastRequest request)
    {
        if (request is null)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "A forecast request body is required.");
        }

        if (request.FacilityId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "facilityId is required.");
        }

        if (request.MedicineId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "medicineId is required.");
        }

        if (request.WindowDays is <= 0 or > MaxWindowDays)
        {
            return DemandValidationResult.Invalid(
                ValidationErrorCode,
                $"windowDays must be between 1 and {MaxWindowDays}.");
        }

        if (request.HorizonDays is <= 0 or > MaxWindowDays)
        {
            return DemandValidationResult.Invalid(
                ValidationErrorCode,
                $"horizonDays must be between 1 and {MaxWindowDays}.");
        }

        if (!ForecastMethods.IsSupported(request.Method))
        {
            return DemandValidationResult.Invalid(
                UnsupportedMethodCode,
                "method must be one of MOVING_AVERAGE, WEIGHTED_MOVING_AVERAGE or SIMPLE_TREND.");
        }

        if (request.LeadTimeDays is < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "leadTimeDays cannot be negative.");
        }

        return DemandValidationResult.Valid();
    }

    public DemandValidationResult ValidateRecalculateRequest(ShortageRecalculateRequest request)
    {
        if (request is null)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "A recalculate request body is required.");
        }

        if (request.FacilityId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "facilityId is required.");
        }

        if (request.MedicineId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "medicineId is required.");
        }

        if (request.CurrentStock < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "currentStock cannot be negative.");
        }

        if (request.AverageDailyConsumption is < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "averageDailyConsumption cannot be negative.");
        }

        if (request.LeadTimeDays is < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "leadTimeDays cannot be negative.");
        }

        if (request.WindowDays is <= 0 or > MaxWindowDays)
        {
            return DemandValidationResult.Invalid(
                ValidationErrorCode,
                $"windowDays must be between 1 and {MaxWindowDays}.");
        }

        return DemandValidationResult.Valid();
    }

    public DemandValidationResult ValidateShortageCreateRequest(ShortageCreateRequest request)
    {
        if (request is null)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "A shortage request body is required.");
        }

        if (request.FacilityId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "facilityId is required.");
        }

        if (request.MedicineId == Guid.Empty)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "medicineId is required.");
        }

        if (request.CurrentStock < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "currentStock cannot be negative.");
        }

        if (request.AverageDailyConsumption is < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "averageDailyConsumption cannot be negative.");
        }

        if (request.LeadTimeDays is < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "leadTimeDays cannot be negative.");
        }

        if (request.WindowDays is <= 0 or > MaxWindowDays)
        {
            return DemandValidationResult.Invalid(
                ValidationErrorCode,
                $"windowDays must be between 1 and {MaxWindowDays}.");
        }

        return DemandValidationResult.Valid();
    }

    public DemandValidationResult ValidateShortageUpdateRequest(ShortageUpdateRequest request)
    {
        if (request is null)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "An update request body is required.");
        }

        // An update that changes nothing is a caller mistake, not a no-op to absorb.
        if (request.Status is null && request.CurrentStock is null && request.LeadTimeDays is null)
        {
            return DemandValidationResult.Invalid(
                ValidationErrorCode,
                "Supply at least one of status, currentStock or leadTimeDays.");
        }

        if (request.Status is not null && !ShortageAlertStatuses.IsSupported(request.Status))
        {
            return DemandValidationResult.Invalid(
                UnsupportedStatusCode,
                $"status must be one of {string.Join(", ", ShortageAlertStatuses.All)}.");
        }

        if (request.CurrentStock is < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "currentStock cannot be negative.");
        }

        if (request.LeadTimeDays is < 0)
        {
            return DemandValidationResult.Invalid(ValidationErrorCode, "leadTimeDays cannot be negative.");
        }

        return DemandValidationResult.Valid();
    }

    /// <summary>
    /// Clamps paging to the frozen convention so a caller cannot request an unbounded page.
    /// </summary>
    public static (int Page, int PageSize) NormalisePaging(int page, int pageSize)
    {
        var safePage = page < 1 ? Constants.DefaultPage : page;
        var safePageSize = pageSize switch
        {
            < 1 => Constants.DefaultPageSize,
            > Constants.MaxPageSize => Constants.MaxPageSize,
            _ => pageSize
        };

        return (safePage, safePageSize);
    }
}
