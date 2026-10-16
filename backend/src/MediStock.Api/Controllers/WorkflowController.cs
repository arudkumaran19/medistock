using System.Security.Claims;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using System.Text.Json;
using MediStock.Api.Features.Workflow.Models;
using MediStock.Api.Infrastructure.Persistence;

using MediStock.Api.Common.Audit;

namespace MediStock.Api.Controllers;

public sealed record AdminAuditSessionRequest(
    string AuditReason,
    string? JustificationTicket = null);

[ApiController]
[Route("api/workflows")]
[Authorize]
public sealed class WorkflowController : ControllerBase
{
    private readonly IWorkflowService _workflowService;
    private readonly IApprovalService _approvalService;
    private readonly ApplicationDbContext _db;
    private readonly IAuditService _auditService;
    private readonly ILogger<WorkflowController> _logger;

    public WorkflowController(
        IWorkflowService workflowService,
        IApprovalService approvalService,
        ApplicationDbContext db,
        IAuditService auditService,
        ILogger<WorkflowController> logger)
    {
        _workflowService = workflowService;
        _approvalService = approvalService;
        _db = db;
        _auditService = auditService;
        _logger = logger;
    }

    private bool IsAuthorizedForCoordinator()
    {
        if (User.Identity?.IsAuthenticated != true) return false;

        return User.IsInRole(MediStock.Api.Common.Constants.Roles.Admin) ||
               User.IsInRole("Administrator") ||
               User.IsInRole(MediStock.Api.Common.Constants.Roles.FacilityManager) ||
               User.IsInRole("FacilityManager") ||
               User.IsInRole(MediStock.Api.Common.Constants.Roles.StoreOfficer) ||
               User.IsInRole("OperationalStaff") ||
               User.IsInRole("StoreOfficer") ||
               User.IsInRole("StoreOperator") ||
               User.IsInRole(MediStock.Api.Common.Constants.Roles.SupplierOfficer) ||
               User.IsInRole("SupplierOfficer");
    }

    [HttpPost]
    public async Task<ActionResult<WorkflowResponse>> StartWorkflow(
        [FromBody] StartWorkflowRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (!IsAuthorizedForCoordinator())
        {
            await _auditService.LogAsync(
                action: "AI_COORDINATOR_ACCESS_DENIED",
                resourceType: "AI_COORDINATOR",
                resourceId: request.SessionId,
                outcome: "DENIED",
                reason: "Access Denied: The Coordinator console is restricted to authorized healthcare roles.",
                cancellationToken: cancellationToken);

            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "ACCESS_DENIED",
                message = "Access Denied: The Coordinator console is restricted to authorized healthcare roles."
            });
        }

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { code = "INVALID_IDENTITY", message = "A valid user identity is required." });
        }

        // Enforce session ownership: prevent posting to another user's session
        if (!string.IsNullOrWhiteSpace(request.SessionId))
        {
            var existingRuns = await _workflowService.GetWorkflowsBySessionAsync(request.SessionId, null, cancellationToken);
            if (existingRuns.Any(w => w.InitiatedByUserId.HasValue && w.InitiatedByUserId.Value != userId.Value))
            {
                await _auditService.LogAsync(
                    action: "AI_COORDINATOR_ACCESS_DENIED",
                    resourceType: "AI_COORDINATOR",
                    resourceId: request.SessionId,
                    outcome: "DENIED",
                    reason: "Access Denied: Cannot post messages or start workflows in another user's session.",
                    cancellationToken: cancellationToken);

                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    code = "ACCESS_DENIED",
                    message = "Access Denied: Cannot post messages or start workflows in another user's session."
                });
            }
        }

        string userRole = User.IsInRole(MediStock.Api.Common.Constants.Roles.Admin) || User.IsInRole("Administrator")
            ? MediStock.Api.Common.Constants.Roles.Admin
            : User.IsInRole(MediStock.Api.Common.Constants.Roles.FacilityManager) || User.IsInRole("FacilityManager")
            ? MediStock.Api.Common.Constants.Roles.FacilityManager
            : User.IsInRole(MediStock.Api.Common.Constants.Roles.SupplierOfficer) || User.IsInRole("SupplierOfficer")
            ? MediStock.Api.Common.Constants.Roles.SupplierOfficer
            : MediStock.Api.Common.Constants.Roles.StoreOfficer;

        var response = await _workflowService.StartWorkflowAsync(request, userId, userRole, cancellationToken);
        return CreatedAtAction(nameof(GetWorkflow), new { id = response.Id }, response);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkflowResponse>> GetWorkflow(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (!IsAuthorizedForCoordinator())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "ACCESS_DENIED",
                message = "Access Denied: The Coordinator console is restricted to authorized healthcare roles."
            });
        }

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { code = "INVALID_IDENTITY", message = "A valid user identity is required." });
        }

        var response = await _workflowService.GetWorkflowByIdAsync(id, null, cancellationToken);
        if (response is null)
        {
            return NotFound(new { message = $"Workflow with ID '{id}' not found." });
        }

        // Enforce workflow ownership: user cannot view another user's workflow
        if (response.InitiatedByUserId.HasValue && response.InitiatedByUserId.Value != userId.Value)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "ACCESS_DENIED",
                message = "Access Denied: You do not have permission to view another user's workflow run."
            });
        }

        return Ok(response);
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkflowResponse>>> GetActiveWorkflows(
        CancellationToken cancellationToken)
    {
        if (!IsAuthorizedForCoordinator())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "ACCESS_DENIED",
                message = "Access Denied: The Coordinator console is restricted to authorized healthcare roles."
            });
        }

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { code = "INVALID_IDENTITY", message = "A valid user identity is required." });
        }

        var workflows = await _workflowService.GetActiveWorkflowsAsync(userId, cancellationToken);
        return Ok(workflows);
    }

    [HttpGet("session/{sessionId}")]
    public async Task<ActionResult<List<WorkflowResponse>>> GetWorkflowsBySession(
        string sessionId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            return BadRequest(new { message = "sessionId is required." });

        if (!IsAuthorizedForCoordinator())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "ACCESS_DENIED",
                message = "Access Denied: The Coordinator console is restricted to authorized healthcare roles."
            });
        }

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { code = "INVALID_IDENTITY", message = "A valid user identity is required." });
        }

        var allRunsInSession = await _workflowService.GetWorkflowsBySessionAsync(sessionId, null, cancellationToken);
        if (allRunsInSession.Any(w => w.InitiatedByUserId.HasValue && w.InitiatedByUserId.Value != userId.Value))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "ACCESS_DENIED",
                message = "Access Denied: You do not have permission to view another user's chat history."
            });
        }

        var workflows = await _workflowService.GetWorkflowsBySessionAsync(sessionId, userId, cancellationToken);
        return Ok(workflows);
    }

    /// <summary>
    /// Explicitly authorized and audited administrative workflow for conversation review.
    /// Administrator access to conversations is NOT automatic and MUST be explicitly justified and logged.
    /// </summary>
    [HttpPost("admin/audit-session/{sessionId}")]
    [Authorize(Policy = "UserAdministrationAccess")]
    public async Task<ActionResult<List<WorkflowResponse>>> AuditSessionAccess(
        string sessionId,
        [FromBody] AdminAuditSessionRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            return BadRequest(new { message = "sessionId is required." });

        if (string.IsNullOrWhiteSpace(request?.AuditReason) || request.AuditReason.Trim().Length < 10)
        {
            return BadRequest(new
            {
                code = "AUDIT_REASON_REQUIRED",
                message = "An audited justification of at least 10 characters is required for administrative conversation access."
            });
        }

        var adminUserId = GetCurrentUserId();

        // Write immutable audit log entry
        var auditEntry = new AuditLog
        {
            WorkflowRunId = Guid.Empty,
            EventType = "ADMIN_CONVERSATION_AUDIT_ACCESS",
            Description = $"Administrator accessed session '{sessionId}'. Reason: {request.AuditReason.Trim()}",
            DetailsJson = JsonSerializer.Serialize(new
            {
                SessionId = sessionId,
                Reason = request.AuditReason.Trim(),
                Ticket = request.JustificationTicket,
                AdminUserId = adminUserId,
                AccessedAt = DateTimeOffset.UtcNow
            }),
            PerformedByUserId = adminUserId,
            Timestamp = DateTimeOffset.UtcNow
        };

        _db.AuditLogs.Add(auditEntry);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "ADMIN_CONVERSATION_AUDIT_ACCESS",
            resourceType: "AI_COORDINATOR",
            resourceId: sessionId,
            outcome: "SUCCESS",
            reason: request.AuditReason.Trim(),
            details: new
            {
                SessionId = sessionId,
                Ticket = request.JustificationTicket,
                AdminUserId = adminUserId
            },
            cancellationToken: cancellationToken);

        _logger.LogWarning(
            "AUDIT: Administrator {AdminUserId} accessed private conversation history for session {SessionId}. Reason: {Reason}",
            adminUserId, sessionId, request.AuditReason);

        var workflows = await _workflowService.GetWorkflowsBySessionAsync(sessionId, null, cancellationToken);
        return Ok(workflows);
    }

    [HttpGet("approvals/pending")]
    public async Task<ActionResult<List<ApprovalDto>>> GetPendingApprovals(
        [FromQuery] string? requiredRole,
        CancellationToken cancellationToken)
    {
        var approvals = await _approvalService.GetPendingApprovalsAsync(requiredRole, cancellationToken);
        return Ok(approvals);
    }

    [HttpPost("{workflowId:guid}/approvals/{approvalId:guid}")]
    [Authorize(Policy = "ProcurementApprovalAccess")]
    public async Task<ActionResult<ApprovalDto>> SubmitApprovalDecision(
        Guid workflowId,
        Guid approvalId,
        [FromBody] ApprovalRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var userId = GetCurrentUserId() ?? Guid.NewGuid();
        var userName = User.Identity?.Name ?? "Manager";

        var result = await _approvalService.SubmitDecisionAsync(
            approvalId,
            request.Decision,
            request.Comments,
            userId,
            userName,
            cancellationToken);

        if (result is null)
        {
            return NotFound(new { message = $"Approval with ID '{approvalId}' not found." });
        }

        return Ok(result);
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        if (claim is not null && Guid.TryParse(claim.Value, out var guid))
        {
            return guid;
        }
        return null;
    }
}
