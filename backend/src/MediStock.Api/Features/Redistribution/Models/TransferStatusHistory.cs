namespace MediStock.Api.Features.Redistribution.Models;

using MediStock.Api.Domain.Enums;

/// <summary>
/// One entry in a transfer's audit trail: who moved it from which status to which, and
/// why. Written for every transition and never edited. Redistribution vertical.
/// </summary>
public class TransferStatusHistory
{
    public Guid Id { get; set; }

    public Guid TransferRequestId { get; set; }

    public TransferRequest? TransferRequest { get; set; }

    /// <summary>Null for the entry that records the transfer's creation.</summary>
    public TransferStatus? FromStatus { get; set; }

    public TransferStatus ToStatus { get; set; }

    public Guid? ChangedByUserId { get; set; }

    public string? ChangedByEmail { get; set; }

    public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

    public string? Reason { get; set; }
}
