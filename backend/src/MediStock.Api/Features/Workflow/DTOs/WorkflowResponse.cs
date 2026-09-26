using System;
using System.Collections.Generic;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.DTOs;

public class WorkflowResponse
{
    public Guid Id { get; set; }
    public string WorkflowType { get; set; } = string.Empty;
    public WorkflowStatus Status { get; set; }
    public Guid InitiatorUserId { get; set; }
    public string? ContextJson { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public List<WorkflowStepResponse> Steps { get; set; } = new();
    public List<AgentExecutionSummaryDto> AgentExecutions { get; set; } = new();
    public List<ValidationResultSummaryDto> ValidationResults { get; set; } = new();
    public List<ApprovalSummaryDto> Approvals { get; set; } = new();
}

public class AgentExecutionSummaryDto
{
    public Guid Id { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public long ExecutionTimeMs { get; set; }
    public List<ToolExecutionSummaryDto> ToolExecutions { get; set; } = new();
}

public class ToolExecutionSummaryDto
{
    public Guid Id { get; set; }
    public string ToolName { get; set; } = string.Empty;
    public string? InputParametersJson { get; set; }
    public string? OutputResultJson { get; set; }
    public long DurationMs { get; set; }
    public bool Success { get; set; }
}

public class ValidationResultSummaryDto
{
    public Guid Id { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public bool IsValid { get; set; }
    public string? ValidationDetailsJson { get; set; }
    public DateTime CheckedAt { get; set; }
}

public class ApprovalSummaryDto
{
    public Guid Id { get; set; }
    public Guid ApproverUserId { get; set; }
    public WorkflowStatus Status { get; set; }
    public string? DecisionNotes { get; set; }
    public DateTime DecidedAt { get; set; }
}
