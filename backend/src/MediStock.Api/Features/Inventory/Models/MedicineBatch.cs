using MediStock.Api.Domain.Entities;

namespace MediStock.Api.Features.Inventory.Models;

public sealed class MedicineBatch
{
    public Guid Id { get; set; }
    public Guid MedicineId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime ExpiryDateUtc { get; set; }
    public DateTime ManufacturingDateUtc { get; set; }
    public int QuantityOnHand { get; set; }
    public Guid FacilityId { get; set; }
    public Medicine Medicine { get; set; } = null!;
    public Facility Facility { get; set; } = null!;
    public ICollection<StockTransaction> StockTransactions { get; set; } = new List<StockTransaction>();
}
