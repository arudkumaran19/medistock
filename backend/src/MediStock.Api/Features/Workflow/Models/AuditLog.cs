using System;

namespace MediStock.Api.Features.Workflow.Models;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EntityName { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Action { get; set; } = string.Empty; // Create, Update, Delete, Transition, Reserve, Receive
    public Guid UserId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? DetailsJson { get; set; }
}
