namespace MediStock.Api.Features.Redistribution.Models;

public sealed class TransferItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TransferRequestId { get; set; }

    public Guid MedicineId { get; set; }

    public int Quantity { get; set; }

    public string? BatchNumber { get; set; }

    public DateTime? ExpiryDate { get; set; }
}
