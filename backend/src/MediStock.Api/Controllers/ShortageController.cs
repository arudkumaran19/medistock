using System.Security.Claims;
using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Features.Redistribution.Hubs;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MediStock.Api.Controllers;

/// <summary>
/// Shortage endpoints of the frozen Demand API contract.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
///
///   GET  /api/shortages
///   GET  /api/shortages/{id}
///   POST /api/shortages/recalculate
///   POST /api/shortages/scan            (automatic re-evaluation, not in the frozen contract)
///   GET  /api/shortages/current-stock   (Inventory balance read, not in the frozen contract)
///   POST /api/shortages/{id}/dismiss    (dismiss as false positive)
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
    private readonly IHubContext<TransferHub, ITransferHubClient> _hub;
    private readonly CurrentUserService _currentUserService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ShortageController>? _logger;

    public ShortageController(
        ShortageService shortageService,
        ShortageEvaluationService evaluationService,
        DemandValidator validator,
        IHubContext<TransferHub, ITransferHubClient> hub,
        CurrentUserService currentUserService,
        ApplicationDbContext db,
        ILogger<ShortageController>? logger = null)
    {
        _shortageService = shortageService;
        _evaluationService = evaluationService;
        _validator = validator;
        _hub = hub;
        _currentUserService = currentUserService;
        _db = db;
        _logger = logger;
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
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetShortages(
        [FromQuery] ShortageQuery query,
        CancellationToken cancellationToken)
    {
        var validation = _validator.ValidateShortageQuery(query);
        if (!validation.IsValid)
        {
            return BadRequest(Error(validation.Code!, validation.Message!));
        }

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

        ShortageResponse response;

        try
        {
            response = await _shortageService.CreateShortageAsync(request, cancellationToken);
        }
        catch (ShortageStockNotFoundException ex)
        {
            return BadRequest(Error(DemandValidator.StockNotFoundCode, ex.Message));
        }

        await _hub.Clients
            .Group("all_facility_users")
            .ShortageAlertCreated(response);

        await _hub.Clients
            .Group("managers")
            .ShortageAlertCreated(response);

        _logger?.LogInformation("SignalR broadcast to all_facility_users and managers for shortage alert {AlertId}", response.Id);

        // Raising an alert that is already active refreshes it rather than duplicating
        // it, so that case is a 200 on the existing resource, not a 201.
        if (response.ExistingAlertUpdated)
        {
            return Ok(new ApiResponse<ShortageResponse>(response));
        }

        return CreatedAtAction(
            nameof(GetShortageById),
            new { id = response.Id },
            new ApiResponse<ShortageResponse>(response));
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
    /// Dismisses a shortage alert as a false positive.
    /// Facility users can only dismiss alerts for their assigned facility.
    /// Administrators and Facility Managers can dismiss alerts for any facility.
    /// </summary>
    [HttpPost("{id:guid}/dismiss")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<ShortageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DismissShortage(
        Guid id,
        [FromBody] ShortageDismissRequest? request,
        CancellationToken cancellationToken)
    {
        // 1. Resolve user ID: if cannot be resolved return 401
        var userId = _currentUserService.UserId;
        if (!userId.HasValue || userId.Value == Guid.Empty)
        {
            return Unauthorized(Error("UNAUTHORIZED", "User identity could not be resolved from token."));
        }

        // 2. Fetch alert: if not found return 404
        var alert = await _db.ShortageAlerts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return NotFound(Error(DemandValidator.NotFoundCode, $"Shortage alert {id} was not found."));
        }

        // 3. Status check: Only OPEN and ACKNOWLEDGED alerts can be dismissed; others return 409
        var canDismiss = string.Equals(alert.Status, ShortageAlertStatuses.Open, StringComparison.OrdinalIgnoreCase)
                      || string.Equals(alert.Status, ShortageAlertStatuses.Acknowledged, StringComparison.OrdinalIgnoreCase);

        if (!canDismiss)
        {
            return Conflict(Error("CONFLICT", $"Shortage alert {id} is in status '{alert.Status}' and cannot be dismissed. Only OPEN or ACKNOWLEDGED alerts can be dismissed."));
        }

        // 4. Facility authorization check:
        // Treat Administrator/ADMIN and FacilityManager/FACILITY_MANAGER as "any facility";
        // other users only for facilities in UserFacilities.
        var isPrivilegedManager = User.Claims
            .Where(c => c.Type == ClaimTypes.Role || c.Type == "role")
            .Any(c => string.Equals(c.Value, "Administrator", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(c.Value, "ADMIN", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(c.Value, "FacilityManager", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(c.Value, "FACILITY_MANAGER", StringComparison.OrdinalIgnoreCase));

        if (!isPrivilegedManager)
        {
            var isAssigned = await _db.UserFacilities
                .AnyAsync(uf => uf.UserId == userId.Value && uf.FacilityId == alert.FacilityId, cancellationToken);

            if (!isAssigned)
            {
                return StatusCode(StatusCodes.Status403Forbidden, Error("FORBIDDEN", "You can only dismiss alerts for your own assigned facility."));
            }
        }

        // 5. Dismiss alert in service
        var response = await _shortageService.DismissShortageAsync(id, request?.Reason, userId.Value, cancellationToken);
        if (response is null)
        {
            return NotFound(Error(DemandValidator.NotFoundCode, $"Shortage alert {id} was not found."));
        }

        // 6. SignalR: broadcast ShortageAlertDismissed only to alert facility group and managers group
        var facilityGroup = TransferHub.GetFacilityGroupName(alert.FacilityId.ToString());
        await _hub.Clients
            .Group(facilityGroup)
            .ShortageAlertDismissed(response);

        await _hub.Clients
            .Group("managers")
            .ShortageAlertDismissed(response);

        _logger?.LogInformation(
            "Shortage alert {AlertId} dismissed. Broadcasted ShortageAlertDismissed to {FacilityGroup} and managers.",
            response.Id,
            facilityGroup);

        return Ok(new ApiResponse<ShortageResponse>(response));
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

        ShortageResponse response;

        try
        {
            response = await _shortageService.RecalculateShortageAsync(request, cancellationToken);
        }
        catch (ShortageStockNotFoundException ex)
        {
            return BadRequest(Error(DemandValidator.StockNotFoundCode, ex.Message));
        }

        if (response.Status != ShortageAlertStatuses.Dismissed)
        {
            await _hub.Clients
                .Group("all_facility_users")
                .ShortageAlertCreated(response);

            await _hub.Clients
                .Group("managers")
                .ShortageAlertCreated(response);

            _logger?.LogInformation("SignalR broadcast to all_facility_users and managers for shortage alert {AlertId}", response.Id);
        }

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiResponse<ShortageResponse>(response));
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
