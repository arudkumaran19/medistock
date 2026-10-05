using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/facilities")]
public sealed class FacilitiesController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FacilityResponse>>>> GetAll(CancellationToken cancellationToken) => Ok(new ApiResponse<IReadOnlyList<FacilityResponse>>(await db.Facilities.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new FacilityResponse(x.Id, x.Code, x.Name, x.Address, x.IsActive)).ToListAsync(cancellationToken)));
}