namespace MediStock.Api.Controllers;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Demand.Validators;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Consumption and forecast endpoints of the frozen Demand API contract.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
///
///   GET  /api/consumption
///   POST /api/consumption
///   GET  /api/demand/forecasts
///   POST /api/demand/forecast
///
/// POST /api/demand/forecast is a non-CRUD business operation: it reads the historical
/// consumption window and computes a deterministic forecast.
///
/// Role note: the blueprint fixes the four role names (section 8) and the operational
/// versus management split (section 77) but does not enumerate the roles per Demand
/// endpoint. The mapping below follows that split - consumption is recorded in the
/// field, analysis is management - and must be confirmed with the authentication owner,
/// Vaisnavi L. (IT24102469).
/// </summary>
[ApiController]
[Route("api")]
[Authorize]
[Produces("application/json")]
public class DemandController : ControllerBase
{
    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly DemandValidator _validator;

    public DemandController(
        ConsumptionService consumptionService,
        ForecastService forecastService,
        DemandValidator validator)
    {
        _consumptionService = consumptionService;
        _forecastService = forecastService;
        _validator = validator;
    }

    // -----------------------------------------------------------------------
    // Consumption
    // -----------------------------------------------------------------------

    /// <summary>
    /// Paged consumption history, filterable by facility, medicine and date range.
    /// </summary>
    [HttpGet("consumption")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<ConsumptionResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConsumption(
        [FromQuery] ConsumptionQuery query,
        CancellationToken cancellationToken)
    {
        var result = await _consumptionService.GetConsumptionAsync(query, cancellationToken);

        return Ok(ApiResponse<PagedResponse<ConsumptionResponse>>.Ok(result));
    }

    /// <summary>
    /// Records a consumption observation. Entry point for the Flutter operational app.
    /// </summary>
    [HttpPost("consumption")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ConsumptionResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateConsumption(
        [FromBody] ConsumptionRequest request,
        CancellationToken cancellationToken)
    {
        var validation = _validator.ValidateConsumptionRequest(request);

        if (!validation.IsValid)
        {
            return BadRequest(ErrorResponse.Create(
                validation.Code!,
                validation.Message!,
                HttpContext.TraceIdentifier));
        }

        var record = await _consumptionService.CreateConsumptionAsync(request, cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            ApiResponse<ConsumptionResponse>.Ok(record));
    }

    /// <summary>
    /// A single consumption record.
    ///
    /// The endpoints below are not in the frozen API contract (blueprint section 36),
    /// which lists only GET and POST for consumption. Added so a mis-keyed entry can be
    /// corrected rather than silently skewing every later forecast.
    /// Do not assume or introduce a new decision without team-level confirmation.
    /// </summary>
    [HttpGet("consumption/{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ConsumptionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetConsumptionById(Guid id, CancellationToken cancellationToken)
    {
        var record = await _consumptionService.GetConsumptionByIdAsync(id, cancellationToken);

        if (record is null)
        {
            return NotFound(ErrorResponse.Create(
                DemandValidator.NotFoundCode,
                $"Consumption record {id} was not found.",
                HttpContext.TraceIdentifier));
        }

        return Ok(ApiResponse<ConsumptionResponse>.Ok(record));
    }

    /// <summary>
    /// Corrects a consumption record.
    /// </summary>
    [HttpPut("consumption/{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ConsumptionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateConsumption(
        Guid id,
        [FromBody] ConsumptionRequest request,
        CancellationToken cancellationToken)
    {
        // A correction is held to exactly the same rules as the original entry.
        var validation = _validator.ValidateConsumptionRequest(request);

        if (!validation.IsValid)
        {
            return BadRequest(ErrorResponse.Create(
                validation.Code!,
                validation.Message!,
                HttpContext.TraceIdentifier));
        }

        var record = await _consumptionService.UpdateConsumptionAsync(id, request, cancellationToken);

        if (record is null)
        {
            return NotFound(ErrorResponse.Create(
                DemandValidator.NotFoundCode,
                $"Consumption record {id} was not found.",
                HttpContext.TraceIdentifier));
        }

        return Ok(ApiResponse<ConsumptionResponse>.Ok(record));
    }

    /// <summary>
    /// Removes a consumption record entered in error.
    /// </summary>
    [HttpDelete("consumption/{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteConsumption(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await _consumptionService.DeleteConsumptionAsync(id, cancellationToken);

        if (!deleted)
        {
            return NotFound(ErrorResponse.Create(
                DemandValidator.NotFoundCode,
                $"Consumption record {id} was not found.",
                HttpContext.TraceIdentifier));
        }

        return NoContent();
    }

    // -----------------------------------------------------------------------
    // Forecast
    // -----------------------------------------------------------------------

    /// <summary>
    /// Paged forecast history, filterable by facility, medicine, status and method.
    /// </summary>
    [HttpGet("demand/forecasts")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<ForecastResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetForecasts(
        [FromQuery] ForecastQuery query,
        CancellationToken cancellationToken)
    {
        var result = await _forecastService.GetForecastsAsync(query, cancellationToken);

        return Ok(ApiResponse<PagedResponse<ForecastResponse>>.Ok(result));
    }

    /// <summary>
    /// Generates and stores a demand forecast from stored consumption history.
    /// </summary>
    [HttpPost("demand/forecast")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ForecastResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateForecast(
        [FromBody] ForecastRequest request,
        CancellationToken cancellationToken)
    {
        var validation = _validator.ValidateForecastRequest(request);

        if (!validation.IsValid)
        {
            return BadRequest(ErrorResponse.Create(
                validation.Code!,
                validation.Message!,
                HttpContext.TraceIdentifier));
        }

        var forecast = await _forecastService.CreateForecastAsync(request, cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            ApiResponse<ForecastResponse>.Ok(forecast));
    }

    /// <summary>
    /// A single forecast.
    /// </summary>
    [HttpGet("demand/forecasts/{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.StoreOfficer},{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<ForecastResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetForecastById(Guid id, CancellationToken cancellationToken)
    {
        var forecast = await _forecastService.GetForecastByIdAsync(id, cancellationToken);

        if (forecast is null)
        {
            return NotFound(ErrorResponse.Create(
                DemandValidator.NotFoundCode,
                $"Forecast {id} was not found.",
                HttpContext.TraceIdentifier));
        }

        return Ok(ApiResponse<ForecastResponse>.Ok(forecast));
    }

    /// <summary>
    /// Removes a stored forecast.
    ///
    /// There is deliberately no update for forecasts: a forecast records what the
    /// calculation produced from a given window, so editing one would make it a claim
    /// nobody can reproduce. Generate a new forecast instead.
    /// </summary>
    [HttpDelete("demand/forecasts/{id:guid}")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteForecast(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await _forecastService.DeleteForecastAsync(id, cancellationToken);

        if (!deleted)
        {
            return NotFound(ErrorResponse.Create(
                DemandValidator.NotFoundCode,
                $"Forecast {id} was not found.",
                HttpContext.TraceIdentifier));
        }

        return NoContent();
    }
}
