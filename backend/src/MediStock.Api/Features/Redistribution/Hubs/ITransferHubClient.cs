using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Hubs;

/// <summary>
/// Strongly-typed client callback contract for TransferHub
/// </summary>
public interface ITransferHubClient
{
    /// <summary>
    /// Broadcast when any transfer request status changes or route/inventory is updated.
    /// </summary>
    Task TransferStatusChanged(TransferResponse transfer);

    /// <summary>
    /// Broadcast when a live GPS location update is received for an in-transit transfer.
    /// </summary>
    Task TransferLocationUpdated(TransferLocationUpdateDto location);

    /// <summary>
    /// Broadcast when a new in-app notification is created for a transfer.
    /// </summary>
    Task NotificationCreated(TransferNotificationResponse notification);
}
