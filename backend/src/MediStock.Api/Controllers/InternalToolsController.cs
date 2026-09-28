namespace MediStock.Api.Controllers;

using System.Text.Json;
using MediStock.Api.Common;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Demand.Validators;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Controlled internal tool endpoints for the Agentic AI service.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
///
///   POST /internal/tools/consumption
///   POST /internal/tools/forecast
///
/// The agent service never reaches PostgreSQL directly. It posts a tool request here,
/// ASP.NET Core applies authorization and the authoritative business rules, and returns
/// a structured result (blueprint section 38):
///
///     AI -&gt; tool request -&gt; ASP.NET -&gt; authorization -&gt; business service
///        -&gt; database -&gt; structured result -&gt; AI
///
/// React and Flutter must never call these endpoints. They are guarded by a shared
/// service token rather than a user JWT, so a browser or mobile session cannot reach
/// them even with a valid login.
///
/// Security note: this token check is a PLACEHOLDER. The blueprint assigns
/// Security/InternalServiceAuthentication.cs to Vaisnavi L. (IT24102469). It is
/// implemented inline here so the Demand agent is runnable, and must be replaced by the
/// owner's handler on integration. Only the Demand-owned tools are served here; the
/// inventory, facilities, routing, validation and procurement tools belong to their own
/// vertical owners.
/// </summary>
[ApiController]
[Route("internal/tools")]
[AllowAnonymous]
[Produces("application/json")]
public class InternalToolsController : ControllerBase
{
    /// <summary>Header carrying the service token. Deliberately not Authorization,
    /// so a user JWT can never be mistaken for service credentials.</summary>
    public const string ServiceTokenHeader = "X-Internal-Token";

    public const string UnauthorizedCode = "INTERNAL_TOOL_UNAUTHORIZED";
    public const string UnknownOperationCode = "INTERNAL_TOOL_UNKNOWN_OPERATION";

    private readonly ConsumptionService _consumptionService;
    private readonly ForecastService _forecastService;
    private readonly DemandValidator _validator;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InternalToolsController> _logger;

    public InternalToolsController(
        ConsumptionService consumptionService,
        ForecastService forecastService,
        DemandValidator validator,
        IConfiguration configuration,
        ILogger<InternalToolsController> logger)
    {
        _consumptionService = consumptionService;
        _forecastService = forecastService;
        _validator = validator;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Serves getConsumptionHistory and calculateDailyConsumption.
    /// </summary>
    [HttpPost("consumption")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Consumption(
        [FromBody] ToolRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsServiceTokenValid())
        {
            return RejectUnauthorized();
        }

        var arguments = request.Arguments;

        switch (request.Operation)
        {
            case "history":
            {
                if (!TryReadTarget(arguments, out var facilityId, out var medicineId, out var failure))
                {
                    return failure!;
                }

                var windowDays = ReadWindowDays(arguments);

                if (!IsWindowValid(windowDays, out var windowFailure))
                {
                    return windowFailure!;
                }

                var history = await _consumptionService.GetHistoryAsync(
                    facilityId,
                    medicineId,
                    windowDays,
                    cancellationToken);

                return Ok(new ApiResponse<ConsumptionHistoryToolResult>(new ConsumptionHistoryToolResult(
                        facilityId,
                        medicineId,
                        windowDays,
                        history
                            .Select(x => new ConsumptionHistoryEntry(x.ConsumptionDate, x.QuantityUsed))
                            .ToList())));
            }

            case "dailyAverage":
            {
                if (!TryReadTarget(arguments, out var facilityId, out var medicineId, out var failure))
                {
                    return failure!;
                }

                var windowDays = ReadWindowDays(arguments);

                if (!IsWindowValid(windowDays, out var windowFailure))
                {
                    return windowFailure!;
                }

                var average = await _consumptionService.GetAverageDailyConsumptionAsync(
                    facilityId,
                    medicineId,
                    windowDays,
                    cancellationToken);

                return Ok(new ApiResponse<DailyConsumptionToolResult>(new DailyConsumptionToolResult(facilityId, medicineId, windowDays, average)));
            }

            default:
                return UnknownOperation(request.Operation);
        }
    }

    /// <summary>
    /// Serves calculateForecast, calculateProjectedStockout and getShortageThreshold.
    /// </summary>
    [HttpPost("forecast")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Forecast(
        [FromBody] ToolRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsServiceTokenValid())
        {
            return RejectUnauthorized();
        }

        var arguments = request.Arguments;

        if (!TryReadTarget(arguments, out var facilityId, out var medicineId, out var failure))
        {
            return failure!;
        }

        switch (request.Operation)
        {
            case "forecast":
            {
                var forecastRequest = new ForecastRequest
                {
                    FacilityId = facilityId,
                    MedicineId = medicineId,
                    WindowDays = ReadInt(arguments, "windowDays") ?? 30,
                    HorizonDays = ReadInt(arguments, "horizonDays") ?? 30,
                    Method = ReadString(arguments, "method") ?? ForecastMethods.MovingAverage,
                    LeadTimeDays = ReadInt(arguments, "leadTimeDays")
                };

                // The agent goes through exactly the same deterministic validation as a
                // human caller. It gets no privileged path.
                var validation = _validator.ValidateForecastRequest(forecastRequest);

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

                var forecast = await _forecastService.CreateForecastAsync(
                    forecastRequest,
                    cancellationToken);

                return Ok(new ApiResponse<ForecastToolResult>(new ForecastToolResult(
                        forecast.Id,
                        forecast.FacilityId,
                        forecast.MedicineId,
                        forecast.Method,
                        forecast.WindowDays,
                        forecast.HorizonDays,
                        forecast.AverageDailyConsumption,
                        forecast.PredictedDemand,
                        forecast.ConfidenceScore,
                        forecast.LeadTimeDays)));
            }

            case "projectedStockout":
            {
                var currentStock = ReadDecimal(arguments, "currentStock");

                if (currentStock is null)
                {
                    return BadRequest(new ErrorResponse
                                      {
                                          Error = new ErrorDetail
                                          {
                                              Code = DemandValidator.ValidationErrorCode,
                                              Message = "currentStock is required.",
                                              TraceId = HttpContext.TraceIdentifier,
                                          },
                                      });
                }

                if (currentStock < 0)
                {
                    return BadRequest(new ErrorResponse
                                      {
                                          Error = new ErrorDetail
                                          {
                                              Code = DemandValidator.ValidationErrorCode,
                                              Message = "currentStock cannot be negative.",
                                              TraceId = HttpContext.TraceIdentifier,
                                          },
                                      });
                }

                var windowDays = ReadWindowDays(arguments);

                if (!IsWindowValid(windowDays, out var windowFailure))
                {
                    return windowFailure!;
                }

                // Derive anything the agent did not supply, from stored data.
                var averageDaily = ReadDecimal(arguments, "averageDailyConsumption")
                                   ?? await _consumptionService.GetAverageDailyConsumptionAsync(
                                       facilityId,
                                       medicineId,
                                       windowDays,
                                       cancellationToken);

                if (averageDaily < 0)
                {
                    return BadRequest(new ErrorResponse
                                      {
                                          Error = new ErrorDetail
                                          {
                                              Code = DemandValidator.ValidationErrorCode,
                                              Message = "averageDailyConsumption cannot be negative.",
                                              TraceId = HttpContext.TraceIdentifier,
                                          },
                                      });
                }

                var leadTimeDays = ReadInt(arguments, "leadTimeDays")
                                   ?? await _forecastService.GetLeadTimeDaysAsync(
                                       facilityId,
                                       medicineId,
                                       cancellationToken);

                if (leadTimeDays < 0)
                {
                    return BadRequest(new ErrorResponse
                                      {
                                          Error = new ErrorDetail
                                          {
                                              Code = DemandValidator.ValidationErrorCode,
                                              Message = "leadTimeDays cannot be negative.",
                                              TraceId = HttpContext.TraceIdentifier,
                                          },
                                      });
                }

                // Read-only projection. A tool call must not create a shortage alert:
                // persisting an alert is a management action, and the agent may probe
                // this repeatedly while planning.
                var calculation = ShortageService.Calculate(
                    currentStock.Value,
                    averageDaily,
                    leadTimeDays,
                    DateTime.UtcNow.Date);

                return Ok(new ApiResponse<ProjectedStockoutToolResult>(new ProjectedStockoutToolResult(
                        facilityId,
                        medicineId,
                        calculation.CurrentStock,
                        calculation.AverageDailyConsumption,
                        calculation.DaysRemaining,
                        calculation.ProjectedStockoutDate,
                        calculation.LeadTimeDays,
                        calculation.RiskLevel,
                        calculation.RequiresTransfer)));
            }

            case "shortageThreshold":
            {
                var rule = await _forecastService.GetReorderRuleAsync(
                    facilityId,
                    medicineId,
                    cancellationToken);

                if (rule is null)
                {
                    return BadRequest(new ErrorResponse
                                      {
                                          Error = new ErrorDetail
                                          {
                                              Code = DemandValidator.ThresholdNotFoundCode,
                                              Message = $"No reorder rule is configured for medicine {medicineId} at facility {facilityId}.",
                                              TraceId = HttpContext.TraceIdentifier,
                                          },
                                      });
                }

                return Ok(new ApiResponse<ShortageThresholdToolResult>(new ShortageThresholdToolResult(
                        rule.FacilityId,
                        rule.MedicineId,
                        rule.MinimumStock,
                        rule.ReorderPoint,
                        rule.SafetyStock,
                        rule.LeadTimeDays)));
            }

            default:
                return UnknownOperation(request.Operation);
        }
    }

    // ------------------------------------------------------------------
    // Service authentication (placeholder - owner: Vaisnavi L.)
    // ------------------------------------------------------------------

    private bool IsServiceTokenValid()
    {
        var expected = _configuration["AgentService:ServiceToken"];

        // An unconfigured token must close the door, never open it.
        if (string.IsNullOrWhiteSpace(expected))
        {
            _logger.LogError(
                "AgentService:ServiceToken is not configured. Internal tool calls are refused.");
            return false;
        }

        if (!Request.Headers.TryGetValue(ServiceTokenHeader, out var provided))
        {
            return false;
        }

        var supplied = provided.ToString();

        if (string.IsNullOrEmpty(supplied))
        {
            return false;
        }

        // Fixed-time comparison so a wrong token cannot be discovered byte by byte.
        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(supplied),
            System.Text.Encoding.UTF8.GetBytes(expected));
    }

    private IActionResult RejectUnauthorized()
    {
        _logger.LogWarning("Internal tool call refused: missing or invalid service token.");

        return StatusCode(
            StatusCodes.Status401Unauthorized,
            new ErrorResponse
            {
                Error = new ErrorDetail
                {
                    Code = UnauthorizedCode,
                    Message = "A valid internal service token is required.",
                    TraceId = HttpContext.TraceIdentifier,
                },
            });
    }

    private IActionResult UnknownOperation(string operation)
    {
        return BadRequest(new ErrorResponse
                          {
                              Error = new ErrorDetail
                              {
                                  Code = UnknownOperationCode,
                                  Message = $"Unknown tool operation '{operation}'.",
                                  TraceId = HttpContext.TraceIdentifier,
                              },
                          });
    }

    // ------------------------------------------------------------------
    // Argument reading
    // ------------------------------------------------------------------

    private bool TryReadTarget(
        JsonElement arguments,
        out Guid facilityId,
        out Guid medicineId,
        out IActionResult? failure)
    {
        facilityId = ReadGuid(arguments, "facilityId");
        medicineId = ReadGuid(arguments, "medicineId");

        if (facilityId == Guid.Empty || medicineId == Guid.Empty)
        {
            failure = BadRequest(new ErrorResponse
                                 {
                                     Error = new ErrorDetail
                                     {
                                         Code = DemandValidator.ValidationErrorCode,
                                         Message = "facilityId and medicineId are required.",
                                         TraceId = HttpContext.TraceIdentifier,
                                     },
                                 });

            return false;
        }

        failure = null;
        return true;
    }

    private bool IsWindowValid(int windowDays, out IActionResult? failure)
    {
        if (windowDays is <= 0 or > DemandValidator.MaxWindowDays)
        {
            failure = BadRequest(new ErrorResponse
                                 {
                                     Error = new ErrorDetail
                                     {
                                         Code = DemandValidator.ValidationErrorCode,
                                         Message = $"windowDays must be between 1 and {DemandValidator.MaxWindowDays}.",
                                         TraceId = HttpContext.TraceIdentifier,
                                     },
                                 });

            return false;
        }

        failure = null;
        return true;
    }

    private static int ReadWindowDays(JsonElement arguments) => ReadInt(arguments, "windowDays") ?? 30;

    private static Guid ReadGuid(JsonElement arguments, string name)
    {
        if (arguments.ValueKind != JsonValueKind.Object
            || !arguments.TryGetProperty(name, out var value)
            || value.ValueKind != JsonValueKind.String)
        {
            return Guid.Empty;
        }

        return Guid.TryParse(value.GetString(), out var parsed) ? parsed : Guid.Empty;
    }

    private static int? ReadInt(JsonElement arguments, string name)
    {
        if (arguments.ValueKind != JsonValueKind.Object
            || !arguments.TryGetProperty(name, out var value)
            || value.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        return value.TryGetInt32(out var parsed) ? parsed : null;
    }

    private static decimal? ReadDecimal(JsonElement arguments, string name)
    {
        if (arguments.ValueKind != JsonValueKind.Object
            || !arguments.TryGetProperty(name, out var value)
            || value.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        return value.TryGetDecimal(out var parsed) ? parsed : null;
    }

    private static string? ReadString(JsonElement arguments, string name)
    {
        if (arguments.ValueKind != JsonValueKind.Object
            || !arguments.TryGetProperty(name, out var value)
            || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return value.GetString();
    }
}

/// <summary>
/// Envelope every internal tool call uses.
///
/// Not specified in the final blueprint: the request body shape of the internal tool
/// endpoints. Section 38 freezes the endpoint paths but not their payloads. Confirm with
/// the agent-contract owner, ILHAM MM (IT24103530), before integration.
/// </summary>
public class ToolRequest
{
    public string Operation { get; set; } = string.Empty;

    public JsonElement Arguments { get; set; }
}

/// <summary>Result of getConsumptionHistory.</summary>
public sealed record ConsumptionHistoryToolResult(
    Guid FacilityId,
    Guid MedicineId,
    int WindowDays,
    IReadOnlyList<ConsumptionHistoryEntry> Entries);

/// <summary>One day of recorded consumption.</summary>
public sealed record ConsumptionHistoryEntry(DateTime ConsumptionDate, decimal QuantityUsed);

/// <summary>Result of calculateDailyConsumption.</summary>
public sealed record DailyConsumptionToolResult(
    Guid FacilityId,
    Guid MedicineId,
    int WindowDays,
    decimal AverageDailyConsumption);

/// <summary>Result of calculateForecast.</summary>
public sealed record ForecastToolResult(
    Guid ForecastId,
    Guid FacilityId,
    Guid MedicineId,
    string Method,
    int WindowDays,
    int HorizonDays,
    decimal AverageDailyConsumption,
    decimal PredictedDemand,
    decimal ConfidenceScore,
    int LeadTimeDays);

/// <summary>Result of calculateProjectedStockout.</summary>
public sealed record ProjectedStockoutToolResult(
    Guid FacilityId,
    Guid MedicineId,
    decimal CurrentStock,
    decimal AverageDailyConsumption,
    int? DaysRemaining,
    DateTime? ProjectedStockoutDate,
    int LeadTimeDays,
    string RiskLevel,
    bool RequiresTransfer);

/// <summary>Result of getShortageThreshold.</summary>
public sealed record ShortageThresholdToolResult(
    Guid FacilityId,
    Guid MedicineId,
    decimal MinimumStock,
    decimal ReorderPoint,
    decimal SafetyStock,
    int LeadTimeDays);
