using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Procurement.Models;

public sealed class Delivery
{
    public Guid Id { get; set; }

    public Guid PurchaseOrderId { get; set; }

    public DeliveryStatus Status { get; set; }

    public DateTime? ExpectedAt { get; set; }

    public DateTime? DeliveredAt { get; set; }

    public string? TrackingNumber { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public PurchaseOrder PurchaseOrder { get; set; } = null!;
}
