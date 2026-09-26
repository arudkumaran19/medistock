using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Workflow.Models;

namespace MediStock.Api.Features.Workflow.Services;

public interface IWorkflowStateService
{
    Task<WorkflowRun> CreateRunAsync(string workflowType, Guid initiatorUserId, string? contextJson, CancellationToken ct = default);
    Task<WorkflowPlanStep> AddStepAsync(Guid workflowRunId, int stepNumber, string stepName, string? inputJson = null, CancellationToken ct = default);
    Task CompleteStepAsync(Guid stepId, WorkflowStatus status, string? outputJson = null, CancellationToken ct = default);
    Task UpdateRunStatusAsync(Guid workflowRunId, WorkflowStatus status, CancellationToken ct = default);
    Task LogAuditAsync(string entityName, Guid entityId, string action, Guid userId, string? detailsJson = null, CancellationToken ct = default);
    Task<List<AuditLog>> GetAuditLogsAsync(string entityName, Guid entityId, CancellationToken ct = default);
}
