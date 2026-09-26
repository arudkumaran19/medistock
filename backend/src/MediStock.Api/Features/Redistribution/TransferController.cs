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
    /// 6. POST /api/transfers/{id}/receive - Receive transfer and adjust inventory at destination
    /// </summary>
    [HttpPost("{id:guid}/receive")]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReceiveTransfer(
        [FromRoute] Guid id,
        [FromBody] ReceiveTransferRequest request,
        CancellationToken ct = default)
    {
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
