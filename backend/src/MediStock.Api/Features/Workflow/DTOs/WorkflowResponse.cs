using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.DTOs;

public sealed class ApprovalDto
{
    public Guid Id { get; set; }

    public string ApprovalType { get; set; } = string.Empty;

    public string RequiredRole { get; set; } = string.Empty;

    public ApprovalDecision Decision { get; set; }

    public Guid? DecidedByUserId { get; set; }

    public string? DecidedByUserName { get; set; }

    public string? Comments { get; set; }

    public DateTimeOffset RequestedAt { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }
}

public sealed class WorkflowResponse
{
    public Guid Id { get; set; }

    public string WorkflowType { get; set; } = string.Empty;

    public string Objective { get; set; } = string.Empty;

    public WorkflowStatus Status { get; set; }

    public Guid? FacilityId { get; set; }

    public Guid? MedicineId { get; set; }

    public Guid? InitiatedByUserId { get; set; }

    public bool RequiresApproval { get; set; }

    public string? ErrorMessage { get; set; }

    public string? ResultJson { get; set; }

    public string? SessionId { get; set; }

    public string? MessageId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public List<WorkflowStepResponse> Steps { get; set; } = new();

    public List<ApprovalDto> Approvals { get; set; } = new();
}
