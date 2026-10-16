using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.Models;

public sealed class WorkflowRun
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string WorkflowType { get; set; } = "ShortageResolution";

    public string Objective { get; set; } = string.Empty;

    public WorkflowStatus Status { get; set; } = WorkflowStatus.Pending;

    public Guid? FacilityId { get; set; }

    public Guid? MedicineId { get; set; }

    public Guid? InitiatedByUserId { get; set; }

    public bool RequiresApproval { get; set; }

    /// <summary>Frontend chat session ID (opaque string from client) for grouping workflows by session.</summary>
    public string? SessionId { get; set; }

    /// <summary>Frontend message ID that triggered this workflow run.</summary>
    public string? MessageId { get; set; }

    public string? ContextJson { get; set; }

    public string? ResultJson { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? CompletedAt { get; set; }

    public ICollection<WorkflowPlanStep> Steps { get; set; } = new List<WorkflowPlanStep>();

    public ICollection<Approval> Approvals { get; set; } = new List<Approval>();

    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
