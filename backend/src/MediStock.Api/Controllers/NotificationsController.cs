namespace MediStock.Api.Controllers;

using System.Security.Claims;
using MediStock.Api.Common;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Notifications.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/notifications")]
[Authorize]
[Produces("application/json")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    /// <summary>
    /// Gets in-app notifications scoped to the current user's role and facility.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<AppNotification>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int limit = 50,
        [FromQuery] Guid? facilityId = null,
        CancellationToken cancellationToken = default)
    {
        var (userId, role, userFacilityId) = GetUserContext();
        var effectiveFacilityId = facilityId ?? userFacilityId;

        var notifications = await _notificationService.GetNotificationsAsync(
            userId: userId,
            role: role,
            facilityId: effectiveFacilityId,
            unreadOnly: unreadOnly,
            limit: limit,
            cancellationToken: cancellationToken);

        return Ok(new ApiResponse<List<AppNotification>>(notifications));
    }

    /// <summary>
    /// Gets the count of unread notifications for badge display.
    /// </summary>
    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(ApiResponse<UnreadCountResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnreadCount(
        [FromQuery] Guid? facilityId = null,
        CancellationToken cancellationToken = default)
    {
        var (userId, role, userFacilityId) = GetUserContext();
        var effectiveFacilityId = facilityId ?? userFacilityId;

        var count = await _notificationService.GetUnreadCountAsync(
            userId: userId,
            role: role,
            facilityId: effectiveFacilityId,
            cancellationToken: cancellationToken);

        return Ok(new ApiResponse<UnreadCountResponse>(new UnreadCountResponse(count)));
    }

    /// <summary>
    /// Marks a specific notification as read.
    /// </summary>
    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var (userId, _, _) = GetUserContext();
        var success = await _notificationService.MarkAsReadAsync(id, userId, cancellationToken);

        if (!success)
        {
            return NotFound(new ErrorResponse
            {
                Error = new ErrorDetail
                {
                    Code = "NOTIFICATION_NOT_FOUND",
                    Message = $"Notification {id} was not found.",
                    TraceId = HttpContext.TraceIdentifier,
                }
            });
        }

        return Ok(new ApiResponse<bool>(true));
    }

    /// <summary>
    /// Marks all unread notifications for the caller as read.
    /// </summary>
    [HttpPost("read-all")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllAsRead(
        [FromQuery] Guid? facilityId = null,
        CancellationToken cancellationToken = default)
    {
        var (userId, role, userFacilityId) = GetUserContext();
        var effectiveFacilityId = facilityId ?? userFacilityId;

        var count = await _notificationService.MarkAllAsReadAsync(
            userId: userId,
            role: role,
            facilityId: effectiveFacilityId,
            cancellationToken: cancellationToken);

        return Ok(new ApiResponse<int>(count));
    }

    private (string? UserId, string? Role, Guid? FacilityId) GetUserContext()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.Identity?.Name;
        var role = User.FindFirst(ClaimTypes.Role)?.Value;

        Guid? facilityId = null;
        var facilityClaim = User.FindFirst("FacilityId")?.Value;
        if (Guid.TryParse(facilityClaim, out var parsedFacId))
        {
            facilityId = parsedFacId;
        }

        return (userId, role, facilityId);
    }
}

public sealed record UnreadCountResponse(int Count);
