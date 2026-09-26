using System;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Redistribution.Models;

public class TransferStatusHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TransferRequestId { get; set; }
    public TransferRequest? TransferRequest { get; set; }

    public TransferStatus? FromStatus { get; set; }
    public TransferStatus ToStatus { get; set; }

    public Guid ChangedByUserId { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

    public string? Reason { get; set; }
    public string? MetadataJson { get; set; } // GPS, tracking info, checkpoint data
}
