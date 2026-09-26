using System;
using System.Collections.Generic;
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

public class WorkflowService : IWorkflowService
{
    private readonly MediStockDbContext _dbContext;
    private readonly IAgentGateway _agentGateway;
    private readonly IWorkflowStateService _workflowStateService;
    private readonly ITransferService _transferService;
    private readonly ILogger<WorkflowService> _logger;

    public WorkflowService(
        MediStockDbContext dbContext,
        IAgentGateway agentGateway,
        IWorkflowStateService workflowStateService,
        ITransferService transferService,
        ILogger<WorkflowService> logger)
    {
        _dbContext = dbContext;
        _agentGateway = agentGateway;
        _workflowStateService = workflowStateService;
        _transferService = transferService;
        _logger = logger;
    }

    public async Task<ApiResponse<WorkflowResponse>> StartPlanningWorkflowAsync(
        StartWorkflowRequest request,
        CancellationToken ct = default)
    {
        var contextJson = JsonSerializer.Serialize(new
        {
            transferRequestId = request.TransferRequestId,
            destinationFacilityId = request.DestinationFacilityId,
            medicineId = request.MedicineId,
            shortageQuantity = request.ShortageQuantity,
            additionalContext = request.AdditionalContext
        });

        // 1. Create WorkflowRun in Running status
        var run = await _workflowStateService.CreateRunAsync(
            "RedistributionPlanning",
            request.InitiatorUserId != Guid.Empty ? request.InitiatorUserId : Constants.SystemUsers.DefaultTestUserId,
            contextJson,
            ct);

        // Attach workflow run to transfer request if specified
        if (request.TransferRequestId != Guid.Empty)
        {
            await _transferService.AttachWorkflowRunInternalAsync(request.TransferRequestId, run.Id, ct);
        }

        // Step 1: Detect Shortage & Context Setup
        var step1 = await _workflowStateService.AddStepAsync(
            run.Id, 1, "Detect Shortage & Initialize Context",
            JsonSerializer.Serialize(new { destinationFacilityId = request.DestinationFacilityId, medicineId = request.MedicineId, shortageQuantity = request.ShortageQuantity }),
            ct);
        await _workflowStateService.CompleteStepAsync(step1.Id, WorkflowStatus.Completed, JsonSerializer.Serialize(new { status = "Shortage context initialized" }), ct);

        // Step 2: Agent Execution (Surplus Query + Distance Calculation + Proposal Generation)
        var step2 = await _workflowStateService.AddStepAsync(
            run.Id, 2, "Agentic Candidate & Route Analysis",
            JsonSerializer.Serialize(new { agentName = "RedistributionPlanningAgent" }),
            ct);

        var agentRequest = new AgentPlanningRequest(
            run.Id,
            request.DestinationFacilityId,
            request.MedicineId,
            request.ShortageQuantity,
            request.AdditionalContext);

        var agentResult = await _agentGateway.RunRedistributionPlanningAgentAsync(agentRequest, ct);

        // Record AgentExecution and ToolExecutions
        var agentExec = new AgentExecution
        {
            Id = Guid.NewGuid(),
            WorkflowRunId = run.Id,
            AgentName = "RedistributionPlanningAgent",
            PromptTokens = agentResult.PromptTokens,
            CompletionTokens = agentResult.CompletionTokens,
            ExecutionTimeMs = agentResult.ExecutionTimeMs,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var tc in agentResult.ToolCalls)
        {
            agentExec.ToolExecutions.Add(new ToolExecution
            {
                Id = Guid.NewGuid(),
                AgentExecutionId = agentExec.Id,
                ToolName = tc.ToolName,
                InputParametersJson = tc.InputJson,
                OutputResultJson = tc.OutputJson,
                DurationMs = tc.DurationMs,
                Success = tc.Success,
                ExecutedAt = DateTime.UtcNow
            });
        }

        _dbContext.AgentExecutions.Add(agentExec);
        await _dbContext.SaveChangesAsync(ct);

        if (!agentResult.Success || agentResult.SelectedFacilityId == null)
        {
            await _workflowStateService.CompleteStepAsync(
                step2.Id, WorkflowStatus.Failed,
                JsonSerializer.Serialize(new { error = agentResult.ErrorMessage ?? "No viable candidate facility found." }),
                ct);

            await _workflowStateService.UpdateRunStatusAsync(run.Id, WorkflowStatus.Failed, ct);

            return ApiResponse<WorkflowResponse>.Fail(
                $"Planning workflow failed: {agentResult.ErrorMessage ?? "No candidate facility with surplus available."}");
        }

        await _workflowStateService.CompleteStepAsync(
            step2.Id, WorkflowStatus.Completed,
            JsonSerializer.Serialize(new
            {
                selectedFacilityId = agentResult.SelectedFacilityId,
                selectedFacilityName = agentResult.SelectedFacilityName,
                proposedQuantity = agentResult.ProposedQuantity,
                distanceKm = agentResult.DistanceKm,
                reasoning = agentResult.Reasoning
            }),
            ct);

        // Step 3: Authoritative Deterministic Business Rule Validation
        var step3 = await _workflowStateService.AddStepAsync(run.Id, 3, "Deterministic Business Rule Validation", null, ct);

        var val1 = new ValidationResult
        {
            Id = Guid.NewGuid(),
            WorkflowRunId = run.Id,
            RuleName = "CheckPositiveSurplusAvailability",
            IsValid = agentResult.ProposedQuantity > 0,
            ValidationDetailsJson = JsonSerializer.Serialize(new { proposedQuantity = agentResult.ProposedQuantity }),
            CheckedAt = DateTime.UtcNow
        };

        var val2 = new ValidationResult
        {
            Id = Guid.NewGuid(),
            WorkflowRunId = run.Id,
            RuleName = "CheckProximityBoundaryLimit",
            IsValid = agentResult.DistanceKm <= 500, // Max regional transfer limit
            ValidationDetailsJson = JsonSerializer.Serialize(new { distanceKm = agentResult.DistanceKm, maxAllowedKm = 500 }),
            CheckedAt = DateTime.UtcNow
        };

        _dbContext.ValidationResults.AddRange(val1, val2);
        await _dbContext.SaveChangesAsync(ct);

        await _workflowStateService.CompleteStepAsync(
            step3.Id, WorkflowStatus.Completed,
            JsonSerializer.Serialize(new { rule1 = val1.IsValid, rule2 = val2.IsValid }),
            ct);

        // Step 4: Update Transfer Request to Proposed (if transfer specified)
        if (request.TransferRequestId != Guid.Empty)
        {
            await _transferService.ProposeCandidateInternalAsync(
                request.TransferRequestId,
                agentResult.SelectedFacilityId.Value,
                request.InitiatorUserId != Guid.Empty ? request.InitiatorUserId : Constants.SystemUsers.DefaultTestUserId,
                ct);
        }

        // Step 5: Await Human Management Approval
        var step4 = await _workflowStateService.AddStepAsync(
            run.Id, 4, "Awaiting Human-in-the-Loop Management Approval",
            JsonSerializer.Serialize(new { prompt = "Proposal ready for facility manager sign-off." }),
            ct);

        await _workflowStateService.UpdateRunStatusAsync(run.Id, WorkflowStatus.WaitingForApproval, ct);

        var updatedRun = await GetWorkflowRunByIdAsync(run.Id, ct);
        return ApiResponse<WorkflowResponse>.Ok(updatedRun!, "Redistribution planning completed. Proposal generated and awaiting human manager approval.");
    }

    public async Task<WorkflowResponse?> GetWorkflowRunByIdAsync(Guid id, CancellationToken ct = default)
    {
        var run = await _dbContext.WorkflowRuns
            .AsNoTracking()
            .Include(w => w.Steps.OrderBy(s => s.StepNumber))
            .Include(w => w.AgentExecutions).ThenInclude(ae => ae.ToolExecutions)
            .Include(w => w.ValidationResults)
            .Include(w => w.Approvals)
            .FirstOrDefaultAsync(w => w.Id == id, ct);

        return run == null ? null : MapToResponse(run);
    }

    public async Task<List<AuditLog>> GetWorkflowAuditLogsAsync(Guid id, CancellationToken ct = default)
    {
        return await _workflowStateService.GetAuditLogsAsync("WorkflowRun", id, ct);
    }

    public static WorkflowResponse MapToResponse(WorkflowRun run)
    {
        return new WorkflowResponse
        {
            Id = run.Id,
            WorkflowType = run.WorkflowType,
            Status = run.Status,
            InitiatorUserId = run.InitiatorUserId,
            ContextJson = run.ContextJson,
            StartedAt = run.StartedAt,
            CompletedAt = run.CompletedAt,
            Steps = run.Steps.Select(s => new WorkflowStepResponse
            {
                Id = s.Id,
                StepNumber = s.StepNumber,
                StepName = s.StepName,
                Status = s.Status,
                InputJson = s.InputJson,
                OutputJson = s.OutputJson,
                ExecutedAt = s.ExecutedAt
            }).ToList(),
            AgentExecutions = run.AgentExecutions.Select(ae => new AgentExecutionSummaryDto
            {
                Id = ae.Id,
                AgentName = ae.AgentName,
                PromptTokens = ae.PromptTokens,
                CompletionTokens = ae.CompletionTokens,
                ExecutionTimeMs = ae.ExecutionTimeMs,
                ToolExecutions = ae.ToolExecutions.Select(te => new ToolExecutionSummaryDto
                {
                    Id = te.Id,
                    ToolName = te.ToolName,
                    InputParametersJson = te.InputParametersJson,
                    OutputResultJson = te.OutputResultJson,
                    DurationMs = te.DurationMs,
                    Success = te.Success
                }).ToList()
            }).ToList(),
            ValidationResults = run.ValidationResults.Select(vr => new ValidationResultSummaryDto
            {
                Id = vr.Id,
                RuleName = vr.RuleName,
                IsValid = vr.IsValid,
                ValidationDetailsJson = vr.ValidationDetailsJson,
                CheckedAt = vr.CheckedAt
            }).ToList(),
            Approvals = run.Approvals.Select(ap => new ApprovalSummaryDto
            {
                Id = ap.Id,
                ApproverUserId = ap.ApproverUserId,
                Status = ap.Status,
                DecisionNotes = ap.DecisionNotes,
                DecidedAt = ap.DecidedAt
            }).ToList()
        };
    }
}
