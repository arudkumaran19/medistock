namespace MediStock.Api.Features.Workflow.Models;

public sealed class AgentExecution
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkflowRunId { get; set; }

    public string AgentName { get; set; } = string.Empty;

    public string Prompt { get; set; } = string.Empty;

    public string? Response { get; set; }

    public int TokensUsed { get; set; }

    public long ExecutionDurationMs { get; set; }

    public bool IsSuccess { get; set; } = true;

    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
