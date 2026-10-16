namespace MediStock.Api.Features.Workflow.Models;

public sealed class WorkflowPlanStep
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkflowRunId { get; set; }

    public WorkflowRun? WorkflowRun { get; set; }

    public int StepOrder { get; set; }

    public string StepKey { get; set; } = string.Empty;

    public string AgentName { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending"; // Pending, Running, Completed, Failed, Skipped

    public string? InputJson { get; set; }

    public string? OutputJson { get; set; }

    public string? OutputSummary { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }
}
