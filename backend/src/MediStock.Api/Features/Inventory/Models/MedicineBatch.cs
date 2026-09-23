namespace MediStock.Api.Features.Inventory.Models;

public sealed class MedicineBatch
{
    public Guid Id { get; set; }

    public Guid MedicineId { get; set; }

    public string BatchNumber { get; set; } = string.Empty;

    public DateOnly ExpiryDate { get; set; }

    public int Quantity { get; set; }
}
