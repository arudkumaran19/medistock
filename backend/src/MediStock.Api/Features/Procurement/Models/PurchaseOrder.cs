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

    public DateTime? ReceivedAt { get; set; }
}