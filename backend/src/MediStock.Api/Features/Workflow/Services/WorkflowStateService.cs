using System.Text.Json;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Workflow.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Workflow.Services;

public interface IWorkflowStateService
{
    Task<WorkflowRun?> GetWorkflowAsync(Guid id, CancellationToken cancellationToken = default);

    Task<List<WorkflowRun>> GetActiveWorkflowsAsync(Guid? userId = null, CancellationToken cancellationToken = default);

    Task<List<WorkflowRun>> GetWorkflowsBySessionAsync(string sessionId, Guid? userId = null, CancellationToken cancellationToken = default);

    Task UpdateStatusAsync(
        Guid workflowId,
        WorkflowStatus newStatus,
        string? errorMessage = null,
        CancellationToken cancellationToken = default);

    Task AddAuditLogAsync(
        Guid workflowId,
        string eventType,
        string description,
        object? details = null,
        Guid? userId = null,
        CancellationToken cancellationToken = default);

    Task UpdateStepStatusAsync(
        Guid stepId,
        string status,
        string? outputSummary = null,
        string? outputJson = null,
        CancellationToken cancellationToken = default);
}

public sealed class WorkflowStateService : IWorkflowStateService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<WorkflowStateService> _logger;

    public WorkflowStateService(
        ApplicationDbContext db,
        ILogger<WorkflowStateService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<WorkflowRun?> GetWorkflowAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _db.Set<WorkflowRun>()
            .Include(w => w.Steps.OrderBy(s => s.StepOrder))
            .Include(w => w.Approvals)
            .Include(w => w.AuditLogs.OrderByDescending(a => a.Timestamp))
            .FirstOrDefaultAsync(w => w.Id == id, cancellationToken);
    }

    public async Task<List<WorkflowRun>> GetActiveWorkflowsAsync(Guid? userId = null, CancellationToken cancellationToken = default)
    {
        var query = _db.Set<WorkflowRun>()
            .Include(w => w.Steps.OrderBy(s => s.StepOrder))
            .Include(w => w.Approvals)
            .Where(w => w.Status == WorkflowStatus.Running || w.Status == WorkflowStatus.WaitingForApproval);

        if (userId.HasValue)
        {
            query = query.Where(w => !w.InitiatedByUserId.HasValue || w.InitiatedByUserId == userId.Value);
        }

        return await query
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<WorkflowRun>> GetWorkflowsBySessionAsync(string sessionId, Guid? userId = null, CancellationToken cancellationToken = default)
    {
        var query = _db.Set<WorkflowRun>()
            .Include(w => w.Steps.OrderBy(s => s.StepOrder))
            .Include(w => w.Approvals)
            .Where(w => w.SessionId == sessionId);

        if (userId.HasValue)
        {
            query = query.Where(w => !w.InitiatedByUserId.HasValue || w.InitiatedByUserId == userId.Value);
        }

        return await query
            .OrderBy(w => w.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task UpdateStatusAsync(
        Guid workflowId,
        WorkflowStatus newStatus,
        string? errorMessage = null,
        CancellationToken cancellationToken = default)
    {
        var run = await _db.Set<WorkflowRun>().FirstOrDefaultAsync(w => w.Id == workflowId, cancellationToken);
        if (run is null)
        {
            _logger.LogWarning("WorkflowRun {WorkflowId} not found when updating status to {Status}", workflowId, newStatus);
            return;
        }

        var oldStatus = run.Status;
        run.Status = newStatus;
        run.UpdatedAt = DateTimeOffset.UtcNow;

        if (!string.IsNullOrWhiteSpace(errorMessage))
        {
            run.ErrorMessage = errorMessage;
        }

        if (newStatus is WorkflowStatus.Completed or WorkflowStatus.Failed or WorkflowStatus.Rejected or WorkflowStatus.Cancelled)
        {
            run.CompletedAt = DateTimeOffset.UtcNow;
        }

        var audit = new AuditLog
        {
            WorkflowRunId = workflowId,
            EventType = "STATUS_CHANGED",
            Description = $"Status transitioned from {oldStatus} to {newStatus}",
            DetailsJson = errorMessage is not null ? JsonSerializer.Serialize(new { errorMessage }) : null,
            Timestamp = DateTimeOffset.UtcNow
        };

        _db.Set<AuditLog>().Add(audit);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task AddAuditLogAsync(
        Guid workflowId,
        string eventType,
        string description,
        object? details = null,
        Guid? userId = null,
        CancellationToken cancellationToken = default)
    {
        var audit = new AuditLog
        {
            WorkflowRunId = workflowId,
            EventType = eventType,
            Description = description,
            DetailsJson = details is not null ? JsonSerializer.Serialize(details) : null,
            PerformedByUserId = userId,
            Timestamp = DateTimeOffset.UtcNow
        };

        _db.Set<AuditLog>().Add(audit);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateStepStatusAsync(
        Guid stepId,
        string status,
        string? outputSummary = null,
        string? outputJson = null,
        CancellationToken cancellationToken = default)
    {
        var step = await _db.Set<WorkflowPlanStep>().FirstOrDefaultAsync(s => s.Id == stepId, cancellationToken);
        if (step is null) return;

        step.Status = status;
        if (outputSummary is not null) step.OutputSummary = outputSummary;
        if (outputJson is not null) step.OutputJson = outputJson;

        if (status == "Running" && step.StartedAt is null)
        {
            step.StartedAt = DateTimeOffset.UtcNow;
        }
        else if (status is "Completed" or "Failed" or "Skipped")
        {
            step.CompletedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}
