using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/purchase-orders")]
[Authorize]
public sealed class PurchaseOrderController : ControllerBase
{
    private readonly ProcurementService _procurementService;

    public PurchaseOrderController(ProcurementService procurementService)
    {
        _procurementService = procurementService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PurchaseOrderResponse>>> GetAll(
        CancellationToken cancellationToken)
    {
        var purchaseOrders = await _procurementService.GetAllAsync(
            cancellationToken);

        return Ok(purchaseOrders);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PurchaseOrderResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await _procurementService.GetByIdAsync(
            id,
            cancellationToken);

        if (purchaseOrder is null)
        {
            return NotFound();
        }

        return Ok(purchaseOrder);
    }

    [HttpPost]
    public async Task<ActionResult<PurchaseOrderResponse>> Create(
        [FromBody] PurchaseOrderRequest request,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await _procurementService.CreateAsync(
            request,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = purchaseOrder.Id },
            purchaseOrder);
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<ActionResult<PurchaseOrderResponse>> Submit(
        Guid id,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await _procurementService.SubmitAsync(
            id,
            cancellationToken);

        return Ok(purchaseOrder);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<PurchaseOrderResponse>> Approve(
        Guid id,
        CancellationToken cancellationToken)
    {
        var purchaseOrder = await _procurementService.ApproveAsync(
            id,
            cancellationToken);

        return Ok(purchaseOrder);
    }

    [HttpPost("{id:guid}/reject")]
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

    [HttpPost("{id:guid}/request-revision")]
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