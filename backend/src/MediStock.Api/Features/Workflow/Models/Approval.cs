using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.Models;

public sealed class Approval
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkflowRunId { get; set; }

    public WorkflowRun? WorkflowRun { get; set; }

    public string ApprovalType { get; set; } = "ManagerApproval"; // PurchaseOrderApproval, StockTransferApproval, etc.

    public string RequiredRole { get; set; } = MediStock.Api.Common.Constants.Roles.FacilityManager;

    public ApprovalDecision Decision { get; set; } = ApprovalDecision.Pending;

    public Guid? DecidedByUserId { get; set; }

    public string? DecidedByUserName { get; set; }

    public string? Comments { get; set; }

    public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DecidedAt { get; set; }
}
