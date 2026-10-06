using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Hubs;
using MediStock.Api.Features.Redistribution.Models;

namespace MediStock.Api.Features.Redistribution.Services;

public class OfficerAssignmentService : IOfficerAssignmentService
{
    private readonly MediStockDbContext _dbContext;
    private readonly IHubContext<TransferHub, ITransferHubClient> _hubContext;
    private readonly ILogger<OfficerAssignmentService> _logger;

    public OfficerAssignmentService(
        MediStockDbContext dbContext,
        IHubContext<TransferHub, ITransferHubClient> hubContext,
        ILogger<OfficerAssignmentService> logger)
    {
        _dbContext = dbContext;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<ApiResponse<TransferResponse>> AssignOfficerAsync(
        Guid transferId,
        Guid? preferredOfficerId = null,
        CancellationToken ct = default)
    {
        _dbContext.ChangeTracker.Clear();
        var transfer = await _dbContext.TransferRequests
            .Include(t => t.SourceFacility)
            .Include(t => t.DestinationFacility)
            .Include(t => t.Items)
            .Include(t => t.StatusHistory)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
        {
            return ApiResponse<TransferResponse>.Fail($"Transfer request {transferId} not found.");
        }

        var officerId = preferredOfficerId ?? Guid.Parse("22222222-2222-2222-2222-222222222222");

        transfer.AssignedOfficerId = officerId;
        transfer.AssignedAt = DateTime.UtcNow;
        transfer.Status = TransferStatus.Assigned;
        transfer.UpdatedAt = DateTime.UtcNow;

        transfer.StatusHistory.Add(new TransferStatusHistory
        {
            Id = Guid.NewGuid(),
            TransferRequestId = transfer.Id,
            FromStatus = TransferStatus.Approved,
            ToStatus = TransferStatus.Assigned,
            ChangedByUserId = officerId,
            Reason = $"Assigned to field officer {officerId}",
            ChangedAt = DateTime.UtcNow
        });

        // Persist notification for field officer
        var firstItem = transfer.Items.FirstOrDefault();
        var medicineName = firstItem?.MedicineName ?? "Medicine";
        var pickupName = transfer.SourceFacility?.Name ?? "Source Facility";
        var deliveryName = transfer.DestinationFacility?.Name ?? "Destination Facility";
        var distanceKm = transfer.EstimatedDistanceKm ?? 0m;

        var notification = new TransferNotification
        {
            Id = Guid.NewGuid(),
            TransferId = transfer.Id,
            Audience = "FieldOfficer",
            RecipientUserId = officerId,
            Title = "New delivery task",
            Message = $"{medicineName} from {pickupName} to {deliveryName}, {distanceKm} km",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.TransferNotifications.Add(notification);
        try
        {
            await _dbContext.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save officer assignment for transfer {TransferId}: {Message}", transferId, ex.Message);
            throw;
        }

        // Broadcast to officer SignalR group
        var response = TransferService.MapToResponse(transfer);
        var groupName = TransferHub.GetOfficerGroupName(officerId.ToString());

        await _hubContext.Clients.Group(groupName).TaskAssigned(response);
        _logger.LogInformation("Broadcasting TaskAssigned for transfer {TransferNumber} to officer group {GroupName}", transfer.TransferNumber, groupName);

        return ApiResponse<TransferResponse>.Ok(response, "Transfer assigned to officer successfully.");
    }
}
