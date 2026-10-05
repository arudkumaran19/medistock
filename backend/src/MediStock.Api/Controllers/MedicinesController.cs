using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/medicines")]
public sealed class MedicinesController(ApplicationDbContext db, MedicineService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ApiResponse<MedicineResponse>>> Create(CreateMedicineRequest request, CancellationToken cancellationToken) => Created(string.Empty, new ApiResponse<MedicineResponse>(await service.CreateAsync(request, cancellationToken)));

    [HttpGet]
	public async Task<ActionResult<ApiResponse<IReadOnlyList<MedicineResponse>>>> GetAll([FromQuery] bool includeArchived, CancellationToken cancellationToken) => Ok(new ApiResponse<IReadOnlyList<MedicineResponse>>(await db.Medicines.AsNoTracking().Where(x => includeArchived || x.IsActive).OrderBy(x => x.Name).Select(x => new MedicineResponse(x.Id, x.Code, x.Name, x.Unit, x.MinimumStockLevel, x.IsActive)).ToListAsync(cancellationToken)));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<MedicineResponse>>> Get(Guid id, CancellationToken cancellationToken) => (await db.Medicines.AsNoTracking().Where(x => x.Id == id).Select(x => new MedicineResponse(x.Id, x.Code, x.Name, x.Unit, x.MinimumStockLevel, x.IsActive)).FirstOrDefaultAsync(cancellationToken)) is { } result ? Ok(new ApiResponse<MedicineResponse>(result)) : NotFound(new { code = "MEDICINE_NOT_FOUND", message = "Medicine was not found." });

    [HttpPost("{id:guid}/archive")]
    public async Task<ActionResult<ApiResponse<MedicineResponse>>> Archive(Guid id, ArchiveMedicineRequest request, CancellationToken cancellationToken) => Ok(new ApiResponse<MedicineResponse>(await service.ArchiveAsync(id, request, cancellationToken)));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<MedicineResponse>>> Update(Guid id, UpdateMedicineRequest request, CancellationToken cancellationToken) => Ok(new ApiResponse<MedicineResponse>(await service.UpdateAsync(id, request, cancellationToken)));
}
