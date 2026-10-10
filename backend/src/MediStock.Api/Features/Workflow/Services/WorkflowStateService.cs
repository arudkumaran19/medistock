using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Data;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Workflow.Models;

namespace MediStock.Api.Features.Workflow.Services;

public class WorkflowStateService : IWorkflowStateService
{
    private readonly MediStockDbContext _dbContext;
    private readonly ILogger<WorkflowStateService> _logger;

    public WorkflowStateService(
        MediStockDbContext dbContext,
        ILogger<WorkflowStateService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<WorkflowRun> CreateRunAsync(
        string workflowType,
        Guid initiatorUserId,
        string? contextJson,
        CancellationToken ct = default)
    {
        var run = new WorkflowRun
        {
            Id = Guid.NewGuid(),
            WorkflowType = workflowType,
            Status = WorkflowStatus.Running,
            InitiatorUserId = initiatorUserId,
            ContextJson = contextJson,
            StartedAt = DateTime.UtcNow
        };

        _dbContext.WorkflowRuns.Add(run);
        await _dbContext.SaveChangesAsync(ct);

        await LogAuditAsync("WorkflowRun", run.Id, "CREATED", initiatorUserId, contextJson, ct);
        _logger.LogInformation("Created WorkflowRun {WorkflowRunId} for {WorkflowType}", run.Id, workflowType);

        return run;
    }

    public async Task<WorkflowPlanStep> AddStepAsync(
        Guid workflowRunId,
        int stepNumber,
        string stepName,
        string? inputJson = null,
        CancellationToken ct = default)
    {
        var step = new WorkflowPlanStep
        {
            Id = Guid.NewGuid(),
            WorkflowRunId = workflowRunId,
            StepNumber = stepNumber,
            StepName = stepName,
            Status = WorkflowStatus.Running,
            InputJson = inputJson,
            ExecutedAt = DateTime.UtcNow
        };

        _dbContext.WorkflowPlanSteps.Add(step);
        await _dbContext.SaveChangesAsync(ct);

        return step;
    }

    public async Task CompleteStepAsync(
        Guid stepId,
        WorkflowStatus status,
        string? outputJson = null,
        CancellationToken ct = default)
    {
        var step = await _dbContext.WorkflowPlanSteps.FindAsync(new object[] { stepId }, ct);
        if (step != null)
        {
            step.Status = status;
            step.OutputJson = outputJson;
            step.ExecutedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task UpdateRunStatusAsync(
        Guid workflowRunId,
        WorkflowStatus status,
        CancellationToken ct = default)
    {
        var run = await _dbContext.WorkflowRuns.FindAsync(new object[] { workflowRunId }, ct);
        if (run != null)
        {
            run.Status = status;
            if (status == WorkflowStatus.Completed || status == WorkflowStatus.Failed || status == WorkflowStatus.Rejected)
            {
                run.CompletedAt = DateTime.UtcNow;
            }
            await _dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task LogAuditAsync(
        string entityName,
        Guid entityId,
        string action,
        Guid userId,
        string? detailsJson = null,
        CancellationToken ct = default)
    {
        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            EntityName = entityName,
            EntityId = entityId,
            Action = action,
            UserId = userId,
            Timestamp = DateTime.UtcNow,
            DetailsJson = detailsJson
        };

        _dbContext.AuditLogs.Add(log);
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<List<AuditLog>> GetAuditLogsAsync(
        string entityName,
        Guid entityId,
        CancellationToken ct = default)
    {
        return await _dbContext.AuditLogs
            .AsNoTracking()
            .Where(a => a.EntityName == entityName && a.EntityId == entityId)
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync(ct);
    }
}
