namespace MediStock.UnitTests;

using System.Security.Claims;
using FluentAssertions;
using MediStock.Api.Common;
using MediStock.Api.Controllers;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Notifications.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

public class NotificationAndDecisionTests : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly NotificationService _notificationService;
    private readonly ShortageService _shortageService;

    public NotificationAndDecisionTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new ApplicationDbContext(options);
        _notificationService = new NotificationService(_db, NullLogger<NotificationService>.Instance);

        var consumptionService = new ConsumptionService(_db, NullLogger<ConsumptionService>.Instance);
        var forecastService = new ForecastService(_db, consumptionService, NullLogger<ForecastService>.Instance);
        _shortageService = new ShortageService(_db, consumptionService, forecastService, NullLogger<ShortageService>.Instance, _notificationService);
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    [Fact]
    public async Task CreateNotification_PersistsAndScopsProperly()
    {
        var facId = Guid.NewGuid();
        var alertId = Guid.NewGuid();

        var notification = await _notificationService.CreateNotificationAsync(
            title: "Critical Shortage: Amoxicillin",
            message: "Stock below 3 days cover",
            severity: "HIGH",
            linkUrl: $"/demand/shortages/{alertId}",
            shortageAlertId: alertId,
            facilityId: facId,
            role: "FacilityManager");

        notification.Should().NotBeNull();
        notification!.IsRead.Should().BeFalse();

        // Facility Manager of facId sees it
        var fmNotifications = await _notificationService.GetNotificationsAsync(
            userId: "manager1@hospital.org",
            role: "FacilityManager",
            facilityId: facId);
        fmNotifications.Should().ContainSingle(n => n.Id == notification.Id);

        // Facility Manager of a different facility does NOT see it
        var otherFmNotifications = await _notificationService.GetNotificationsAsync(
            userId: "manager2@hospital.org",
            role: "FacilityManager",
            facilityId: Guid.NewGuid());
        otherFmNotifications.Should().BeEmpty();

        // Admin sees it regardless of facility
        var adminNotifications = await _notificationService.GetNotificationsAsync(
            userId: "admin@hospital.org",
            role: "Admin",
            facilityId: null);
        adminNotifications.Should().ContainSingle(n => n.Id == notification.Id);
    }

    [Fact]
    public async Task CreateNotification_DeduplicatesUnreadForSameShortageAlert()
    {
        var alertId = Guid.NewGuid();
        var facId = Guid.NewGuid();

        var first = await _notificationService.CreateNotificationAsync(
            title: "Alert 1",
            message: "First notice",
            severity: "HIGH",
            shortageAlertId: alertId,
            facilityId: facId);

        first.Should().NotBeNull();

        // Second creation with same shortageAlertId while first is unread
        var second = await _notificationService.CreateNotificationAsync(
            title: "Alert 2",
            message: "Second notice",
            severity: "HIGH",
            shortageAlertId: alertId,
            facilityId: facId);

        second.Should().BeNull(); // Deduplicated!

        // Unread count is still 1
        var count = await _notificationService.GetUnreadCountAsync(null, "Admin", null);
        count.Should().Be(1);
    }

    [Fact]
    public async Task MarkAsRead_And_MarkAllAsRead_UpdateFlags()
    {
        var facId = Guid.NewGuid();
        var n1 = await _notificationService.CreateNotificationAsync("T1", "M1", "HIGH", facilityId: facId, role: "FacilityManager");
        var n2 = await _notificationService.CreateNotificationAsync("T2", "M2", "MEDIUM", facilityId: facId, role: "FacilityManager");

        var initialCount = await _notificationService.GetUnreadCountAsync(null, "FacilityManager", facId);
        initialCount.Should().Be(2);

        // Mark single as read
        var readSuccess = await _notificationService.MarkAsReadAsync(n1!.Id);
        readSuccess.Should().BeTrue();

        var midCount = await _notificationService.GetUnreadCountAsync(null, "FacilityManager", facId);
        midCount.Should().Be(1);

        // Mark all as read
        var allRead = await _notificationService.MarkAllAsReadAsync(null, "FacilityManager", facId);
        allRead.Should().Be(1);

        var finalCount = await _notificationService.GetUnreadCountAsync(null, "FacilityManager", facId);
        finalCount.Should().Be(0);
    }

    [Fact]
    public async Task DismissShortageAsync_SetsStatusDismissedAndAuditHistory()
    {
        var alert = new ShortageAlert
        {
            Id = Guid.NewGuid(),
            FacilityId = Guid.NewGuid(),
            MedicineId = Guid.NewGuid(),
            CurrentStock = 10,
            AverageDailyConsumption = 2,
            DaysRemaining = 5,
            LeadTimeDays = 10,
            RiskLevel = ShortageRiskLevels.High,
            Status = ShortageAlertStatuses.Open,
            GeneratedAt = DateTime.UtcNow
        };
        _db.ShortageAlerts.Add(alert);
        await _db.SaveChangesAsync();

        var dismissed = await _shortageService.DismissShortageAsync(
            alert.Id,
            reason: "Emergency stock batch arrived from alternate depot not in ledger",
            actor: "manager@hospital.org");

        dismissed.Should().NotBeNull();
        dismissed!.Status.Should().Be(ShortageAlertStatuses.Dismissed);
        dismissed.ResolvedAt.Should().NotBeNull();

        // Verify history
        var history = await _db.ShortageStatusHistories
            .Where(h => h.ShortageAlertId == alert.Id)
            .ToListAsync();
        history.Should().ContainSingle(h =>
            h.ToStatus == ShortageAlertStatuses.Dismissed &&
            h.ChangedBy == "manager@hospital.org" &&
            h.Notes!.Contains("alternate depot"));
    }

    [Fact]
    public async Task ResolveShortageAsync_WithoutVerification_ThrowsWhenStockInsufficient()
    {
        var alert = new ShortageAlert
        {
            Id = Guid.NewGuid(),
            FacilityId = Guid.NewGuid(),
            MedicineId = Guid.NewGuid(),
            CurrentStock = 10,
            AverageDailyConsumption = 5,
            DaysRemaining = 2,
            LeadTimeDays = 10,
            RiskLevel = ShortageRiskLevels.High,
            Status = ShortageAlertStatuses.Open,
            GeneratedAt = DateTime.UtcNow
        };
        _db.ShortageAlerts.Add(alert);
        await _db.SaveChangesAsync();

        // Empty resolve without evidence should fail enforcement
        var act = async () => await _shortageService.ResolveShortageAsync(
            alert.Id,
            request: new ShortageResolveRequest(),
            actor: "manager@hospital.org",
            enforceVerification: true);

        await act.Should().ThrowAsync<ShortageResolutionNotVerifiedException>();
    }

    [Fact]
    public async Task ResolveShortageAsync_WithVerifiedNotes_SucceedsAndCreatesNotification()
    {
        var alert = new ShortageAlert
        {
            Id = Guid.NewGuid(),
            FacilityId = Guid.NewGuid(),
            MedicineId = Guid.NewGuid(),
            CurrentStock = 10,
            AverageDailyConsumption = 5,
            DaysRemaining = 2,
            LeadTimeDays = 10,
            RiskLevel = ShortageRiskLevels.High,
            Status = ShortageAlertStatuses.Open,
            GeneratedAt = DateTime.UtcNow
        };
        _db.ShortageAlerts.Add(alert);
        await _db.SaveChangesAsync();

        var resolveRequest = new ShortageResolveRequest
        {
            VerificationMethod = "CLINICAL_WAIVER",
            VerificationNotes = "Physician authorized therapeutic substitution with Cefuroxime",
            VerifiedBy = "Dr. Silva, Clinical Director"
        };

        var resolved = await _shortageService.ResolveShortageAsync(
            alert.Id,
            request: resolveRequest,
            actor: "Dr. Silva",
            enforceVerification: true);

        resolved.Should().NotBeNull();
        resolved!.Status.Should().Be(ShortageAlertStatuses.Resolved);
        resolved.ResolutionVerified.Should().BeTrue();
        resolved.VerificationMethod.Should().Be("CLINICAL_WAIVER");

        // Verify notification was created
        var notifications = await _db.AppNotifications
            .Where(n => n.FacilityId == alert.FacilityId)
            .ToListAsync();
        notifications.Should().Contain(n => n.Title.Contains("Shortage Resolved"));
    }

    [Fact]
    public async Task NotificationsController_Endpoints_WorkWithClaims()
    {
        var facId = Guid.NewGuid();
        var controller = new NotificationsController(_notificationService);

        var user = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, "usr-123"),
            new Claim(ClaimTypes.Name, "officer@hospital.org"),
            new Claim(ClaimTypes.Role, "FacilityManager"),
            new Claim("FacilityId", facId.ToString())
        ], "mock"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        await _notificationService.CreateNotificationAsync("Shortage", "Details", "HIGH", facilityId: facId, role: "FacilityManager");

        var getResult = await controller.GetNotifications();
        var okResult = getResult as OkObjectResult;
        okResult.Should().NotBeNull();

        var unreadResult = await controller.GetUnreadCount();
        var okUnread = unreadResult as OkObjectResult;
        okUnread.Should().NotBeNull();
    }
}
