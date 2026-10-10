namespace MediStock.Api.Controllers;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Demand.Validators;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Shortage endpoints of the frozen Demand API contract.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
///
///   GET  /api/shortages
///   GET  /api/shortages/{id}
///   POST /api/shortages/recalculate
///   POST /api/shortages/scan            (automatic re-evaluation, not in the frozen contract)
///   GET  /api/shortages/current-stock   (Inventory balance read, not in the frozen contract)
///
/// POST /api/shortages/recalculate is a non-CRUD business operation: it derives days of
/// stock, the projected stockout date and the shortage risk level.
/// </summary>
[ApiController]
[Route("api/shortages")]
[Authorize]
[Produces("application/json")]
public class ShortageController : ControllerBase
{
    private readonly ShortageService _shortageService;
    private readonly ShortageEvaluationService _evaluationService;
    private readonly DemandValidator _validator;

    public ShortageController(
        ShortageService shortageService,
        ShortageEvaluationService evaluationService,
        DemandValidator validator)
    {
        _shortageService = shortageService;
        _evaluationService = evaluationService;
        _validator = validator;
    }

    /// <summary>
    /// Stock available for a facility and medicine, read-only from the Inventory
    /// vertical's balance. Pre-fills the Raise alert form.
    ///
    /// Not in the frozen API contract (blueprint section 36). Added so a shortage alert
    /// does not depend on a typed-in stock number. Do not assume or introduce a new
    /// decision without team-level confirmation.
    /// </summary>
    [HttpGet("current-stock")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<CurrentStockResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCurrentStock(
        [FromQuery] Guid facilityId,
        [FromQuery] Guid medicineId,
        CancellationToken cancellationToken)
    {
        if (facilityId == Guid.Empty || medicineId == Guid.Empty)
        {
            return BadRequest(Error(DemandValidator.ValidationErrorCode, "facilityId and medicineId are required."));
        }

        var stock = await _shortageService.GetCurrentStockAsync(facilityId, medicineId, cancellationToken);

        if (stock is null)
        {
            return NotFound(Error(
                DemandValidator.StockNotFoundCode,
                $"No inventory balance exists for medicine {medicineId} at facility {facilityId}."));
        }

        return Ok(new ApiResponse<CurrentStockResponse>(stock));
    }

    /// <summary>
    /// Re-evaluates every facility and medicine with consumption history and a reorder
    /// rule: raises or refreshes alerts at risk and resolves alerts whose stock now
    /// covers the lead time. Backs the "Scan now" button.
    ///
    /// Not in the frozen API contract (blueprint section 36). Do not assume or
    /// introduce a new decision without team-level confirmation.
    /// </summary>
    [HttpPost("scan")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ShortageScanResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Scan(CancellationToken cancellationToken)
    {
        var result = await _evaluationService.ScanAsync(cancellationToken);

        return Ok(new ApiResponse<ShortageScanResponse>(result));
    }

    /// <summary>
    /// Paged shortage alerts, filterable by facility, medicine, status and risk level.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<ShortageResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetShortages(
        [FromQuery] ShortageQuery query,
        CancellationToken cancellationToken)
    {
        var result = await _shortageService.GetShortagesAsync(query, cancellationToken);

        return Ok(new ApiResponse<PagedResponse<ShortageResponse>>(result));
    }

    /// <summary>
    /// A single shortage alert.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ShortageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetShortageById(Guid id, CancellationToken cancellationToken)
    {
        var shortage = await _shortageService.GetShortageByIdAsync(id, cancellationToken);

        if (shortage is null)
        {
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Shortage alert {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return Ok(new ApiResponse<ShortageResponse>(shortage));
    }

    /// <summary>
    /// Raises a shortage alert directly, without waiting for a recalculation.
    ///
    /// Not in the frozen API contract (blueprint section 36), which lists no create,
    /// update or delete for shortages. Added for the shortage management screen.
    /// Do not assume or introduce a new decision without team-level confirmation.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ShortageResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateShortage(
        [FromBody] ShortageCreateRequest request,
        CancellationToken cancellationToken)
    {
        var validation = _validator.ValidateShortageCreateRequest(request);

        if (!validation.IsValid)
        {
            return BadRequest(new ErrorResponse
                              {
                                  Error = new ErrorDetail
                                  {
                                      Code = validation.Code!,
                                      Message = validation.Message!,
                                      TraceId = HttpContext.TraceIdentifier,
                                  },
                              });
        }

        ShortageResponse alert;

        try
        {
            alert = await _shortageService.CreateShortageAsync(request, cancellationToken);
        }
        catch (ShortageStockNotFoundException ex)
        {
            return BadRequest(Error(DemandValidator.StockNotFoundCode, ex.Message));
        }

        // Raising an alert that is already active refreshes it rather than duplicating
        // it, so that case is a 200 on the existing resource, not a 201.
        if (alert.ExistingAlertUpdated)
        {
            return Ok(new ApiResponse<ShortageResponse>(alert));
        }

        return CreatedAtAction(
            nameof(GetShortageById),
            new { id = alert.Id },
            new ApiResponse<ShortageResponse>(alert));
    }

    /// <summary>
    /// Updates an alert's status, stock figure or lead time. Changing a quantity
    /// re-runs the deterministic calculation.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ShortageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateShortage(
        Guid id,
        [FromBody] ShortageUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var validation = _validator.ValidateShortageUpdateRequest(request);

        if (!validation.IsValid)
        {
            return BadRequest(new ErrorResponse
                              {
                                  Error = new ErrorDetail
                                  {
                                      Code = validation.Code!,
                                      Message = validation.Message!,
                                      TraceId = HttpContext.TraceIdentifier,
                                  },
                              });
        }

        var alert = await _shortageService.UpdateShortageAsync(id, request, cancellationToken);

        if (alert is null)
        {
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Shortage alert {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return Ok(new ApiResponse<ShortageResponse>(alert));
    }

    /// <summary>
    /// Marks an alert resolved. The alert stays on record so the history is auditable.
    /// </summary>
    [HttpPost("{id:guid}/resolve")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ShortageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResolveShortage(Guid id, CancellationToken cancellationToken)
    {
        var alert = await _shortageService.ResolveShortageAsync(id, cancellationToken);

        if (alert is null)
        {
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Shortage alert {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return Ok(new ApiResponse<ShortageResponse>(alert));
    }

    /// <summary>
    /// Permanently removes an alert raised in error. Prefer resolve over delete.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteShortage(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await _shortageService.DeleteShortageAsync(id, cancellationToken);

        if (!deleted)
        {
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Shortage alert {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return NoContent();
    }

    /// <summary>
    /// Marks a shortage alert as acknowledged by a facility user.
    /// </summary>
    [HttpPost("{id:guid}/acknowledge")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<ShortageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AcknowledgeShortage(Guid id, CancellationToken cancellationToken)
    {
        var alert = await _shortageService.AcknowledgeShortageAsync(id, cancellationToken);

        if (alert is null)
        {
            return NotFound(new ErrorResponse
            {
                Error = new ErrorDetail
                {
                    Code = DemandValidator.NotFoundCode,
                    Message = $"Shortage alert {id} was not found.",
                    TraceId = HttpContext.TraceIdentifier,
                },
            });
        }

        return Ok(new ApiResponse<ShortageResponse>(alert));
    }

    /// <summary>
    /// Recalculates the projected stockout and shortage risk, and stores the alert.
    /// </summary>
    [HttpPost("recalculate")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ShortageResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RecalculateShortage(
        [FromBody] ShortageRecalculateRequest request,
        CancellationToken cancellationToken)
    {
        var validation = _validator.ValidateRecalculateRequest(request);

        if (!validation.IsValid)
        {
            return BadRequest(new ErrorResponse
                              {
                                  Error = new ErrorDetail
                                  {
                                      Code = validation.Code!,
                                      Message = validation.Message!,
                                      TraceId = HttpContext.TraceIdentifier,
                                  },
                              });
        }

        ShortageResponse alert;

        try
        {
            alert = await _shortageService.RecalculateShortageAsync(request, cancellationToken);
        }
        catch (ShortageStockNotFoundException ex)
        {
            return BadRequest(Error(DemandValidator.StockNotFoundCode, ex.Message));
        }

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiResponse<ShortageResponse>(alert));
    }

    private ErrorResponse Error(string code, string message) => new()
    {
        Error = new ErrorDetail
        {
            Code = code,
            Message = message,
            TraceId = HttpContext.TraceIdentifier,
        },
    };
}
