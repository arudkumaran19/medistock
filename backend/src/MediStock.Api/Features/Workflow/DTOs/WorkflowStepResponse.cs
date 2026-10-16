namespace MediStock.Api.Features.Workflow.DTOs;

public sealed class WorkflowStepResponse
{
    public Guid Id { get; set; }

    public int StepOrder { get; set; }

    public string StepKey { get; set; } = string.Empty;

    public string AgentName { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? OutputSummary { get; set; }

    public string? OutputJson { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }
}
