namespace MediStock.Api.Security;

public static class AuthorizationPolicies
{
    public const string RequireAdministrator = "RequireAdministrator";
    public const string RequireFacilityManager = "RequireFacilityManager";
    public const string RequirePharmacist = "RequirePharmacist";
    public const string RequireProcurementManager = "RequireProcurementManager";
}