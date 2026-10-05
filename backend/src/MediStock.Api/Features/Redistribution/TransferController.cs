using System;
using System.Collections.Generic;
using System.Net.Mime;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MediStock.Api.Common;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Services;

namespace MediStock.Api.Features.Redistribution;

[ApiController]
[Route("api/transfers")]
[Produces(MediaTypeNames.Application.Json)]
public class TransferController : ControllerBase
{
    private readonly ITransferService _transferService;

    public TransferController(ITransferService transferService)
    {
        _transferService = transferService;
    }

    /// <summary>
    /// 1. GET /api/transfers - List transfers with pagination, search, sorting, and filtering
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<TransferResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransfers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "createdAt",
        [FromQuery] string? sortOrder = "desc",
        [FromQuery] Guid? facilityId = null,
        [FromQuery] TransferStatus? status = null,
        CancellationToken ct = default)
    {
        var result = await _transferService.GetTransfersAsync(page, pageSize, search, sortBy, sortOrder, facilityId, status, ct);
        return Ok(result);
    }

    /// <summary>
    /// 2. GET /api/transfers/{id} - Get detailed transfer by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTransferById([FromRoute] Guid id, CancellationToken ct = default)
    {
        var transfer = await _transferService.GetTransferByIdAsync(id, ct);
        if (transfer == null)
        {
            return NotFound(new ErrorResponse($"Transfer request with ID {id} not found.", "NOT_FOUND"));
        }

        return Ok(ApiResponse<TransferResponse>.Ok(transfer));
    }

    /// <summary>
    /// 3. POST /api/transfers - Create a new draft transfer request
    /// </summary>
    [HttpPost]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateTransfer([FromBody] CreateTransferRequest request, CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        var result = await _transferService.CreateTransferAsync(request, userId, ct);

        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "VALIDATION_FAILED", result.Errors));
        }

        return CreatedAtAction(nameof(GetTransferById), new { id = result.Data!.Id }, result);
    }

    /// <summary>
    /// 4. POST /api/transfers/{id}/request - Formally submit transfer request for approval
    /// </summary>
    [HttpPost("{id:guid}/request")]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitRequest(
        [FromRoute] Guid id,
        [FromBody] SubmitTransferNotesDto? body = null,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        var result = await _transferService.SubmitTransferRequestAsync(id, userId, body?.Notes, ct);

        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "TRANSITION_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// 5. POST /api/transfers/{id}/reserve - Reserve source facility stock for approved transfer
    /// </summary>
    [HttpPost("{id:guid}/reserve")]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReserveTransfer(
        [FromRoute] Guid id,
        [FromBody] ReserveTransferRequest request,
        CancellationToken ct = default)
    {
        // TODO: enforce roles after auth merge (approve: manager)
        if (request.UserId == Guid.Empty)
        {
            request.UserId = GetCurrentUserId();
        }

        var result = await _transferService.ReserveTransferAsync(id, request, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "RESERVATION_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// 5b. POST /api/transfers/{id}/dispatch - Dispatch transfer to transition from Reserved to Dispatched/InTransit
    /// </summary>
    [HttpPost("{id:guid}/dispatch")]
    [HttpPost("{id:guid}/pickup")] // "Confirm Pickup" endpoint -> InTransit
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DispatchTransfer(
        [FromRoute] Guid id,
        [FromBody] DispatchTransferRequest? request,
        CancellationToken ct = default)
    {
        // TODO: enforce roles after auth merge (pickup: source field officer)
        request ??= new DispatchTransferRequest();
        if (request.UserId == Guid.Empty)
        {
            request.UserId = GetCurrentUserId();
        }

        var result = await _transferService.DispatchTransferAsync(id, request, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "DISPATCH_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// 5c. POST /api/transfers/{id}/propose - Set candidate source facility for transfer
    /// </summary>
    [HttpPost("{id:guid}/propose")]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProposeCandidate(
        [FromRoute] Guid id,
        [FromBody] ProposeCandidateRequest request,
        CancellationToken ct = default)
    {
        var userId = (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
            ? request.UserId.Value
            : GetCurrentUserId();

        var result = await _transferService.ProposeCandidateInternalAsync(id, request.SourceFacilityId, userId, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "PROPOSAL_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// 6. POST /api/transfers/{id}/receive - Receive transfer and adjust inventory at destination (Confirm Delivery -> Delivered)
    /// </summary>
    [HttpPost("{id:guid}/receive")]
    [HttpPost("{id:guid}/deliver")] // "Confirm Delivery" endpoint -> Delivered
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReceiveTransfer(
        [FromRoute] Guid id,
        [FromBody] ReceiveTransferRequest request,
        CancellationToken ct = default)
    {
        // TODO: enforce roles after auth merge (delivery: field officer)
        if (request.ReceivedByUserId == Guid.Empty)
        {
            request.ReceivedByUserId = GetCurrentUserId();
        }

        var result = await _transferService.ReceiveTransferAsync(id, request, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "RECEIVING_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// 7. GET /api/transfers/{id}/candidates - Find and rank candidate supplying facilities
    /// </summary>
    [HttpGet("{id:guid}/candidates")]
    [ProducesResponseType(typeof(ApiResponse<List<CandidateFacilityResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetCandidates([FromRoute] Guid id, CancellationToken ct = default)
    {
        var result = await _transferService.GetCandidatesForTransferAsync(id, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "CANDIDATE_SEARCH_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// 8. GET /api/transfers/{id}/route - Calculate route and distance from source to destination
    /// </summary>
    [HttpGet("{id:guid}/route")]
    [ProducesResponseType(typeof(ApiResponse<RouteResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetRoute([FromRoute] Guid id, CancellationToken ct = default)
    {
        var result = await _transferService.GetRouteForTransferAsync(id, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "ROUTING_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// POST /api/transfers/{id}/location - Post live GPS coordinates during InTransit status
    /// </summary>
    [HttpPost("{id:guid}/location")]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLocation(
        [FromRoute] Guid id,
        [FromBody] UpdateTransferLocationRequest request,
        CancellationToken ct = default)
    {
        // TODO: enforce roles after auth merge (field officer)
        if (!ModelState.IsValid)
        {
            return BadRequest(new ErrorResponse("Validation failed", "VALIDATION_FAILED",
                ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList()));
        }

        var result = await _transferService.UpdateTransferLocationAsync(id, request, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "LOCATION_UPDATE_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// POST /api/transfers/{id}/accept - Officer accepts assigned transfer task
    /// </summary>
    [HttpPost("{id:guid}/accept")]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AcceptTransfer([FromRoute] Guid id, CancellationToken ct = default)
    {
        var officerId = GetCurrentUserId();
        var result = await _transferService.AcceptTransferAsync(id, officerId, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "ACCEPT_FAILED", result.Errors));
        }
        return Ok(result);
    }

    /// <summary>
    /// POST /api/transfers/{id}/decline - Officer declines assigned transfer task
    /// </summary>
    [HttpPost("{id:guid}/decline")]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeclineTransfer([FromRoute] Guid id, [FromBody] SubmitTransferNotesDto? body = null, CancellationToken ct = default)
    {
        var officerId = GetCurrentUserId();
        var result = await _transferService.DeclineTransferAsync(id, officerId, body?.Notes, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "DECLINE_FAILED", result.Errors));
        }
        return Ok(result);
    }

    /// <summary>
    /// GET /api/transfers/assigned-to-me - List tasks assigned to current field officer
    /// </summary>
    [HttpGet("assigned-to-me")]
    [ProducesResponseType(typeof(PagedResponse<TransferResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAssignedTransfers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var officerId = GetCurrentUserId();
        var result = await _transferService.GetAssignedTransfersAsync(officerId, page, pageSize, ct);
        return Ok(result);
    }

    private Guid GetCurrentUserId()
    {
        // Extract from claims if present; fallback to standard test user ID
        var subClaim = User?.FindFirst("sub")?.Value ?? User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(subClaim) && Guid.TryParse(subClaim, out var parsedGuid))
        {
            return parsedGuid;
        }

        return Constants.SystemUsers.DefaultTestUserId;
    }
}

public class SubmitTransferNotesDto
{
    public string? Notes { get; set; }
}
