namespace MediStock.Api.Features.Inventory.Models;

public sealed class Facility
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public ICollection<InventoryBalance> InventoryBalances { get; set; } = new List<InventoryBalance>();
    public ICollection<MedicineBatch> Batches { get; set; } = new List<MedicineBatch>();
}