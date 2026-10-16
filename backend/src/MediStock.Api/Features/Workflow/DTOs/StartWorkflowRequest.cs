using System.ComponentModel.DataAnnotations;

namespace MediStock.Api.Features.Workflow.DTOs;

public sealed class StartWorkflowRequest
{
    [Required]
    public string Objective { get; set; } = string.Empty;

    public string WorkflowType { get; set; } = string.Empty;

    public Guid? FacilityId { get; set; }

    public Guid? MedicineId { get; set; }

    public Dictionary<string, object>? Parameters { get; set; }

    /// <summary>Frontend chat session ID – used to group workflow runs by conversation.</summary>
    public string? SessionId { get; set; }

    /// <summary>Frontend message ID that triggered this workflow – links the workflow to a specific chat turn.</summary>
    public string? MessageId { get; set; }
}
