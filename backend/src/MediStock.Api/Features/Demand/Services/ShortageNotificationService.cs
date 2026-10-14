namespace MediStock.Api.Features.Demand.Services;

using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Data;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Redistribution.Hubs;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Infrastructure.Persistence;

public class ShortageNotificationService
{
    private readonly IHubContext<TransferHub, ITransferHubClient> _hubContext;
    private readonly ApplicationDbContext _appDb;
    private readonly MediStockDbContext _mediStockDb;
    private readonly ILogger<ShortageNotificationService> _logger;

    public ShortageNotificationService(
        IHubContext<TransferHub, ITransferHubClient> hubContext,
        ApplicationDbContext appDb,
        MediStockDbContext mediStockDb,
        ILogger<ShortageNotificationService> logger)
    {
        _hubContext = hubContext;
        _appDb = appDb;
        _mediStockDb = mediStockDb;
        _logger = logger;
    }

    public async Task NotifyShortageAlertCreatedAsync(ShortageResponse shortage, CancellationToken cancellationToken = default)
    {
        try
        {
            // Fetch medicine name
            var medicine = await _appDb.Medicines.AsNoTracking().FirstOrDefaultAsync(m => m.Id == shortage.MedicineId, cancellationToken);
            var medicineName = medicine?.Name ?? shortage.MedicineName ?? "Medicine";
            shortage.MedicineName = medicineName;

            var facility = await _appDb.Facilities.AsNoTracking().FirstOrDefaultAsync(f => f.Id == shortage.FacilityId, cancellationToken);
            if (facility != null)
            {
                shortage.FacilityName = facility.Name;
            }

            var facilityGroup = TransferHub.GetFacilityGroupName(shortage.FacilityId.ToString());
            await _hubContext.Clients.Group(facilityGroup).ShortageAlertCreated(shortage);
            await _hubContext.Clients.Group("all_facility_users").ShortageAlertCreated(shortage);
            await _hubContext.Clients.Group("managers").ShortageAlertCreated(shortage);
            _logger.LogInformation("Broadcasted ShortageAlertCreated to all_facility_users, {Group}, and managers for alert {AlertId}", facilityGroup, shortage.Id);

            // Fetch facility user ID for recipient
            var userFacility = await _appDb.UserFacilities.AsNoTracking().FirstOrDefaultAsync(uf => uf.FacilityId == shortage.FacilityId, cancellationToken);
            var recipientUserId = userFacility?.UserId;

            var notification = new TransferNotification
            {
                Id = Guid.NewGuid(),
                TransferId = null,
                Audience = "FacilityUser",
                RecipientUserId = recipientUserId,
                Title = $"Shortage detected: {medicineName}",
                Message = $"{shortage.DaysRemaining ?? 0} days of cover remaining",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _mediStockDb.TransferNotifications.Add(notification);
            await _mediStockDb.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Created TransferNotification {NotificationId} for shortage alert {AlertId}", notification.Id, shortage.Id);

            var notificationResponse = new MediStock.Api.Features.Redistribution.DTOs.TransferNotificationResponse
            {
                Id = notification.Id,
                TransferId = notification.TransferId,
                Title = notification.Title,
                Message = notification.Message,
                Audience = notification.Audience,
                RecipientUserId = notification.RecipientUserId,
                IsRead = notification.IsRead,
                CreatedAt = notification.CreatedAt
            };

            await _hubContext.Clients.Group("all_facility_users").NotificationCreated(notificationResponse);
            await _hubContext.Clients.Group("managers").NotificationCreated(notificationResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending shortage alert notification for alert {AlertId}", shortage.Id);
        }
    }
}
