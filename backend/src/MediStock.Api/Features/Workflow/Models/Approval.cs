using System;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.Models;

public class Approval
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowRunId { get; set; }
    public WorkflowRun? WorkflowRun { get; set; }

    public Guid? StepId { get; set; }
    public Guid ApproverUserId { get; set; }
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Approved;
    public string? DecisionNotes { get; set; }
    public DateTime DecidedAt { get; set; } = DateTime.UtcNow;
}
