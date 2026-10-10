using System;
using System.Collections.Generic;

namespace MediStock.Api.Features.Workflow.Models;

public class AgentExecution
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowRunId { get; set; }
    public WorkflowRun? WorkflowRun { get; set; }

    public string AgentName { get; set; } = "RedistributionPlanningAgent";
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public long ExecutionTimeMs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ToolExecution> ToolExecutions { get; set; } = new List<ToolExecution>();
}
