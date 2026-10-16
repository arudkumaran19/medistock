using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Infrastructure.AI;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/inventory")]
public sealed class InventoryController(
    InventoryService service,
    StockTransactionService transactions,
    AgentServiceClient agentClient) : ControllerBase
{
	[HttpGet]
	[Authorize(Policy = "FacilityInventoryAccess")]
	public async Task<ActionResult<ApiResponse<IReadOnlyList<InventoryResponse>>>> GetAll([FromQuery] Guid? facilityId, [FromQuery] bool includeArchived, CancellationToken cancellationToken) => Ok(new ApiResponse<IReadOnlyList<InventoryResponse>>(await service.GetAllAsync(facilityId, cancellationToken, includeArchived)));

	[HttpGet("{id:guid}")]
	[Authorize(Policy = "FacilityInventoryAccess")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Get(Guid id, CancellationToken cancellationToken) => (await service.GetAsync(id, cancellationToken)) is { } result ? Ok(new ApiResponse<InventoryResponse>(result)) : NotFound(new { code = "INVENTORY_NOT_FOUND", message = "Inventory balance was not found." });

	[HttpPost("receive")]
	[Authorize(Policy = "AddMedicineAndExpiryAccess")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Receive(ReceiveStockRequest request, CancellationToken cancellationToken) => Created(string.Empty, new ApiResponse<InventoryResponse>(await service.ReceiveAsync(request, cancellationToken)));

	[HttpPost("adjust")]
	[Authorize(Policy = "AddMedicineAndExpiryAccess")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Adjust(AdjustStockRequest request, CancellationToken cancellationToken) => Ok(new ApiResponse<InventoryResponse>(await service.AdjustAsync(request, cancellationToken)));

	[HttpPost("reserve")]
	[Authorize(Policy = "AddMedicineAndExpiryAccess")]
	public async Task<ActionResult<ApiResponse<InventoryResponse>>> Reserve(ReserveStockRequest request, CancellationToken cancellationToken) => Ok(new ApiResponse<InventoryResponse>(await service.ReserveAsync(request, cancellationToken)));

	[HttpGet("expiring")]
	[Authorize(Policy = "FacilityInventoryAccess")]
	public async Task<ActionResult<ApiResponse<IReadOnlyList<BatchResponse>>>> Expiring([FromQuery] int days = 90, CancellationToken cancellationToken = default) => Ok(new ApiResponse<IReadOnlyList<BatchResponse>>(await service.GetExpiringAsync(days, cancellationToken)));

	[HttpGet("transactions")]
	[Authorize(Policy = "FacilityInventoryAccess")]
	public async Task<ActionResult<ApiResponse<IReadOnlyList<StockTransactionResponse>>>> Transactions([FromQuery] Guid medicineId, [FromQuery] Guid facilityId, CancellationToken cancellationToken) =>
		Ok(new ApiResponse<IReadOnlyList<StockTransactionResponse>>(await transactions.GetHistoryAsync(medicineId, facilityId, cancellationToken)));

	/// <summary>
	/// Proxies requests to the Inventory Intelligence Agent.
	/// RBAC is enforced here (FacilityInventoryAccess) before the request reaches the
	/// Python agent service. The user's JWT is forwarded so the agent's back-calls into
	/// /api/inventory/* also run under the same role constraints.
	/// The agent service is never reachable directly from the browser.
	/// </summary>
	[HttpPost("agent/run")]
	[Authorize(Policy = "FacilityInventoryAccess")]
	public async Task<ActionResult> RunInventoryAgent([FromBody] System.Text.Json.JsonElement requestBody, CancellationToken cancellationToken)
	{
		// Extract the raw bearer token from the incoming request so the agent can use
		// it when it calls back into the .NET API on the user's behalf.
		var authHeader = Request.Headers.Authorization.FirstOrDefault();
		var userToken = authHeader?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
			? authHeader[7..]
			: null;

		var result = await agentClient.RunInventoryAgentAsync(requestBody, userToken, cancellationToken);

		if (result is null)
		{
			return StatusCode(503, new
			{
				code = "AGENT_UNAVAILABLE",
				message = "The Inventory Intelligence Agent is currently unavailable. " +
				          "Please ensure the AI service is running and try again."
			});
		}

		return Ok(result);
	}
}
