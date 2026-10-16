namespace MediStock.Api.Features.Redistribution.Services;

/// <summary>
/// Estimated road distance and travel time between facilities. Redistribution vertical.
///
/// The redistribution design called OpenRouteService and fell back to a Haversine
/// estimate when no API key was configured. This keeps only the fallback, which is
/// deterministic and needs no network.
///
/// DEMONSTRATION COORDINATES. The shared Facilities table (Inventory vertical) has no
/// latitude or longitude, and adding them would change another member's schema, so the
/// seeded facilities are placed here at representative Sri Lankan towns. Not specified
/// in the final blueprint: real facility locations. Do not assume or introduce a new
/// decision without team-level confirmation. Replace with stored coordinates when the
/// team agrees to add them.
/// </summary>
public sealed class RoutingService
{
    public const string Provider = "HaversineFallback (demo coordinates)";

    private const double EarthRadiusKm = 6371.0;

    /// <summary>Straight-line distance is shorter than any road; this scales it to a road estimate.</summary>
    private const double RoadFactor = 1.25;

    /// <summary>Average road speed for a medical supply vehicle, km/h.</summary>
    private const double AverageSpeedKmh = 45.0;

    private static readonly Dictionary<Guid, (double Lat, double Lon, string Town)> Locations = new()
    {
        [Guid.Parse("11111111-1111-1111-1111-111111111111")] = (6.9271, 79.8612, "Colombo"),     // Central Facility
        [Guid.Parse("99999999-9999-9999-9999-999999999999")] = (6.0535, 80.2210, "Galle"),       // Eastview General Hospital
        [Guid.Parse("88888888-8888-8888-8888-888888888888")] = (7.2906, 80.6337, "Kandy"),       // Northside Community Clinic
        [Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")] = (7.2083, 79.8358, "Negombo"),     // Westgate Public Dispensary
    };

    /// <summary>Used for facilities created after seeding, which have no demo location.</summary>
    private static readonly (double Lat, double Lon, string Town) DefaultLocation = (7.8731, 80.7718, "Dambulla");

    public (double Lat, double Lon, string Town) LocationOf(Guid facilityId) =>
        Locations.TryGetValue(facilityId, out var location) ? location : DefaultLocation;

    public (decimal DistanceKm, decimal DurationMinutes) Estimate(Guid sourceFacilityId, Guid destinationFacilityId)
    {
        var (sLat, sLon, _) = LocationOf(sourceFacilityId);
        var (dLat, dLon, _) = LocationOf(destinationFacilityId);

        var straightKm = Haversine(sLat, sLon, dLat, dLon);
        var roadKm = straightKm * RoadFactor;
        var minutes = roadKm / AverageSpeedKmh * 60.0;

        return (Math.Round((decimal)roadKm, 1), Math.Round((decimal)minutes, 0));
    }

    private static double Haversine(double lat1, double lon1, double lat2, double lon2)
    {
        static double ToRad(double degrees) => degrees * Math.PI / 180.0;

        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        return EarthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
