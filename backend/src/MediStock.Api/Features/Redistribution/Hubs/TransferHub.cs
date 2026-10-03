using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace MediStock.Api.Features.Redistribution.Hubs;

/// <summary>
/// SignalR Hub for real-time live transfer tracking, status notifications, and location updates.
/// </summary>
public class TransferHub : Hub<ITransferHubClient>
{
    private readonly ILogger<TransferHub> _logger;

    public TransferHub(ILogger<TransferHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Join real-time notification group for a specific transfer request.
    /// Used by field officer to track their specific delivery.
    /// </summary>
    public async Task JoinTransferGroup(string transferId)
    {
        if (string.IsNullOrWhiteSpace(transferId)) return;

        var groupName = GetTransferGroupName(transferId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} joined transfer group {GroupName}", Context.ConnectionId, groupName);
    }

    /// <summary>
    /// Leave real-time notification group for a specific transfer request.
    /// </summary>
    public async Task LeaveTransferGroup(string transferId)
    {
        if (string.IsNullOrWhiteSpace(transferId)) return;

        var groupName = GetTransferGroupName(transferId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} left transfer group {GroupName}", Context.ConnectionId, groupName);
    }

    /// <summary>
    /// Join manager notification group to receive broadcasts for all active transfers.
    /// Used by the React management portal.
    /// </summary>
    public async Task JoinManagerGroup()
    {
        // TODO: enforce roles after auth merge (approve: manager)
        await Groups.AddToGroupAsync(Context.ConnectionId, "managers");
        _logger.LogInformation("Connection {ConnectionId} joined managers group", Context.ConnectionId);
    }

    /// <summary>
    /// Leave manager notification group.
    /// </summary>
    public async Task LeaveManagerGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "managers");
        _logger.LogInformation("Connection {ConnectionId} left managers group", Context.ConnectionId);
    }

    public static string GetTransferGroupName(string transferId) => $"transfer_{transferId.ToLowerInvariant()}";
}
