namespace MediStock.Api.Infrastructure.External;

public sealed class OpenRouteServiceClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OpenRouteServiceClient> _logger;

    public OpenRouteServiceClient(
        HttpClient http,
        IConfiguration configuration,
        ILogger<OpenRouteServiceClient> logger)
    {
        _http = http;
        _configuration = configuration;
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(
        _configuration["OpenRouteService:ApiKey"] ?? _configuration["OPENROUTESERVICE_API_KEY"]);

    public async Task<(decimal DistanceKm, decimal DurationMinutes)?> GetRouteEstimateAsync(
        double startLat,
        double startLon,
        double endLat,
        double endLon,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured) return null;

        try
        {
            var apiKey = _configuration["OpenRouteService:ApiKey"] ?? _configuration["OPENROUTESERVICE_API_KEY"];
            var url = $"https://api.openrouteservice.org/v2/directions/driving-car?api_key={apiKey}&start={startLon},{startLat}&end={endLon},{endLat}";
            using var response = await _http.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            // Optional parsing if OpenRouteService returns live telemetry
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenRouteService query failed; fallback will be used.");
            return null;
        }
    }
}
