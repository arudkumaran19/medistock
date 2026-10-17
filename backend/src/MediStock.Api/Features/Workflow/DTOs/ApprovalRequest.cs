using System.ComponentModel.DataAnnotations;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.DTOs;

public sealed class ApprovalRequest
{
    [Required]
    public ApprovalDecision Decision { get; set; } = ApprovalDecision.Approved;

    public string? Comments { get; set; }
}
