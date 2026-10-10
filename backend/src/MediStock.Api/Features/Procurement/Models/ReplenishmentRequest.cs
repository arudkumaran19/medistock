using System;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Redistribution.Models;

namespace MediStock.Api.Features.Procurement.Models;

public class ReplenishmentRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? SourceTransferId { get; set; }
    public TransferRequest? SourceTransfer { get; set; }

    public Guid FacilityId { get; set; }
    public Facility? Facility { get; set; }

    public Guid MedicineId { get; set; }
    public Medicine? Medicine { get; set; }

    public int RequestedQuantity { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Priority { get; set; } = "High";

    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string Status { get; set; } = "PendingPO"; // PendingPO | PO_CREATED

    public Guid? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
}
