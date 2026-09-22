using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Services;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/inventory")]
public sealed class InventoryController(InventoryService service) : ControllerBase
{
	[HttpGet]
	public async Task<ActionResult<ApiResponse<IReadOnlyList<InventoryResponse>>>> GetAll([FromQuery] Guid? facilityId, CancellationToken cancellationToken) => Ok(new ApiResponse<IReadOnlyList<InventoryResponse>>(await service.GetAllAsync(facilityId, cancellationToken)));

	[HttpGet("{id:guid}")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Get(Guid id, CancellationToken cancellationToken) => (await service.GetAsync(id, cancellationToken)) is { } result ? Ok(new ApiResponse<InventoryResponse>(result)) : NotFound(new { code = "INVENTORY_NOT_FOUND", message = "Inventory balance was not found." });

	[HttpPost("receive")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Receive(ReceiveStockRequest request, CancellationToken cancellationToken) => Created(string.Empty, new ApiResponse<InventoryResponse>(await service.ReceiveAsync(request, cancellationToken)));

	[HttpPost("adjust")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Adjust(AdjustStockRequest request, CancellationToken cancellationToken) => Ok(new ApiResponse<InventoryResponse>(await service.AdjustAsync(request, cancellationToken)));

	[HttpPost("reserve")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Reserve(ReserveStockRequest request, CancellationToken cancellationToken) => Ok(new ApiResponse<InventoryResponse>(await service.ReserveAsync(request, cancellationToken)));

	[HttpGet("expiring")]
	public async Task<ActionResult<ApiResponse<IReadOnlyList<BatchResponse>>>> Expiring([FromQuery] int days = 90, CancellationToken cancellationToken = default) => Ok(new ApiResponse<IReadOnlyList<BatchResponse>>(await service.GetExpiringAsync(days, cancellationToken)));
}
