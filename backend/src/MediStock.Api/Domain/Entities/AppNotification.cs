namespace MediStock.Api.Domain.Entities;

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

/// <summary>
/// Persisted in-app notification for shortage alerts, approvals, and workflow events.
/// Scoped by user, role, and facility to enforce RBAC and hospital tenant isolation.
/// </summary>
[Table("AppNotifications")]
public class AppNotification
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Target specific user. If null, applies to any user with the matching role and facility.</summary>
    public string? UserId { get; set; }

    /// <summary>Target facility. If null, global/all facilities (e.g. for Admin).</summary>
    public Guid? FacilityId { get; set; }

    /// <summary>Target role (e.g. FacilityManager, StoreOfficer, Admin).</summary>
    public string? Role { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string Message { get; set; } = string.Empty;

    /// <summary>HIGH, MEDIUM, LOW, or INFO.</summary>
    [Required]
    [MaxLength(50)]
    public string Severity { get; set; } = "INFO";

    /// <summary>Deep-link navigation URL (e.g. /demand/shortages/{alertId}).</summary>
    [MaxLength(500)]
    public string? LinkUrl { get; set; }

    /// <summary>Associated shortage alert ID if applicable (used for deduplication on scans).</summary>
    public Guid? ShortageAlertId { get; set; }

    public bool IsRead { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ReadAtUtc { get; set; }
}
