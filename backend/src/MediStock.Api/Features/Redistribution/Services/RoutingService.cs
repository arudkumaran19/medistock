using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MediStock.Api.Common;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Services;

public class RoutingService : IRoutingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RoutingService> _logger;

    private const double EarthRadiusKm = 6371.0;
    private const double RoadWindingFactor = 1.25; // Empirical road curvature ratio over straight line

    public RoutingService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<RoutingService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<RouteResponse> CalculateRouteAsync(Facility source, Facility destination, CancellationToken ct = default)
    {
        return await CalculateRouteCoordinatesAsync(
            source.Latitude,
            source.Longitude,
            destination.Latitude,
            destination.Longitude,
            source.Name,
            destination.Name,
            source.Id,
            destination.Id,
            ct);
    }

    public async Task<RouteResponse> CalculateRouteCoordinatesAsync(
        double sourceLat,
        double sourceLon,
        double destLat,
        double destLon,
        string sourceName = "",
        string destName = "",
        Guid? sourceId = null,
        Guid? destId = null,
        CancellationToken ct = default)
    {
        var apiKey = _configuration["OpenRouteService:ApiKey"];
        var baseUrl = _configuration["OpenRouteService:BaseUrl"] ?? Constants.OpenRouteServiceBaseUrl;

        // If API key is missing, immediately use fallback without failing
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogInformation("OpenRouteService API key not configured. Using deterministic Haversine fallback.");
            return CalculateHaversineFallback(sourceLat, sourceLon, destLat, destLon, sourceName, destName, sourceId, destId);
        }

        try
        {
            // OpenRouteService expects coordinates as [longitude, latitude]
            var url = $"{baseUrl.TrimEnd('/')}/v2/directions/driving-car?start={sourceLon:F6},{sourceLat:F6}&end={destLon:F6},{destLat:F6}";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.TryAddWithoutValidation("Authorization", apiKey);
            request.Headers.TryAddWithoutValidation("Accept", "application/json, application/geo+json");

            var response = await _httpClient.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "OpenRouteService responded with status {StatusCode} ({ReasonPhrase}). Falling back to Haversine.",
                    (int)response.StatusCode, response.ReasonPhrase);
                return CalculateHaversineFallback(sourceLat, sourceLon, destLat, destLon, sourceName, destName, sourceId, destId);
            }

            var content = await response.Content.ReadAsStringAsync(ct);
            using var jsonDoc = JsonDocument.Parse(content);

            if (jsonDoc.RootElement.TryGetProperty("features", out var features) && features.GetArrayLength() > 0)
            {
                var feature = features[0];
                var properties = feature.GetProperty("properties");
                var summary = properties.GetProperty("summary");

                var distanceMeters = summary.GetProperty("distance").GetDouble();
                var durationSeconds = summary.GetProperty("duration").GetDouble();

                var distanceKm = Math.Round((decimal)(distanceMeters / 1000.0), 2);
                var durationMinutes = Math.Round((decimal)(durationSeconds / 60.0), 2);

                string? polyline = null;
                var waypoints = new List<RouteWaypointDto>();

                if (feature.TryGetProperty("geometry", out var geometry))
                {
                    polyline = geometry.GetRawText();

                    if (geometry.TryGetProperty("coordinates", out var coords) && coords.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var pt in coords.EnumerateArray())
                        {
                            if (pt.GetArrayLength() >= 2)
                            {
                                waypoints.Add(new RouteWaypointDto
                                {
                                    Longitude = pt[0].GetDouble(),
                                    Latitude = pt[1].GetDouble()
                                });
                            }
                        }
                    }
                }

                return new RouteResponse
                {
                    SourceFacilityId = sourceId ?? Guid.Empty,
                    SourceFacilityName = sourceName,
                    SourceLatitude = sourceLat,
                    SourceLongitude = sourceLon,
                    DestinationFacilityId = destId ?? Guid.Empty,
                    DestinationFacilityName = destName,
                    DestinationLatitude = destLat,
                    DestinationLongitude = destLon,
                    DistanceKm = distanceKm,
                    DurationMinutes = durationMinutes,
                    Provider = Constants.OpenRouteServiceProvider,
                    IsFallback = false,
                    PolylineGeometry = polyline,
                    Waypoints = waypoints
                };
            }

            _logger.LogWarning("OpenRouteService response did not contain features. Falling back to Haversine.");
            return CalculateHaversineFallback(sourceLat, sourceLon, destLat, destLon, sourceName, destName, sourceId, destId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenRouteService call failed or timed out. Falling back to deterministic Haversine calculation.");
            return CalculateHaversineFallback(sourceLat, sourceLon, destLat, destLon, sourceName, destName, sourceId, destId);
        }
    }

    public static RouteResponse CalculateHaversineFallback(
        double sourceLat,
        double sourceLon,
        double destLat,
        double destLon,
        string sourceName = "",
        string destName = "",
        Guid? sourceId = null,
        Guid? destId = null)
    {
        var straightLineKm = ComputeHaversineDistanceKm(sourceLat, sourceLon, destLat, destLon);
        var roadDistanceKm = Math.Round((decimal)(straightLineKm * RoadWindingFactor), 2);
        
        // Estimated transit time at 45 km/h
        var durationMinutes = Math.Round((decimal)((double)roadDistanceKm / Constants.DefaultAverageTransitSpeedKmh * 60.0), 2);

        var waypoints = new List<RouteWaypointDto>
        {
            new() { Latitude = sourceLat, Longitude = sourceLon, Label = sourceName },
            new() { Latitude = destLat, Longitude = destLon, Label = destName }
        };

        return new RouteResponse
        {
            SourceFacilityId = sourceId ?? Guid.Empty,
            SourceFacilityName = sourceName,
            SourceLatitude = sourceLat,
            SourceLongitude = sourceLon,
            DestinationFacilityId = destId ?? Guid.Empty,
            DestinationFacilityName = destName,
            DestinationLatitude = destLat,
            DestinationLongitude = destLon,
            DistanceKm = roadDistanceKm,
            DurationMinutes = durationMinutes,
            Provider = Constants.HaversineFallbackProvider,
            IsFallback = true,
            PolylineGeometry = null,
            Waypoints = waypoints
        };
    }

    public static double ComputeHaversineDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);

        var rLat1 = ToRadians(lat1);
        var rLat2 = ToRadians(lat2);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(rLat1) * Math.Cos(rLat2) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return EarthRadiusKm * c;
    }

    private static double ToRadians(double degrees) => degrees * (Math.PI / 180.0);
}
