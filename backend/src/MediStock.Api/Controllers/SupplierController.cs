using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
[Authorize]
public sealed class SupplierController : ControllerBase
{
    private readonly SupplierService _supplierService;

    public SupplierController(SupplierService supplierService)
    {
        _supplierService = supplierService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierResponse>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        CancellationToken cancellationToken)
    {
        var suppliers = await _supplierService.GetAllAsync(
            search,
            isActive,
            cancellationToken);

        return Ok(suppliers);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SupplierResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var supplier = await _supplierService.GetByIdAsync(
            id,
            cancellationToken);

        if (supplier is null)
        {
            return NotFound();
        }

        return Ok(supplier);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierResponse>> Create(
        [FromBody] SupplierRequest request,
        CancellationToken cancellationToken)
    {
        var supplier = await _supplierService.CreateAsync(
            request,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = supplier.Id },
            supplier);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SupplierResponse>> Update(
        Guid id,
        [FromBody] SupplierRequest request,
        CancellationToken cancellationToken)
    {
        var supplier = await _supplierService.UpdateAsync(
            id,
            request,
            cancellationToken);

        if (supplier is null)
        {
            return NotFound();
        }

        return Ok(supplier);
    }
}