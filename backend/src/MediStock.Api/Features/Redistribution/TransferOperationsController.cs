using System;
using System.Net.Mime;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MediStock.Api.Common;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Services;

namespace MediStock.Api.Features.Redistribution;

[ApiController]
[Route("api/transfers")]
[Produces(MediaTypeNames.Application.Json)]
public class TransferOperationsController : ControllerBase
{
    private readonly ITransferService _transferService;

    public TransferOperationsController(ITransferService transferService)
    {
        _transferService = transferService;
    }

    [HttpPost("{id:guid}/approve")]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ApproveTransfer(
        [FromRoute] Guid id,
        [FromBody] SubmitTransferNotesDto? body = null,
        CancellationToken ct = default)
    {
        var approverId = GetCurrentUserId();
        var result = await _transferService.ApproveTransferInternalAsync(id, approverId, body?.Notes, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "APPROVAL_FAILED", result.Errors));
        }

        return Ok(result);
    }

    [HttpPatch("{id:guid}/status")]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<TransferResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateTransferStatus(
        [FromRoute] Guid id,
        [FromBody] UpdateTransferStatusDto request,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        var statusStr = request.Status?.Trim();

        if (string.Equals(statusStr, "InTransit", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(statusStr, "Dispatched", StringComparison.OrdinalIgnoreCase))
        {
            var dispatchReq = new DispatchTransferRequest
            {
                UserId = userId,
                Notes = request.Proof != null ? System.Text.Json.JsonSerializer.Serialize(request.Proof) : null
            };
            var result = await _transferService.DispatchTransferAsync(id, dispatchReq, ct);
            if (!result.Success)
            {
                return BadRequest(new ErrorResponse(result.Message, "STATUS_UPDATE_FAILED", result.Errors));
            }
            return Ok(result);
        }

        if (string.Equals(statusStr, "Delivered", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(statusStr, "Received", StringComparison.OrdinalIgnoreCase))
        {
            var receiveReq = new ReceiveTransferRequest
            {
                ReceivedByUserId = userId,
                Notes = request.Proof != null ? System.Text.Json.JsonSerializer.Serialize(request.Proof) : null
            };
            var result = await _transferService.ReceiveTransferAsync(id, receiveReq, ct);
            if (!result.Success)
            {
                return BadRequest(new ErrorResponse(result.Message, "STATUS_UPDATE_FAILED", result.Errors));
            }
            return Ok(result);
        }

        return BadRequest(new ErrorResponse($"Unsupported status transition to '{statusStr}'", "INVALID_STATUS"));
    }

    private Guid GetCurrentUserId()
    {
        var subClaim = User?.FindFirst("sub")?.Value ?? User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(subClaim) && Guid.TryParse(subClaim, out var parsedGuid))
        {
            return parsedGuid;
        }

        return Constants.SystemUsers.DefaultTestUserId;
    }
}
