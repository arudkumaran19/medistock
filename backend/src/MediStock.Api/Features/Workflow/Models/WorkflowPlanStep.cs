using System;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.Models;

public class WorkflowPlanStep
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowRunId { get; set; }
    public WorkflowRun? WorkflowRun { get; set; }

    public int StepNumber { get; set; }
    public string StepName { get; set; } = string.Empty;
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Pending;
    public string? InputJson { get; set; }
    public string? OutputJson { get; set; }
    public DateTime? ExecutedAt { get; set; }
}
