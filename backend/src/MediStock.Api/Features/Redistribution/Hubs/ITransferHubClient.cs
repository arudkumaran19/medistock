using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Demand.DTOs;

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

    /// <summary>
    /// Broadcast when a transfer assignment is pushed to a specific field officer.
    /// </summary>
    Task TaskAssigned(TransferResponse transfer);

    /// <summary>
    /// Broadcast when a shortage alert is raised for a facility.
    /// </summary>
    Task ShortageAlertCreated(ShortageResponse shortage);

    /// <summary>
    /// Broadcast when a transfer rejection creates a replenishment request for procurement.
    /// </summary>
    Task ReplenishmentRequested(MediStock.Api.Features.Procurement.DTOs.ReplenishmentRequestDto request);
}
