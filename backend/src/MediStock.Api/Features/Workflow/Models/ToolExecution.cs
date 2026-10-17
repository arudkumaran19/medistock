namespace MediStock.Api.Features.Workflow.Models;

public sealed class ToolExecution
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkflowRunId { get; set; }

    public string ToolName { get; set; } = string.Empty;

    public string InputParametersJson { get; set; } = string.Empty;

    public string? OutputResultJson { get; set; }

    public bool IsSuccess { get; set; } = true;

    public string? ErrorMessage { get; set; }

    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
