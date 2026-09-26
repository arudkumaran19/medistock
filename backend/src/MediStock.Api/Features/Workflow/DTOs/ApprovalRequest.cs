using System;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.DTOs;

public class ApprovalRequest
{
    public Guid ApproverUserId { get; set; }
    public string? DecisionNotes { get; set; }
}
