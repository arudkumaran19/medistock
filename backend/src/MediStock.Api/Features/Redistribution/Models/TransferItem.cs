using System;
using MediStock.Api.Domain.Entities;

namespace MediStock.Api.Features.Redistribution.Models;

public class TransferItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TransferRequestId { get; set; }
    public TransferRequest? TransferRequest { get; set; }

    public Guid MedicineId { get; set; }
    public Medicine? Medicine { get; set; }

    public string MedicineName { get; set; } = string.Empty;
    public int RequestedQuantity { get; set; }
    public int AllocatedQuantity { get; set; }
    public int? ReceivedQuantity { get; set; }

    public string UnitOfMeasure { get; set; } = "units";
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
