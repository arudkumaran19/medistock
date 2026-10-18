using System;
using System.ComponentModel.DataAnnotations.Schema;
using MediStock.Api.Domain.Enums;

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

    // Compatibility aliases for develop / TransferService
    [NotMapped]
    public int StepNumber
    {
        get => StepOrder;
        set => StepOrder = value;
    }

    [NotMapped]
    public string StepName
    {
        get => string.IsNullOrEmpty(StepKey) ? Action : StepKey;
        set { StepKey = value; Action = value; }
    }

    [NotMapped]
    public DateTime? ExecutedAt
    {
        get => CompletedAt.HasValue ? CompletedAt.Value.UtcDateTime : null;
        set => CompletedAt = value.HasValue ? new DateTimeOffset(value.Value, TimeSpan.Zero) : null;
    }
}
