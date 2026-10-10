using System;

namespace MediStock.Api.Features.Procurement.DTOs;

public class ReplenishmentRequestDto
{
    public Guid Id { get; set; }
    public Guid? SourceTransferId { get; set; }
    public string? SourceTransferNumber { get; set; }
    public Guid FacilityId { get; set; }
    public string? FacilityName { get; set; }
    public Guid MedicineId { get; set; }
    public string? MedicineName { get; set; }
    public int RequestedQuantity { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Priority { get; set; } = "High";
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "PendingPO";
    public Guid? PurchaseOrderId { get; set; }
    public string? PurchaseOrderNumber { get; set; }
}

public class CreatePurchaseOrderFromReplenishmentDto
{
    public Guid? SupplierId { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }
    public decimal? UnitPrice { get; set; }
    public string? Notes { get; set; }
}
