namespace MediStock.Api.Features.Inventory.Models;

public sealed class InventoryBalance
{
	public Guid Id { get; set; }
	public Guid MedicineId { get; set; }
	public Guid FacilityId { get; set; }
	public int QuantityOnHand { get; set; }
	public int QuantityReserved { get; set; }
	public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
	public Medicine Medicine { get; set; } = null!;
	public Facility Facility { get; set; } = null!;
	public int AvailableQuantity => QuantityOnHand - QuantityReserved;
}
