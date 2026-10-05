using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Procurement.Models;

public sealed class PurchaseOrder
{
    public Guid Id { get; set; }

    public Guid SupplierId { get; set; }

    public Guid FacilityId { get; set; }

    public PurchaseOrderStatus Status { get; set; }

    public DateTime RequestedAt { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public Guid? ApprovedById { get; set; }

    public DateTime? ReceivedAt { get; set; }

    // Approval workflow metadata (from procurement branch)
    public string? RejectionReason { get; set; }

    public string? RevisionReason { get; set; }

    // Navigation properties (from develop)
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();

    public ICollection<Delivery> Deliveries { get; set; } = new List<Delivery>();
}
