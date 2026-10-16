namespace MediStock.Api.Features.Notifications.Services;

using MediStock.Api.Domain.Entities;

public interface INotificationService
{
    Task<AppNotification?> CreateNotificationAsync(
        string title,
        string message,
        string severity,
        string? linkUrl = null,
        Guid? shortageAlertId = null,
        Guid? facilityId = null,
        string? role = null,
        string? userId = null,
        CancellationToken cancellationToken = default);

    Task NotifyShortageAlertAsync(
        Guid shortageAlertId,
        Guid facilityId,
        Guid medicineId,
        string? facilityName,
        string? medicineName,
        decimal currentStock,
        int? daysRemaining,
        string riskLevel,
        bool isNew,
        CancellationToken cancellationToken = default);

    Task<List<AppNotification>> GetNotificationsAsync(
        string? userId,
        string? role,
        Guid? facilityId,
        bool unreadOnly = false,
        int limit = 50,
        CancellationToken cancellationToken = default);

    Task<int> GetUnreadCountAsync(
        string? userId,
        string? role,
        Guid? facilityId,
        CancellationToken cancellationToken = default);

    Task<bool> MarkAsReadAsync(
        Guid notificationId,
        string? userId = null,
        CancellationToken cancellationToken = default);

    Task<int> MarkAllAsReadAsync(
        string? userId,
        string? role,
        Guid? facilityId,
        CancellationToken cancellationToken = default);
}
