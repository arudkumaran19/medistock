using MediStock.Api.Common;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Security;

public sealed class FacilityAuthorizationService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly CurrentUserService _currentUserService;

    public FacilityAuthorizationService(
        ApplicationDbContext dbContext,
        CurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<bool> CanAccessFacilityAsync(
        Guid facilityId,
        CancellationToken cancellationToken = default)
    {
        var userId = _currentUserService.UserId;

        if (userId is null)
        {
            return false;
        }

        // Global administrators have cross-facility administrative scope
        if (_currentUserService.IsInRole(Constants.Roles.Admin) || _currentUserService.IsInRole("Administrator"))
        {
            return true;
        }

        return await _dbContext.UserFacilities
            .AsNoTracking()
            .AnyAsync(
                userFacility =>
                    userFacility.UserId == userId.Value &&
                    userFacility.FacilityId == facilityId,
                cancellationToken);
    }
}