using System;
using System.Linq;
using System.Net.Mime;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Features.Redistribution.Models;

namespace MediStock.Api.Features.Redistribution;

[ApiController]
[Route("api/notifications")]
[Produces(MediaTypeNames.Application.Json)]
public class NotificationController : ControllerBase
{
    private readonly MediStockDbContext _dbContext;

    public NotificationController(MediStockDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// GET /api/notifications - List notifications with optional filtering and pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<TransferNotificationResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] string? audience = null,
        [FromQuery] Guid? transferId = null,
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        // TODO: enforce recipient checks after auth merge
        var query = _dbContext.TransferNotifications.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(audience))
        {
            query = query.Where(n => n.Audience.ToLower() == audience.ToLower());
        }

        if (transferId.HasValue)
        {
            query = query.Where(n => n.TransferId == transferId.Value);
        }

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var totalCount = await query.CountAsync(ct);

        var pageNumber = page < 1 ? 1 : page;
        var take = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((pageNumber - 1) * take)
            .Take(take)
            .Select(n => new TransferNotificationResponse
            {
                Id = n.Id,
                TransferId = n.TransferId,
                Audience = n.Audience,
                RecipientUserId = n.RecipientUserId,
                Title = n.Title,
                Message = n.Message,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(new PagedResponse<TransferNotificationResponse>(notifications, totalCount, pageNumber, take));
    }

    /// <summary>
    /// POST /api/notifications/{id}/read - Mark single notification as read
    /// </summary>
    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(typeof(ApiResponse<TransferNotificationResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead([FromRoute] Guid id, CancellationToken ct = default)
    {
        // TODO: enforce recipient checks after auth merge
        var notification = await _dbContext.TransferNotifications.FirstOrDefaultAsync(n => n.Id == id, ct);
        if (notification == null)
        {
            return NotFound(new ErrorResponse($"Notification with ID {id} not found.", "NOT_FOUND"));
        }

        notification.IsRead = true;
        await _dbContext.SaveChangesAsync(ct);

        var response = new TransferNotificationResponse
        {
            Id = notification.Id,
            TransferId = notification.TransferId,
            Audience = notification.Audience,
            RecipientUserId = notification.RecipientUserId,
            Title = notification.Title,
            Message = notification.Message,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt
        };

        return Ok(ApiResponse<TransferNotificationResponse>.Ok(response, "Notification marked as read."));
    }

    /// <summary>
    /// POST /api/notifications/read-all - Mark all notifications (or all for an audience) as read
    /// </summary>
    [HttpPost("read-all")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllAsRead([FromQuery] string? audience = null, CancellationToken ct = default)
    {
        // TODO: enforce recipient checks after auth merge
        var query = _dbContext.TransferNotifications.Where(n => !n.IsRead);

        if (!string.IsNullOrWhiteSpace(audience))
        {
            query = query.Where(n => n.Audience.ToLower() == audience.ToLower());
        }

        var unreadList = await query.ToListAsync(ct);
        foreach (var item in unreadList)
        {
            item.IsRead = true;
        }

        await _dbContext.SaveChangesAsync(ct);

        return Ok(ApiResponse<int>.Ok(unreadList.Count, $"Marked {unreadList.Count} notifications as read."));
    }
}
