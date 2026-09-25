using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
[Authorize]
public sealed class DeliveryController : ControllerBase
{
    private readonly DeliveryService _deliveryService;

    public DeliveryController(DeliveryService deliveryService)
    {
        _deliveryService = deliveryService;
    }

    [HttpPost("purchase-orders/{purchaseOrderId:guid}")]
    public async Task<ActionResult<DeliveryResponse>> Create(
        Guid purchaseOrderId,
        [FromBody] DeliveryRequest request,
        CancellationToken cancellationToken)
    {
        var delivery = await _deliveryService.CreateAsync(
            purchaseOrderId,
            request,
            cancellationToken);

        return Ok(delivery);
    }

    [HttpGet("purchase-orders/{purchaseOrderId:guid}")]
    public async Task<ActionResult<DeliveryResponse>> GetByPurchaseOrder(
        Guid purchaseOrderId,
        CancellationToken cancellationToken)
    {
        var delivery = await _deliveryService.GetByPurchaseOrderAsync(
            purchaseOrderId,
            cancellationToken);

        if (delivery is null)
        {
            return NotFound();
        }

        return Ok(delivery);
    }

    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<DeliveryResponse>> UpdateStatus(
        Guid id,
        [FromBody] DeliveryStatus status,
        CancellationToken cancellationToken)
    {
        var delivery = await _deliveryService.UpdateStatusAsync(
            id,
            status,
            null,
            cancellationToken);

        return Ok(delivery);
    }

    [HttpPost("{id:guid}/deliver")]
    public async Task<ActionResult<DeliveryResponse>> Deliver(
        Guid id,
        [FromBody] DeliveryRequest request,
        CancellationToken cancellationToken)
    {
        var delivery = await _deliveryService.UpdateStatusAsync(
            id,
            DeliveryStatus.Delivered,
            request,
            cancellationToken);

        return Ok(delivery);
    }
}
