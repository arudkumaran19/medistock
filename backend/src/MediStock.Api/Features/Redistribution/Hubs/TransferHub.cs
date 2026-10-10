using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Hubs;

/// <summary>
/// SignalR Hub for real-time live transfer tracking, status notifications, and location updates.
/// </summary>
[Authorize]
public class TransferHub : Hub<ITransferHubClient>
{
    private readonly ILogger<TransferHub> _logger;

    public TransferHub(ILogger<TransferHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Join real-time notification group for a specific transfer request.
    /// Used by field officer and facility user to track their specific delivery.
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

    /// <summary>
    /// Join officer notification group to receive task assignments.
    /// </summary>
    public async Task JoinOfficerGroup()
    {
        var officerId = Context.UserIdentifier ?? Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrWhiteSpace(officerId))
            throw new HubException("Unauthenticated officer");

        var groupName = GetOfficerGroupName(officerId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Officer {OfficerId} joined officer group {GroupName}", officerId, groupName);
    }

    /// <summary>
    /// Leave officer notification group.
    /// </summary>
    public async Task LeaveOfficerGroup()
    {
        var officerId = Context.UserIdentifier ?? Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrWhiteSpace(officerId))
        {
            var groupName = GetOfficerGroupName(officerId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation("Officer {OfficerId} left officer group {GroupName}", officerId, groupName);
        }
    }

    /// <summary>
    /// Send real-time GPS location update from Field Officer vehicle during transit.
    /// </summary>
    public async Task SendLocationUpdate(string transferId, double latitude, double longitude)
    {
        if (string.IsNullOrWhiteSpace(transferId)) return;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
            throw new HubException("Invalid coordinates");

        var groupName = GetTransferGroupName(transferId);
        await Clients.Group(groupName).TransferLocationUpdated(new TransferLocationUpdateDto
        {
            TransferId = Guid.Parse(transferId),
            Latitude = latitude,
            Longitude = longitude,
            Timestamp = DateTime.UtcNow
        });
        _logger.LogInformation("Location update sent for transfer {TransferId}: ({Lat}, {Lng})", transferId, latitude, longitude);
    }

    public static string GetTransferGroupName(string transferId) => $"transfer_{transferId.ToLowerInvariant()}";
    public static string GetOfficerGroupName(string officerId) => $"officer_{officerId.ToLowerInvariant()}";
    public static string GetFacilityGroupName(string facilityId) => $"facility_{facilityId.ToLowerInvariant()}_users";

    /// <summary>
    /// Join notification group for a specific facility to receive shortage alerts and updates.
    /// </summary>
    public async Task JoinFacilityGroup(string facilityId)
    {
        if (string.IsNullOrWhiteSpace(facilityId)) return;

        var groupName = GetFacilityGroupName(facilityId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} joined facility group {GroupName}", Context.ConnectionId, groupName);
    }

    /// <summary>
    /// Leave facility notification group.
    /// </summary>
    public async Task LeaveFacilityGroup(string facilityId)
    {
        if (string.IsNullOrWhiteSpace(facilityId)) return;

        var groupName = GetFacilityGroupName(facilityId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} left facility group {GroupName}", Context.ConnectionId, groupName);
    }

    /// <summary>
    /// Join procurement group to receive replenishment requests.
    /// </summary>
    public async Task JoinProcurementGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "procurement");
        _logger.LogInformation("Connection {ConnectionId} joined procurement group", Context.ConnectionId);
    }

    /// <summary>
    /// Leave procurement group.
    /// </summary>
    public async Task LeaveProcurementGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "procurement");
        _logger.LogInformation("Connection {ConnectionId} left procurement group", Context.ConnectionId);
    }
}
