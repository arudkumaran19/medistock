namespace MediStock.Api.Features.Validation.DTOs;

public sealed record ValidateTransferRequest(
    int SourceStock,
    int ReservedStock,
    int MinimumStock,
    int TransferQuantity,
    DateOnly ExpiryDate,
    DateOnly CurrentDate,
    bool StorageCompatible,
    Guid? FacilityId = null);

public sealed record ValidateTransferResponse(
    bool IsValid,
    string Code,
    string Message);

public sealed record ValidateProcurementItemRequest(
    Guid MedicineId,
    int RequestedQuantity,
    decimal UnitPrice);

public sealed record ValidateProcurementRequest(
    Guid SupplierId,
    Guid FacilityId,
    IReadOnlyList<ValidateProcurementItemRequest> Items);

public sealed record ValidateProcurementResponse(
    bool IsValid,
    string Code,
    string Message,
    bool RequiresApproval,
    decimal TotalEstimatedCost,
    int SupplierLeadTimeDays);

public sealed record PolicyRuleResponse(
    string RuleName,
    string Description,
    string Category,
    decimal? Threshold = null,
    bool RequiresApproval = false);

