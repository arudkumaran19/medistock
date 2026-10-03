namespace MediStock.Api.Infrastructure.AI;

using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

/// <summary>
/// Calls the internal agent service (blueprint section 37).
///
/// OWNERSHIP NOTE: <c>Infrastructure/AI/</c> has no assigned owner in the blueprint's
/// section 30 table.
///
///   Not specified in the final blueprint. Do not assume or introduce a new decision
///   without team-level confirmation.
///
/// Added by the Demand vertical (Sathurstiga S., IT24103156). Replace on integration.
///
/// This client is the ONLY path from the API to the agent service. React and Flutter
/// must never reach the agent service directly, so the shared token stays server-side.
/// A failure here is never fatal: the caller receives a null result and reports a safe
/// failure rather than surfacing an exception (blueprint section 41).
/// </summary>
public sealed class AgentServiceClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient _http;
    private readonly AgentServiceOptions _options;
    private readonly ILogger<AgentServiceClient> _logger;

    public AgentServiceClient(
        HttpClient http,
        IOptions<AgentServiceOptions> options,
        ILogger<AgentServiceClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>
    /// Runs an objective through the agent service.
    /// Returns null when the service is unreachable or refuses the call.
    /// </summary>
    public async Task<AgentRunResult?> RunAsync(
        AgentRunRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ServiceToken))
        {
            _logger.LogWarning(
                "AgentService:ServiceToken is not configured. Agent call refused.");
            return null;
        }

        if (_http.BaseAddress is null)
        {
            _logger.LogWarning(
                "AgentService:BaseUrl is not configured. Agent call refused.");
            return null;
        }

        try
        {
            using var message = new HttpRequestMessage(
                HttpMethod.Post, "/api/demand-agent/run")
            {
                Content = JsonContent.Create(request, options: JsonOptions),
            };

            message.Headers.Add("X-Internal-Token", _options.ServiceToken);

            using var response = await _http.SendAsync(message, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Agent service returned {StatusCode} for facility {FacilityId}.",
                    (int)response.StatusCode,
                    request.FacilityId);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<AgentRunResult>(
                JsonOptions, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // Safe failure: the agent being down must never break the API.
            _logger.LogWarning(ex, "Agent service is unreachable.");
            return null;
        }
    }

    /// <summary>Liveness of the agent service, for diagnostics and the demo.</summary>
    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken)
    {
        if (_http.BaseAddress is null)
        {
            return false;
        }

        try
        {
            using var response = await _http.GetAsync(
                "/api/demand-agent/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Agent service health check failed.");
            return false;
        }
    }
}

/// <summary>Objective delegated to the agent service.</summary>
public sealed record AgentRunRequest(
    string FacilityId,
    string MedicineId,
    string? Objective,
    decimal? CurrentStock,
    int WindowDays = 30);

/// <summary>Structured result returned by the agent service.</summary>
public sealed record AgentRunResult(
    string Intent,
    IReadOnlyList<string> Plan,
    string? HandledBy,
    AgentResultPayload? Result,
    int DurationMs);

/// <summary>Agent output contract (blueprint section 73).</summary>
public sealed record AgentResultPayload(
    string Agent,
    string Status,
    double Confidence,
    IReadOnlyList<AgentFinding> Findings,
    IReadOnlyList<AgentRecommendation> Recommendations,
    bool RequiredValidation,
    string? RequestedAction,
    IReadOnlyList<AgentEvidence> Evidence);

public sealed record AgentFinding(string Code, string Summary, double? Value, string? Unit);

public sealed record AgentRecommendation(string Code, string Summary, string Priority);

public sealed record AgentEvidence(string Source, string Detail, object? Value);
