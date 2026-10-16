namespace MediStock.Api.Features.Demand.Models;

/// <summary>
/// ReorderRules table. Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// Source of the shortage threshold and lead time used by the shortage calculation and
/// by the agent tool getShortageThreshold.
/// </summary>
public class ReorderRule
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    public decimal MinimumStock { get; set; }

    public decimal ReorderPoint { get; set; }

    public decimal SafetyStock { get; set; }

    /// <summary>
    /// Supplier lead time in days, compared against days of stock remaining.
    /// </summary>
    public int LeadTimeDays { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
