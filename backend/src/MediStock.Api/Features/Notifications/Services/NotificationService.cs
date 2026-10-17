namespace MediStock.Api.Features.Notifications.Services;

using MediStock.Api.Domain.Entities;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

public class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(ApplicationDbContext db, ILogger<NotificationService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<AppNotification?> CreateNotificationAsync(
        string title,
        string message,
        string severity,
        string? linkUrl = null,
        Guid? shortageAlertId = null,
        Guid? facilityId = null,
        string? role = null,
        string? userId = null,
        CancellationToken cancellationToken = default)
    {
        // Deduplication: if an unread notification already exists for this shortage alert, do not duplicate
        if (shortageAlertId.HasValue)
        {
            var existingUnread = await _db.AppNotifications
                .AsNoTracking()
                .AnyAsync(n => n.ShortageAlertId == shortageAlertId.Value && !n.IsRead, cancellationToken);

            if (existingUnread)
            {
                _logger.LogInformation(
                    "Skipping duplicate unread notification for ShortageAlert {ShortageAlertId}",
                    shortageAlertId.Value);
                return null;
            }
        }

        var notification = new AppNotification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FacilityId = facilityId,
            Role = role,
            Title = title,
            Message = message,
            Severity = string.IsNullOrWhiteSpace(severity) ? "INFO" : severity.ToUpperInvariant(),
            LinkUrl = linkUrl,
            ShortageAlertId = shortageAlertId,
            IsRead = false,
            CreatedAtUtc = DateTime.UtcNow,
        };

        _db.AppNotifications.Add(notification);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Notification created: {Title} for Facility {FacilityId}, Role {Role}, ShortageAlertId {ShortageAlertId}",
            title, facilityId, role, shortageAlertId);

        return notification;
    }

    public async Task NotifyShortageAlertAsync(
        Guid shortageAlertId,
        Guid facilityId,
        Guid medicineId,
        string? facilityName,
        string? medicineName,
        decimal currentStock,
        int? daysRemaining,
        string riskLevel,
        bool isNew,
        CancellationToken cancellationToken = default)
    {
        var medLabel = !string.IsNullOrWhiteSpace(medicineName) ? medicineName : medicineId.ToString();
        var facLabel = !string.IsNullOrWhiteSpace(facilityName) ? facilityName : facilityId.ToString();
        var coverStr = daysRemaining.HasValue ? $"{daysRemaining.Value} days of cover" : "no consumption recorded";

        var actionWord = isNew ? "raised" : "refreshed";
        var title = $"{riskLevel} Shortage Alert: {medLabel}";
        var message = $"{facLabel}: {currentStock:0.##} units remaining ({coverStr}). Alert {actionWord} for review.";
        var linkUrl = $"/demand/shortages/{shortageAlertId}";

        await CreateNotificationAsync(
            title: title,
            message: message,
            severity: riskLevel,
            linkUrl: linkUrl,
            shortageAlertId: shortageAlertId,
            facilityId: facilityId,
            role: "FacilityManager",
            userId: null,
            cancellationToken: cancellationToken);
    }

    public async Task<List<AppNotification>> GetNotificationsAsync(
        string? userId,
        string? role,
        Guid? facilityId,
        bool unreadOnly = false,
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var query = BuildScopedQuery(userId, role, facilityId);

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        return await query
            .OrderByDescending(n => n.CreatedAtUtc)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetUnreadCountAsync(
        string? userId,
        string? role,
        Guid? facilityId,
        CancellationToken cancellationToken = default)
    {
        var query = BuildScopedQuery(userId, role, facilityId);
        return await query.CountAsync(n => !n.IsRead, cancellationToken);
    }

    public async Task<bool> MarkAsReadAsync(
        Guid notificationId,
        string? userId = null,
        CancellationToken cancellationToken = default)
    {
        var notification = await _db.AppNotifications
            .FirstOrDefaultAsync(n => n.Id == notificationId, cancellationToken);

        if (notification == null)
        {
            return false;
        }

        notification.IsRead = true;
        notification.ReadAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<int> MarkAllAsReadAsync(
        string? userId,
        string? role,
        Guid? facilityId,
        CancellationToken cancellationToken = default)
    {
        var unread = await BuildScopedQuery(userId, role, facilityId, asNoTracking: false)
            .Where(n => !n.IsRead)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0)
        {
            return 0;
        }

        var now = DateTime.UtcNow;
        foreach (var item in unread)
        {
            item.IsRead = true;
            item.ReadAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return unread.Count;
    }

    private IQueryable<AppNotification> BuildScopedQuery(string? userId, string? role, Guid? facilityId, bool asNoTracking = true)
    {
        var query = asNoTracking
            ? _db.AppNotifications.AsNoTracking().AsQueryable()
            : _db.AppNotifications.AsQueryable();

        var isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
                      string.Equals(role, "Administrator", StringComparison.OrdinalIgnoreCase);

        if (isAdmin)
        {
            // Admins see all notifications, or filter by facility if explicitly queried
            if (facilityId.HasValue)
            {
                query = query.Where(n => n.FacilityId == null || n.FacilityId == facilityId.Value);
            }
            return query;
        }

        // Standard RBAC scoping
        query = query.Where(n =>
            (n.UserId == null || n.UserId == userId) &&
            (n.FacilityId == null || !facilityId.HasValue || n.FacilityId == facilityId.Value) &&
            (n.Role == null || n.Role == role || n.Role == "FacilityManager"));

        return query;
    }
}
