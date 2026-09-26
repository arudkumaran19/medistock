using System;
using MediStock.Api.Domain.Enums;

namespace MediStock.Api.Features.Workflow.DTOs;

public class WorkflowStepResponse
{
    public Guid Id { get; set; }
    public int StepNumber { get; set; }
    public string StepName { get; set; } = string.Empty;
    public WorkflowStatus Status { get; set; }
    public string? InputJson { get; set; }
    public string? OutputJson { get; set; }
    public DateTime? ExecutedAt { get; set; }
}
