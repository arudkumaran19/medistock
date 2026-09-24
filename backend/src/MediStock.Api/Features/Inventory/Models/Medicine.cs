namespace MediStock.Api.Features.Inventory.Models;

public sealed class Medicine
{
	public Guid Id { get; set; }
	public string Code { get; set; } = string.Empty;
	public string Name { get; set; } = string.Empty;
	public string Unit { get; set; } = "unit";
	public int MinimumStockLevel { get; set; }
	public bool IsActive { get; set; } = true;
	public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
	public ICollection<MedicineBatch> Batches { get; set; } = new List<MedicineBatch>();
	public ICollection<InventoryBalance> InventoryBalances { get; set; } = new List<InventoryBalance>();
}
