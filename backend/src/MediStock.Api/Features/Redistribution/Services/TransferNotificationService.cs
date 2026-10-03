using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Hubs;

namespace MediStock.Api.Features.Redistribution.Services;

/// <summary>
/// Broadcasts real-time redistribution updates via SignalR TransferHub
/// </summary>
public class TransferNotificationService : ITransferNotificationService
{
    private readonly IHubContext<TransferHub, ITransferHubClient> _hubContext;
    private readonly ILogger<TransferNotificationService> _logger;

    public TransferNotificationService(
        IHubContext<TransferHub, ITransferHubClient> hubContext,
        ILogger<TransferNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task BroadcastStatusChangedAsync(TransferResponse transfer, CancellationToken ct = default)
    {
        if (transfer == null) return;

        var transferGroupName = TransferHub.GetTransferGroupName(transfer.Id.ToString());

        try
        {
            _logger.LogInformation("Broadcasting TransferStatusChanged for transfer {TransferId} ({TransferNumber}) -> Status: {Status}",
                transfer.Id, transfer.TransferNumber, transfer.Status);

            // 1. Send to the transfer-specific group (e.g. mobile tracking screen)
            await _hubContext.Clients.Group(transferGroupName).TransferStatusChanged(transfer);

            // 2. Send to the managers group (e.g. React web portal live monitoring)
            await _hubContext.Clients.Group("managers").TransferStatusChanged(transfer);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast TransferStatusChanged for transfer {TransferId} over SignalR", transfer.Id);
        }
    }

    public async Task BroadcastLocationUpdatedAsync(TransferLocationUpdateDto location, CancellationToken ct = default)
    {
        if (location == null) return;

        var transferGroupName = TransferHub.GetTransferGroupName(location.TransferId.ToString());

        try
        {
            // Send to transfer group and managers group
            await _hubContext.Clients.Group(transferGroupName).TransferLocationUpdated(location);
            await _hubContext.Clients.Group("managers").TransferLocationUpdated(location);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast TransferLocationUpdated for transfer {TransferId} over SignalR", location.TransferId);
        }
    }

    public async Task BroadcastNotificationCreatedAsync(TransferNotificationResponse notification, CancellationToken ct = default)
    {
        if (notification == null) return;

        var transferGroupName = TransferHub.GetTransferGroupName(notification.TransferId.ToString());

        try
        {
            _logger.LogInformation("Broadcasting NotificationCreated for transfer {TransferId}, audience {Audience}: {Title}",
                notification.TransferId, notification.Audience, notification.Title);

            // Broadcast to the transfer group (for field officer) and managers group
            await _hubContext.Clients.Group(transferGroupName).NotificationCreated(notification);
            await _hubContext.Clients.Group("managers").NotificationCreated(notification);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast NotificationCreated for transfer {TransferId} over SignalR", notification.TransferId);
        }
    }
}
