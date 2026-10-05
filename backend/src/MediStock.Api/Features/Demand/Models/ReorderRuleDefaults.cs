namespace MediStock.Api.Features.Demand.Models;

/// <summary>
/// Default reorder thresholds for a facility and medicine that has no configured
/// reorder rule. Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
///
/// Used by the startup seed for develop's real facilities and, without being stored,
/// for any other medicine and facility that exist in the Inventory tables, so the
/// shortage check and the Demand agent work for every medicine.
///
///   lead time      = 7 days
///   minimum stock  = the medicine's own MinimumStockLevel (100 when it has none)
///   reorder point  = 2 x minimum
///   safety stock   = minimum / 2
///
/// Not specified in the final blueprint: default lead times and thresholds for
/// medicines without a configured rule. Do not assume or introduce a new decision
/// without team-level confirmation.
/// </summary>
public static class ReorderRuleDefaults
{
    public const int LeadTimeDays = 7;

    /// <summary>Minimum stock used when a medicine has no MinimumStockLevel of its own.</summary>
    public const decimal MinimumStock = 100m;

    /// <summary>Builds the default rule for a facility and medicine. Not persisted here.</summary>
    public static ReorderRule For(Guid facilityId, Guid medicineId, int medicineMinimumStockLevel)
    {
        var minimum = medicineMinimumStockLevel > 0 ? medicineMinimumStockLevel : MinimumStock;

        return new ReorderRule
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            MedicineId = medicineId,
            MinimumStock = minimum,
            ReorderPoint = minimum * 2,
            SafetyStock = minimum / 2,
            LeadTimeDays = LeadTimeDays,
            CreatedAt = DateTime.UtcNow
        };
    }
}

/// <summary>
/// The reorder rule that applies to a facility and medicine: the configured one, or
/// the default from <see cref="ReorderRuleDefaults"/> when none is configured.
/// </summary>
/// <param name="Rule">The thresholds to use.</param>
/// <param name="IsDefault">True when no rule is configured and the default applies.</param>
public sealed record EffectiveReorderRule(ReorderRule Rule, bool IsDefault)
{
    public const string SourceConfigured = "CONFIGURED";
    public const string SourceDefault = "DEFAULT";

    public string Source => IsDefault ? SourceDefault : SourceConfigured;
}
