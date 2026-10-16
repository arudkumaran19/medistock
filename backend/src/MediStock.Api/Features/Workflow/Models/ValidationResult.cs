namespace MediStock.Api.Features.Workflow.Models;

public sealed class ValidationResult
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkflowRunId { get; set; }

    public string PolicyName { get; set; } = string.Empty;

    public bool Passed { get; set; }

    public string Message { get; set; } = string.Empty;

    public string? DetailsJson { get; set; }

    public DateTimeOffset EvaluatedAt { get; set; } = DateTimeOffset.UtcNow;
}
