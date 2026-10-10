namespace MediStock.Api.Domain.Entities;

public class FacilityInventory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FacilityId { get; set; }
    public Facility? Facility { get; set; }

    public Guid MedicineId { get; set; }
    public Medicine? Medicine { get; set; }

    public int StockOnHand { get; set; }
    public int SafetyStockThreshold { get; set; }
    public int ReservedStock { get; set; }

    public string BatchNumber { get; set; } = string.Empty;
    public DateTime? ExpiryDate { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Calculated available surplus quantity that can be safely redistributed without breaching safety stock.
    /// </summary>
    public int AvailableSurplus => Math.Max(0, StockOnHand - SafetyStockThreshold - ReservedStock);
}
