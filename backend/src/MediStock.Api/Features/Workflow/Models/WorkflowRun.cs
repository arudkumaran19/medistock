using System;
using System.Collections.Generic;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.Models;

public class WorkflowRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string WorkflowType { get; set; } = "RedistributionPlanning";
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Pending;
    public Guid InitiatorUserId { get; set; }
    public string? ContextJson { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public ICollection<WorkflowPlanStep> Steps { get; set; } = new List<WorkflowPlanStep>();
    public ICollection<AgentExecution> AgentExecutions { get; set; } = new List<AgentExecution>();
    public ICollection<ValidationResult> ValidationResults { get; set; } = new List<ValidationResult>();
    public ICollection<Approval> Approvals { get; set; } = new List<Approval>();
}
