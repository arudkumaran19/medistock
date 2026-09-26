using System;

namespace MediStock.Api.Features.Workflow.Models;

public class ToolExecution
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AgentExecutionId { get; set; }
    public AgentExecution? AgentExecution { get; set; }

    public string ToolName { get; set; } = string.Empty;
    public string? InputParametersJson { get; set; }
    public string? OutputResultJson { get; set; }
    public long DurationMs { get; set; }
    public bool Success { get; set; } = true;
    public string? ErrorMessage { get; set; }
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
}
