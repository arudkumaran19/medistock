using System;
using System.Collections.Generic;

namespace MediStock.Api.Features.Redistribution.DTOs;

public class RouteResponse
{
    public Guid SourceFacilityId { get; set; }
    public string SourceFacilityName { get; set; } = string.Empty;
    public double SourceLatitude { get; set; }
    public double SourceLongitude { get; set; }

    public Guid DestinationFacilityId { get; set; }
    public string DestinationFacilityName { get; set; } = string.Empty;
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }

    public decimal DistanceKm { get; set; }
    public decimal DurationMinutes { get; set; }
    public string Provider { get; set; } = string.Empty; // OpenRouteService or HaversineFallback
    public bool IsFallback { get; set; }
    public string? PolylineGeometry { get; set; }
    public List<RouteWaypointDto> Waypoints { get; set; } = new();
}

public class RouteWaypointDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? Label { get; set; }
}
