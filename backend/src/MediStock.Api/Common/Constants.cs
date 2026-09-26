namespace MediStock.Api.Common;

public static class Constants
{
    public const string OpenRouteServiceBaseUrl = "https://api.openrouteservice.org";
    public const string OpenRouteServiceApiKeyHeader = "Authorization";

    public const string HaversineFallbackProvider = "HaversineFallback";
    public const string OpenRouteServiceProvider = "OpenRouteService";

    public const double DefaultAverageTransitSpeedKmh = 45.0; // 45 km/h urban/rural road average
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static class Roles
    {
        public const string Admin = "Admin";
        public const string FacilityManager = "FacilityManager";
        public const string FieldOfficer = "FieldOfficer";
        public const string Pharmacist = "Pharmacist";
    }

    public static class SystemUsers
    {
        public static readonly System.Guid SystemAgentUserId = System.Guid.Parse("11111111-1111-1111-1111-111111111111");
        public static readonly System.Guid DefaultTestUserId = System.Guid.Parse("22222222-2222-2222-2222-222222222222");
    }
}
