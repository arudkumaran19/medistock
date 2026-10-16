namespace MediStock.Api.Features.Redistribution.Models;

using MediStock.Api.Domain.Enums;

/// <summary>
/// A request to move one medicine from a facility with surplus to one with a shortage.
/// Redistribution vertical (Member 3).
///
/// One medicine per transfer. The redistribution design allowed several items, but every
/// screen in it showed a single medicine, and the inventory it reserves against is held
/// per medicine and facility, so a single line keeps reservation and delivery exact.
/// </summary>
public class TransferRequest
{
    public Guid Id { get; set; }

    /// <summary>Human-readable reference, e.g. TR-20261005-0001.</summary>
    public string TransferNumber { get; set; } = string.Empty;

    public Guid MedicineId { get; set; }

    /// <summary>Chosen when a candidate source is proposed; empty until then.</summary>
    public Guid? SourceFacilityId { get; set; }

    public Guid DestinationFacilityId { get; set; }

    public int Quantity { get; set; }

    public TransferPriority Priority { get; set; } = TransferPriority.Medium;

    public TransferStatus Status { get; set; } = TransferStatus.Draft;

    /// <summary>Source batch allocated at reservation, earliest expiry first.</summary>
    public string? BatchNumber { get; set; }

    public decimal? EstimatedDistanceKm { get; set; }

    public decimal? EstimatedDurationMinutes { get; set; }

    public string? RoutingProvider { get; set; }

    public string? Notes { get; set; }

    public string? RejectionReason { get; set; }

    public Guid? RequestedByUserId { get; set; }

    public Guid? ApprovedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? DispatchedAtUtc { get; set; }

    public DateTime? DeliveredAtUtc { get; set; }

    public ICollection<TransferStatusHistory> StatusHistory { get; set; } = new List<TransferStatusHistory>();
}
