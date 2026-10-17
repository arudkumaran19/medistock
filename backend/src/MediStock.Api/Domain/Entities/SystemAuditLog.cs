namespace MediStock.Api.Domain.Entities;

/// <summary>
/// Immutable system-wide audit event for enterprise security and operational governance.
/// Records security events, data mutations, role changes, clinical operations, and AI tool actions.
/// </summary>
public sealed class SystemAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Distributed request correlation ID spanning web, backend, and agent service.</summary>
    public string? CorrelationId { get; set; }

    /// <summary>Identity subject ID of the actor initiating the operation.</summary>
    public string? ActorId { get; set; }

    /// <summary>Email address or username of the actor.</summary>
    public string? ActorEmail { get; set; }

    /// <summary>Role or effective permissions of the actor at the time of execution.</summary>
    public string? ActorRole { get; set; }

    /// <summary>Action verb (e.g. AUTH_LOGIN, AUTH_DENIED, SHORTAGE_RAISED, SHORTAGE_RESOLVED, TRANSFER_APPROVED).</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>Target domain entity type (e.g. ShortageAlert, TransferRequest, PurchaseOrder, User, Medicine).</summary>
    public string ResourceType { get; set; } = string.Empty;

    /// <summary>Primary key of the target resource.</summary>
    public string? ResourceId { get; set; }

    /// <summary>Outcome status: Success, Failure, Denied.</summary>
    public string Outcome { get; set; } = "Success";

    /// <summary>Optional business reason or clinical justification.</summary>
    public string? Reason { get; set; }

    /// <summary>Structured contextual details (sanitized of secrets, passwords, tokens, and PHI).</summary>
    public string? DetailsJson { get; set; }

    /// <summary>Pre-mutation state snapshot for auditable diffing.</summary>
    public string? BeforeStateJson { get; set; }

    /// <summary>Post-mutation state snapshot for auditable diffing.</summary>
    public string? AfterStateJson { get; set; }

    /// <summary>Remote network origin IP address.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Immutable UTC timestamp of event generation.</summary>
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
