using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/approvals")]
[Authorize]
public sealed class ApprovalController : ControllerBase
{
    private readonly ProcurementService _procurementService;

    public ApprovalController(ProcurementService procurementService)
    {
        _procurementService = procurementService;
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<PurchaseOrderResponse>>> GetPendingApprovals(
        [FromQuery] Guid? facilityId,
        CancellationToken cancellationToken)
    {
        var pendingOrders = await _procurementService.GetAllAsync(
            facilityId,
            PurchaseOrderStatus.PendingApproval,
            null,
            cancellationToken);

        return Ok(pendingOrders);
    }

    [HttpPost("purchase-orders/{id:guid}/approve")]
    public async Task<ActionResult<PurchaseOrderResponse>> Approve(
        Guid id,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await _procurementService.ApproveAsync(
            id,
            cancellationToken);

        return Ok(purchaseOrder);
    }

    [HttpPost("purchase-orders/{id:guid}/reject")]
    public async Task<ActionResult<PurchaseOrderResponse>> Reject(
        Guid id,
        [FromBody] PurchaseOrderWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await _procurementService.RejectAsync(
            id,
            request,
            cancellationToken);

        return Ok(purchaseOrder);
    }

    [HttpPost("purchase-orders/{id:guid}/request-revision")]
    public async Task<ActionResult<PurchaseOrderResponse>> RequestRevision(
        Guid id,
        [FromBody] PurchaseOrderWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await _procurementService.RequestRevisionAsync(
            id,
            request,
            cancellationToken);

        return Ok(purchaseOrder);
    }
}
