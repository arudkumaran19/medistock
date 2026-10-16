namespace MediStock.Api.Features.Demand.Models;

/// <summary>
/// Status change history for a shortage alert to maintain full lifecycle auditability.
/// Tracks every state transition (OPEN -> ACKNOWLEDGED -> RESOLVED) with actor, timestamp, notes, and verification method.
/// </summary>
public sealed class ShortageStatusHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ShortageAlertId { get; set; }

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string ChangedBy { get; set; } = string.Empty;

    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

    public string? Reason { get; set; }

    public string? Notes { get; set; }

    public string? VerificationMethod { get; set; }
}
