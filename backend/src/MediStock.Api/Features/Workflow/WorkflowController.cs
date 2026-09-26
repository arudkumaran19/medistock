using System;
using System.Collections.Generic;
using System.Net.Mime;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MediStock.Api.Common;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Models;
using MediStock.Api.Features.Workflow.Services;

namespace MediStock.Api.Features.Workflow;

[ApiController]
[Route("api/workflow/runs")]
[Produces(MediaTypeNames.Application.Json)]
public class WorkflowController : ControllerBase
{
    private readonly IWorkflowService _workflowService;
    private readonly IApprovalService _approvalService;

    public WorkflowController(
        IWorkflowService workflowService,
        IApprovalService approvalService)
    {
        _workflowService = workflowService;
        _approvalService = approvalService;
    }

    /// <summary>
    /// Start a new Redistribution Planning Workflow Run
    /// </summary>
    [HttpPost]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<WorkflowResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StartWorkflow([FromBody] StartWorkflowRequest request, CancellationToken ct = default)
    {
        if (request.InitiatorUserId == Guid.Empty)
        {
            request.InitiatorUserId = GetCurrentUserId();
        }

        var result = await _workflowService.StartPlanningWorkflowAsync(request, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "WORKFLOW_START_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// Get details of a workflow run including steps, agent executions, and validations
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<WorkflowResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWorkflowRun([FromRoute] Guid id, CancellationToken ct = default)
    {
        var run = await _workflowService.GetWorkflowRunByIdAsync(id, ct);
        if (run == null)
        {
            return NotFound(new ErrorResponse($"Workflow run {id} not found.", "NOT_FOUND"));
        }

        return Ok(ApiResponse<WorkflowResponse>.Ok(run));
    }

    /// <summary>
    /// Human Manager Approval for proposed transfer workflow
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<WorkflowResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ApproveWorkflow(
        [FromRoute] Guid id,
        [FromBody] ApprovalRequest request,
        CancellationToken ct = default)
    {
        if (request.ApproverUserId == Guid.Empty)
        {
            request.ApproverUserId = GetCurrentUserId();
        }

        var result = await _approvalService.ApproveAsync(id, request, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "APPROVAL_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// Human Manager Rejection for proposed transfer workflow
    /// </summary>
    [HttpPost("{id:guid}/reject")]
    [Consumes(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(ApiResponse<WorkflowResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RejectWorkflow(
        [FromRoute] Guid id,
        [FromBody] ApprovalRequest request,
        CancellationToken ct = default)
    {
        if (request.ApproverUserId == Guid.Empty)
        {
            request.ApproverUserId = GetCurrentUserId();
        }

        var result = await _approvalService.RejectAsync(id, request, ct);
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse(result.Message, "REJECTION_FAILED", result.Errors));
        }

        return Ok(result);
    }

    /// <summary>
    /// Retrieve audit logs for a specific workflow run
    /// </summary>
    [HttpGet("{id:guid}/audit")]
    [ProducesResponseType(typeof(ApiResponse<List<AuditLog>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditLogs([FromRoute] Guid id, CancellationToken ct = default)
    {
        var logs = await _workflowService.GetWorkflowAuditLogsAsync(id, ct);
        return Ok(ApiResponse<List<AuditLog>>.Ok(logs));
    }

    private Guid GetCurrentUserId()
    {
        var subClaim = User?.FindFirst("sub")?.Value ?? User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(subClaim) && Guid.TryParse(subClaim, out var parsedGuid))
        {
            return parsedGuid;
        }

        return Constants.SystemUsers.DefaultTestUserId;
    }
}
