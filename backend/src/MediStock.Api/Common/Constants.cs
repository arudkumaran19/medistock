namespace MediStock.Api.Common;

/// <summary>
/// SHARED CONTRACT - primary owner: ILHAM MM (IT24103530).
/// Placeholder created by the Demand vertical only so this slice compiles.
/// Replace with the owner's implementation on integration.
/// </summary>
public static class Constants
{
    public const int DefaultPage = 1;

    public const int DefaultPageSize = 20;

    public const int MaxPageSize = 100;

    /// <summary>
    /// Role names defined by the blueprint (section 8).
    /// </summary>
    public static class Roles
    {
        public const string StoreOfficer = "STORE_OFFICER";
        public const string FacilityManager = "FACILITY_MANAGER";
        public const string SupplierOfficer = "SUPPLIER_OFFICER";
        public const string Admin = "ADMIN";
    }
}
