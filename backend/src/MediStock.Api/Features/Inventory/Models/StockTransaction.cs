using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Inventory.Models;

public sealed class StockTransaction
{
	public Guid Id { get; set; }
	public Guid MedicineId { get; set; }
	public Guid FacilityId { get; set; }
	public Guid? MedicineBatchId { get; set; }
	public StockTransactionType Type { get; set; }
	public int Quantity { get; set; }
	public int BalanceAfter { get; set; }
	public string Reason { get; set; } = string.Empty;
	public string? ActorId { get; set; }
	public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
	public MedicineBatch? MedicineBatch { get; set; }
}
