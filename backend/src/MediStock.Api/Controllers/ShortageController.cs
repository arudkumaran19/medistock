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
    private readonly DemandValidator _validator;

    public ShortageController(ShortageService shortageService, DemandValidator validator)
    {
        _shortageService = shortageService;
        _validator = validator;
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

        var alert = await _shortageService.CreateShortageAsync(request, cancellationToken);

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

        var alert = await _shortageService.RecalculateShortageAsync(request, cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiResponse<ShortageResponse>(alert));
    }
}
