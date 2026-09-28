namespace MediStock.Api.Controllers;

using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Infrastructure.AI;
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
    private readonly AgentServiceClient _agentService;

    public DemandController(
        ConsumptionService consumptionService,
        ForecastService forecastService,
        DemandValidator validator,
        AgentServiceClient agentService)
    {
        _consumptionService = consumptionService;
        _forecastService = forecastService;
        _validator = validator;
        _agentService = agentService;
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

        return Ok(new ApiResponse<PagedResponse<ConsumptionResponse>>(result));
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
            return BadRequest(new ErrorResponse
                              {
                                  Error = new ErrorDetail
                                  {
                                      Code = validation.Code!,
                                      Message = validation.Message!,
                                      TraceId = HttpContext.TraceIdentifier,
                                  },
                              });
        }

        var record = await _consumptionService.CreateConsumptionAsync(request, cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiResponse<ConsumptionResponse>(record));
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
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Consumption record {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return Ok(new ApiResponse<ConsumptionResponse>(record));
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
            return BadRequest(new ErrorResponse
                              {
                                  Error = new ErrorDetail
                                  {
                                      Code = validation.Code!,
                                      Message = validation.Message!,
                                      TraceId = HttpContext.TraceIdentifier,
                                  },
                              });
        }

        var record = await _consumptionService.UpdateConsumptionAsync(id, request, cancellationToken);

        if (record is null)
        {
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Consumption record {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return Ok(new ApiResponse<ConsumptionResponse>(record));
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
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Consumption record {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
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

        return Ok(new ApiResponse<PagedResponse<ForecastResponse>>(result));
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
            return BadRequest(new ErrorResponse
                              {
                                  Error = new ErrorDetail
                                  {
                                      Code = validation.Code!,
                                      Message = validation.Message!,
                                      TraceId = HttpContext.TraceIdentifier,
                                  },
                              });
        }

        var forecast = await _forecastService.CreateForecastAsync(request, cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            new ApiResponse<ForecastResponse>(forecast));
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
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Forecast {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return Ok(new ApiResponse<ForecastResponse>(forecast));
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
            return NotFound(new ErrorResponse
                            {
                                Error = new ErrorDetail
                                {
                                    Code = DemandValidator.NotFoundCode,
                                    Message = $"Forecast {id} was not found.",
                                    TraceId = HttpContext.TraceIdentifier,
                                },
                            });
        }

        return NoContent();
    }

    // -----------------------------------------------------------------------
    // Agentic AI
    // -----------------------------------------------------------------------

    /// <summary>
    /// Runs a demand objective through the Demand &amp; Shortage Agent and returns its
    /// structured result.
    ///
    /// Not in the frozen API contract (blueprint section 36), which lists no agent
    /// endpoint under Demand. Section 37 states that ASP.NET Core - never a client -
    /// calls the agent service, so this endpoint is the boundary that keeps React and
    /// Flutter away from it. Do not assume or introduce a new decision without
    /// team-level confirmation.
    ///
    /// The agent is advisory. It validates nothing authoritatively and approves
    /// nothing: every figure it reports comes from the deterministic internal tools,
    /// and its result always carries requiredValidation = true.
    ///
    /// When the agent service is unreachable this returns 503 with a safe-failure
    /// body rather than an exception (blueprint section 41).
    /// </summary>
    [HttpPost("demand/agent/analyze")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<AgentRunResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> RunDemandAgent(
        [FromBody] DemandAgentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _agentService.RunAsync(
            new AgentRunRequest(
                request.FacilityId.ToString(),
                request.MedicineId.ToString(),
                request.Objective,
                request.CurrentStock,
                request.WindowDays ?? 30),
            cancellationToken);

        if (result is null)
        {
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new ErrorResponse
                {
                    Error = new ErrorDetail
                    {
                        Code = "AGENT_UNAVAILABLE",
                        Message = "The agent service is not running or refused the request. "
                        + "No analysis was produced and nothing was changed.",
                        TraceId = HttpContext.TraceIdentifier,
                    },
                });
        }

        return Ok(new ApiResponse<AgentRunResult>(result));
    }

    /// <summary>Whether the internal agent service is reachable.</summary>
    [HttpGet("demand/agent/health")]
    [Authorize(Roles = $"{Constants.Roles.FacilityManager},{Constants.Roles.Admin}")]
    [ProducesResponseType(typeof(ApiResponse<AgentHealthResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAgentHealth(CancellationToken cancellationToken)
    {
        var healthy = await _agentService.IsHealthyAsync(cancellationToken);

        return Ok(new ApiResponse<AgentHealthResponse>(new AgentHealthResponse(healthy)));
    }
}

/// <summary>Request body for POST /api/demand/agent/analyze.</summary>
public sealed record DemandAgentRequest
{
    public Guid FacilityId { get; init; }

    public Guid MedicineId { get; init; }

    /// <summary>
    /// Plain-language objective. Screened by the agent's input guard before any tool
    /// runs, so an injected instruction is refused rather than obeyed.
    /// </summary>
    public string? Objective { get; init; }

    /// <summary>
    /// Stock on hand. Owned by the Inventory vertical, so the caller supplies it.
    /// Without it the agent reports what it still needs instead of guessing.
    /// </summary>
    public decimal? CurrentStock { get; init; }

    public int? WindowDays { get; init; }
}

/// <summary>Agent service liveness.</summary>
public sealed record AgentHealthResponse(bool Healthy);
