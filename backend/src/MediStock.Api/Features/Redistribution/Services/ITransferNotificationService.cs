using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Services;

/// <summary>
/// Service contract to broadcast real-time redistribution transfer updates over SignalR
/// </summary>
public interface ITransferNotificationService
{
    /// <summary>
    /// Broadcast status transition to the specific transfer group and all subscribed managers
    /// </summary>
    Task BroadcastStatusChangedAsync(TransferResponse transfer, CancellationToken ct = default);

    /// <summary>
    /// Broadcast live GPS location update to the specific transfer group and subscribed managers
    /// </summary>
    Task BroadcastLocationUpdatedAsync(TransferLocationUpdateDto location, CancellationToken ct = default);

    /// <summary>
    /// Broadcast newly created in-app notification to the specific transfer group and managers
    /// </summary>
    Task BroadcastNotificationCreatedAsync(TransferNotificationResponse notification, CancellationToken ct = default);

    /// <summary>
    /// Broadcast task assignment to a specific officer group
    /// </summary>
    Task BroadcastTaskAssignedAsync(string officerId, TransferResponse transfer, CancellationToken ct = default);
}
