namespace MediStock.Api.Features.Workflow.Models;

public sealed class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkflowRunId { get; set; }

    public WorkflowRun? WorkflowRun { get; set; }

    public string EventType { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? DetailsJson { get; set; }

    public Guid? PerformedByUserId { get; set; }

    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
