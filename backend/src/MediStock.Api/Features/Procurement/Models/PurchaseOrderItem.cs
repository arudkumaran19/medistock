namespace MediStock.Api.Features.Procurement.Models;

public sealed class PurchaseOrderItem
{
    public Guid Id { get; set; }

    public Guid PurchaseOrderId { get; set; }

    public Guid MedicineId { get; set; }

    public int RequestedQuantity { get; set; }

    public decimal UnitPrice { get; set; }
}