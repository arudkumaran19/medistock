namespace MediStock.Api.Controllers;

using System.Text.Json;
using MediStock.Api.Common;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Controlled tools for the redistribution agent. Redistribution vertical (Member 3).
///
/// The agent never touches PostgreSQL (blueprint section 38): every figure it reasons
/// about comes from here. The redistribution design's tools queried the database
/// directly; they are served through this endpoint instead, under the same names:
///
///   getTransferRequest, getCandidateFacilities, getFacilityLocation,
///   getFacilityInventory, calculateDistance
///
/// calculateTransferQuantity is pure arithmetic over the candidates and runs in the
/// agent. Read-only: nothing here changes a transfer or any stock.
///
/// Callable only with the shared X-Internal-Token, never with a user's JWT.
/// </summary>
[ApiController]
[Route("internal/tools/redistribution")]
[AllowAnonymous]
[Produces("application/json")]
public class RedistributionToolsController : ControllerBase
{
    private readonly ITransferService _transfers;
    private readonly IRoutingService _routing;
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _configuration;

    public RedistributionToolsController(
        ITransferService transfers,
        IRoutingService routing,
        ApplicationDbContext db,
        IConfiguration configuration)
    {
        _transfers = transfers;
        _routing = routing;
        _db = db;
        _configuration = configuration;
    }

    public sealed class ToolCall
    {
        public string Operation { get; set; } = string.Empty;

        public Dictionary<string, JsonElement> Arguments { get; set; } = new();
    }

    [HttpPost]
    public async Task<IActionResult> Invoke([FromBody] ToolCall call, CancellationToken ct)
    {
        if (!TokenIsValid())
        {
            return StatusCode(StatusCodes.Status401Unauthorized, Error("INTERNAL_TOOL_UNAUTHORIZED", "A valid internal service token is required."));
        }

        try
        {
            switch (call.Operation)
            {
                case "getTransferRequest":
                {
                    var transfer = await _transfers.GetTransferByIdAsync(ReadGuid(call, "transferId"), ct);
                    if (transfer == null)
                    {
                        return NotFound(Error("TRANSFER_NOT_FOUND", "Transfer request not found."));
                    }
                    return Ok(new ApiResponse<object>(transfer));
                }

                case "getCandidateFacilities":
                {
                    var candidates = await _transfers.GetCandidatesForTransferAsync(ReadGuid(call, "transferId"), ct);
                    return Ok(candidates);
                }

                case "getFacilityLocation":
                {
                    var facilityId = ReadGuid(call, "facilityId");
                    var facility = await _db.Facilities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == facilityId, ct);
                    if (facility == null)
                    {
                        return NotFound(Error("FACILITY_NOT_FOUND", "Facility not found."));
                    }
                    return Ok(new ApiResponse<object>(new
                    {
                        facilityId,
                        name = facility.Name,
                        latitude = facility.Latitude,
                        longitude = facility.Longitude,
                        town = facility.City ?? facility.Address ?? string.Empty,
                        provider = "internal-directory"
                    }));
                }

                case "getFacilityInventory":
                {
                    var facilityId = ReadGuid(call, "facilityId");
                    var medicineId = ReadGuid(call, "medicineId");
                    var balance = await _db.InventoryBalances.AsNoTracking().Include(x => x.Medicine)
                        .FirstOrDefaultAsync(x => x.FacilityId == facilityId && x.MedicineId == medicineId, ct);
                    return Ok(new ApiResponse<object>(new
                    {
                        facilityId,
                        medicineId,
                        quantityOnHand = balance?.QuantityOnHand ?? 0,
                        quantityReserved = balance?.QuantityReserved ?? 0,
                        minimumStock = balance?.Medicine?.MinimumStockLevel ?? 0,
                    }));
                }

                case "calculateDistance":
                {
                    var srcId = ReadGuid(call, "sourceFacilityId");
                    var dstId = ReadGuid(call, "destinationFacilityId");
                    var src = await _db.Facilities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == srcId, ct);
                    var dst = await _db.Facilities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dstId, ct);
                    if (src == null || dst == null)
                    {
                        return NotFound(Error("FACILITY_NOT_FOUND", "One or both facilities not found."));
                    }
                    var route = await _routing.CalculateRouteAsync(src, dst, ct);
                    return Ok(new ApiResponse<object>(new
                    {
                        distanceKm = route.DistanceKm,
                        durationMinutes = route.DurationMinutes,
                        provider = route.Provider
                    }));
                }

                default:
                    return BadRequest(Error("INTERNAL_TOOL_UNKNOWN_OPERATION", $"Unknown tool operation '{call.Operation}'."));
            }
        }
        catch (ArgumentException ex)
        {
            return BadRequest(Error("INTERNAL_TOOL_BAD_ARGUMENT", ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, Error("INTERNAL_TOOL_ERROR", ex.Message));
        }
    }

    private static Guid ReadGuid(ToolCall call, string name)
    {
        if (call.Arguments.TryGetValue(name, out var value) && value.ValueKind == JsonValueKind.String
            && Guid.TryParse(value.GetString(), out var id))
        {
            return id;
        }

        throw new ArgumentException($"{name} must be a GUID.");
    }

    /// <summary>Same rule as the Demand internal tools: fixed-time compare, closed when unconfigured.</summary>
    private bool TokenIsValid()
    {
        var expected = _configuration["AgentService:ServiceToken"];

        if (string.IsNullOrWhiteSpace(expected) || !Request.Headers.TryGetValue(InternalToolsController.ServiceTokenHeader, out var provided))
        {
            return false;
        }

        var supplied = provided.ToString();

        return !string.IsNullOrEmpty(supplied)
               && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                   System.Text.Encoding.UTF8.GetBytes(supplied),
                   System.Text.Encoding.UTF8.GetBytes(expected));
    }

    private ErrorResponse Error(string code, string message) => new()
    {
        Error = new ErrorDetail { Code = code, Message = message, TraceId = HttpContext.TraceIdentifier },
    };
}
