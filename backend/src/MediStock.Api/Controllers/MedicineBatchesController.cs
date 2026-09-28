using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Services;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/medicine-batches")]
public sealed class MedicineBatchesController(BatchService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<BatchResponse>>>> GetActive([FromQuery] Guid? facilityId, CancellationToken cancellationToken) => Ok(new ApiResponse<IReadOnlyList<BatchResponse>>(await service.GetActiveAsync(facilityId, cancellationToken)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<BatchResponse>>> Create(CreateMedicineBatchRequest request, CancellationToken cancellationToken) => Created(string.Empty, new ApiResponse<BatchResponse>(await service.CreateAsync(request, cancellationToken)));

    [HttpGet("lookup")]
    public async Task<ActionResult<ApiResponse<BatchResponse>>> Lookup([FromQuery] string batchNumber, CancellationToken cancellationToken) => (await service.LookupAsync(batchNumber, cancellationToken)) is { } result ? Ok(new ApiResponse<BatchResponse>(result)) : NotFound(new { code = "BATCH_NOT_FOUND", message = "Batch was not found." });

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<BatchResponse>>> Get(Guid id, CancellationToken cancellationToken) => (await service.GetAsync(id, cancellationToken)) is { } result ? Ok(new ApiResponse<BatchResponse>(result)) : NotFound(new { code = "BATCH_NOT_FOUND", message = "Batch was not found." });

    [HttpPost("{id:guid}/retire")]
    public async Task<ActionResult<ApiResponse<BatchResponse>>> Retire(Guid id, RetireBatchRequest request, CancellationToken cancellationToken) => Ok(new ApiResponse<BatchResponse>(await service.RetireAsync(id, request, cancellationToken)));
}
