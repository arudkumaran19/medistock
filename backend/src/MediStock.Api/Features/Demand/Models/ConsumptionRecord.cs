namespace MediStock.Api.Features.Demand.Models;

/// <summary>
/// ConsumptionRecords table. Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// Historical medicine usage per facility, the input to demand forecasting.
/// </summary>
public class ConsumptionRecord
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    public decimal QuantityUsed { get; set; }

    public DateTime ConsumptionDate { get; set; }

    /// <summary>
    /// Origin of the record, e.g. the operational Flutter entry screen or a batch import.
    /// </summary>
    public string Source { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
