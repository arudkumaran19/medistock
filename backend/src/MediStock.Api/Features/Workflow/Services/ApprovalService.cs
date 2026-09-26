using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Models;

namespace MediStock.Api.Features.Workflow.Services;

public class ApprovalService : IApprovalService
{
    private readonly MediStockDbContext _dbContext;
    private readonly ITransferService _transferService;
    private readonly IWorkflowStateService _workflowStateService;
    private readonly ILogger<ApprovalService> _logger;

    public ApprovalService(
        MediStockDbContext dbContext,
        ITransferService transferService,
        IWorkflowStateService workflowStateService,
        ILogger<ApprovalService> logger)
    {
        _dbContext = dbContext;
        _transferService = transferService;
        _workflowStateService = workflowStateService;
        _logger = logger;
    }

    public async Task<ApiResponse<WorkflowResponse>> ApproveAsync(
        Guid workflowRunId,
        ApprovalRequest request,
        CancellationToken ct = default)
    {
        var run = await _dbContext.WorkflowRuns
            .Include(w => w.Steps)
            .Include(w => w.AgentExecutions).ThenInclude(ae => ae.ToolExecutions)
            .Include(w => w.ValidationResults)
            .Include(w => w.Approvals)
            .FirstOrDefaultAsync(w => w.Id == workflowRunId, ct);

        if (run == null)
        {
            return ApiResponse<WorkflowResponse>.Fail($"Workflow run {workflowRunId} not found.");
        }

        if (run.Status != WorkflowStatus.WaitingForApproval && run.Status != WorkflowStatus.Running)
        {
            return ApiResponse<WorkflowResponse>.Fail($"Workflow run is not in a state awaiting approval. Current status is '{run.Status}'.");
        }

        var approval = new Approval
        {
            Id = Guid.NewGuid(),
            WorkflowRunId = run.Id,
            ApproverUserId = request.ApproverUserId != Guid.Empty ? request.ApproverUserId : Constants.SystemUsers.DefaultTestUserId,
            Status = WorkflowStatus.Approved,
            DecisionNotes = request.DecisionNotes ?? "Workflow approved by manager.",
            DecidedAt = DateTime.UtcNow
        };

        _dbContext.Approvals.Add(approval);

        run.Status = WorkflowStatus.Approved;
        run.CompletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await _workflowStateService.LogAuditAsync(
            "WorkflowRun",
            run.Id,
            "APPROVED",
            approval.ApproverUserId,
            JsonSerializer.Serialize(new { decisionNotes = request.DecisionNotes }),
            ct);

        // Find linked transfer request and transition it internally from Requested -> Approved
        var transfer = await _dbContext.TransferRequests
            .FirstOrDefaultAsync(t => t.WorkflowRunId == run.Id, ct);

        if (transfer != null)
        {
            _logger.LogInformation("Transitioning linked transfer {TransferNumber} to Approved status", transfer.TransferNumber);
            var transferResult = await _transferService.ApproveTransferInternalAsync(
                transfer.Id,
                approval.ApproverUserId,
                request.DecisionNotes,
                ct);

            if (!transferResult.Success)
            {
                _logger.LogWarning("Transfer approval transition warning: {Message}", transferResult.Message);
            }
        }

        return ApiResponse<WorkflowResponse>.Ok(WorkflowService.MapToResponse(run), "Workflow run approved and linked transfer updated successfully.");
    }

    public async Task<ApiResponse<WorkflowResponse>> RejectAsync(
        Guid workflowRunId,
        ApprovalRequest request,
        CancellationToken ct = default)
    {
        var run = await _dbContext.WorkflowRuns
            .Include(w => w.Steps)
            .Include(w => w.AgentExecutions).ThenInclude(ae => ae.ToolExecutions)
            .Include(w => w.ValidationResults)
            .Include(w => w.Approvals)
            .FirstOrDefaultAsync(w => w.Id == workflowRunId, ct);

        if (run == null)
        {
            return ApiResponse<WorkflowResponse>.Fail($"Workflow run {workflowRunId} not found.");
        }

        var approval = new Approval
        {
            Id = Guid.NewGuid(),
            WorkflowRunId = run.Id,
            ApproverUserId = request.ApproverUserId != Guid.Empty ? request.ApproverUserId : Constants.SystemUsers.DefaultTestUserId,
            Status = WorkflowStatus.Rejected,
            DecisionNotes = request.DecisionNotes ?? "Workflow rejected by manager.",
            DecidedAt = DateTime.UtcNow
        };

        _dbContext.Approvals.Add(approval);

        run.Status = WorkflowStatus.Rejected;
        run.CompletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await _workflowStateService.LogAuditAsync(
            "WorkflowRun",
            run.Id,
            "REJECTED",
            approval.ApproverUserId,
            JsonSerializer.Serialize(new { decisionNotes = request.DecisionNotes }),
            ct);

        // Find linked transfer request and transition it internally to Rejected
        var transfer = await _dbContext.TransferRequests
            .FirstOrDefaultAsync(t => t.WorkflowRunId == run.Id, ct);

        if (transfer != null)
        {
            _logger.LogInformation("Transitioning linked transfer {TransferNumber} to Rejected status", transfer.TransferNumber);
            var transferResult = await _transferService.RejectTransferInternalAsync(
                transfer.Id,
                approval.ApproverUserId,
                request.DecisionNotes ?? "Rejected by manager",
                ct);

            if (!transferResult.Success)
            {
                _logger.LogWarning("Transfer rejection transition warning: {Message}", transferResult.Message);
            }
        }

        return ApiResponse<WorkflowResponse>.Ok(WorkflowService.MapToResponse(run), "Workflow run rejected and linked transfer updated successfully.");
    }
}
