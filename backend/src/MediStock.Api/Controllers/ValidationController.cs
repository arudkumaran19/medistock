using MediStock.Api.Features.Validation.DTOs;
using MediStock.Api.Features.Validation.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/validation")]
[Authorize]
public sealed class ValidationController : ControllerBase
{
    private readonly PolicyValidationService _validationService;

    public ValidationController(PolicyValidationService validationService)
    {
        _validationService = validationService;
    }

    [HttpPost("transfer")]
    public async Task<ActionResult<ValidateTransferResponse>> ValidateTransfer(
        [FromBody] ValidateTransferRequest request,
        CancellationToken cancellationToken)
    {
        if (request.FacilityId.HasValue && request.FacilityId.Value != Guid.Empty)
        {
            var authResult = await _validationService.ValidateAuthorizationAsync(
                request.FacilityId.Value,
                cancellationToken);

            if (!authResult.IsValid)
            {
                return Ok(new ValidateTransferResponse(
                    false,
                    authResult.Code,
                    authResult.Message));
            }
        }

        var result = _validationService.ValidateTransfer(
            request.SourceStock,
            request.ReservedStock,
            request.MinimumStock,
            request.TransferQuantity,
            request.ExpiryDate,
            request.CurrentDate,
            request.StorageCompatible);

        return Ok(new ValidateTransferResponse(
            result.IsValid,
            result.Code,
            result.Message));
    }

    [HttpPost("procurement")]
    public async Task<ActionResult<ValidateProcurementResponse>> ValidateProcurement(
        [FromBody] ValidateProcurementRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _validationService.ValidateProcurementAsync(
            request,
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("authorization-rules")]
    public ActionResult<IReadOnlyList<PolicyRuleResponse>> GetAuthorizationRules()
    {
        var rules = new List<PolicyRuleResponse>
        {
            new("HighValueProcurement", "Orders exceeding $10,000 total estimated cost require administrative approval.", "Procurement", 10000m, true),
            new("BulkQuantityThreshold", "Procurement requests exceeding 1,000 total units require managerial approval.", "Procurement", 1000m, true),
            new("FacilityAuthorization", "Procurement requests must originate from and be authorized for registered clinical facilities.", "Authorization", null, false),
            new("ActiveSupplierVerification", "Orders may only be placed with verified and active suppliers.", "Supplier", null, false),
        };
        return Ok(rules);
    }

    [HttpGet("storage-rules")]
    public ActionResult<IReadOnlyList<PolicyRuleResponse>> GetStorageRules()
    {
        var rules = new List<PolicyRuleResponse>
        {
            new("ColdChainStorage", "Refrigerated medicines (2-8°C) must be stored in compliant cold storage facilities.", "Storage", null, false),
            new("ControlledSubstances", "Schedule II-V drugs require dual-custody locked vault storage.", "Storage", null, true),
            new("HazardousMaterialIsolation", "Cytotoxic and hazardous medicines must be kept isolated from general inventory.", "Storage", null, false),
        };
        return Ok(rules);
    }
}
