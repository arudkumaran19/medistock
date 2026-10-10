using System;

namespace MediStock.Api.Features.Workflow.Models;

public class ValidationResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowRunId { get; set; }
    public WorkflowRun? WorkflowRun { get; set; }

    public string RuleName { get; set; } = string.Empty;
    public bool IsValid { get; set; }
    public string? ValidationDetailsJson { get; set; }
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
}
