using MediStock.Api.Domain.Enums;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Identity;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Controllers;

public sealed record UserDto(
    Guid Id,
    string Email,
    string? UserName,
    IReadOnlyList<string> Roles,
    bool IsActive,
    DateTimeOffset? LockoutEnd);

public sealed record UpdateUserRoleRequest(string Role);

public sealed record UpdateUserStatusRequest(bool IsActive);

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Administrator,ADMIN")]
public sealed class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly ApplicationDbContext _dbContext;
    private readonly CurrentUserService _currentUserService;

    public UsersController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        ApplicationDbContext dbContext,
        CurrentUserService currentUserService)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Retrieves all registered users and their active roles.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetAllUsers(CancellationToken cancellationToken)
    {
        var users = await _userManager.Users.ToListAsync(cancellationToken);
        var result = new List<UserDto>();

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var isActive = !user.LockoutEnd.HasValue || user.LockoutEnd.Value <= DateTimeOffset.UtcNow;

            result.Add(new UserDto(
                user.Id,
                user.Email ?? string.Empty,
                user.UserName,
                roles.ToList(),
                isActive,
                user.LockoutEnd));
        }

        return Ok(result.OrderBy(u => u.Email).ToList());
    }

    /// <summary>
    /// Promotes, assigns, or changes a user's role.
    /// </summary>
    [HttpPut("{id:guid}/role")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateUserRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(new { message = "Role name is required." });
        }

        var targetRole = request.Role.Trim();
        var allowedRoles = new[] { "OperationalStaff", "FacilityManager", "SupplierOfficer", "Administrator" };

        if (!allowedRoles.Contains(targetRole, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = $"Invalid role. Allowed roles are: {string.Join(", ", allowedRoles)}." });
        }

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        var currentRoles = await _userManager.GetRolesAsync(user);

        // Prevent self-demotion if current user is admin and modifying their own role
        if (_currentUserService.UserId == id && !targetRole.Equals("Administrator", StringComparison.OrdinalIgnoreCase))
        {
            var adminCount = (await _userManager.GetUsersInRoleAsync("Administrator")).Count
                           + (await _userManager.GetUsersInRoleAsync("ADMIN")).Count;
            if (adminCount <= 1)
            {
                return BadRequest(new { message = "You cannot remove your own administrator privileges as the sole active administrator." });
            }
        }

        // Remove old roles
        if (currentRoles.Any())
        {
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
        }

        // Add new standard role + blueprint compatibility role
        var rolesToAdd = new List<string> { targetRole };
        if (targetRole.Equals("Administrator", StringComparison.OrdinalIgnoreCase)) rolesToAdd.Add("ADMIN");
        if (targetRole.Equals("FacilityManager", StringComparison.OrdinalIgnoreCase)) rolesToAdd.Add("FACILITY_MANAGER");
        if (targetRole.Equals("SupplierOfficer", StringComparison.OrdinalIgnoreCase)) rolesToAdd.Add("SUPPLIER_OFFICER");
        if (targetRole.Equals("OperationalStaff", StringComparison.OrdinalIgnoreCase)) rolesToAdd.Add("STORE_OFFICER");

        foreach (var r in rolesToAdd)
        {
            if (await _roleManager.RoleExistsAsync(r))
            {
                await _userManager.AddToRoleAsync(user, r);
            }
        }

        return Ok(new { message = $"Role for {user.Email} successfully updated to {targetRole}." });
    }

    /// <summary>
    /// Activates or deactivates (archives) a user account.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateUserStatusRequest request)
    {
        if (_currentUserService.UserId == id && !request.IsActive)
        {
            return BadRequest(new { message = "Administrators cannot deactivate their own account." });
        }

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        if (request.IsActive)
        {
            user.LockoutEnd = null;
        }
        else
        {
            user.LockoutEnabled = true;
            user.LockoutEnd = DateTimeOffset.MaxValue;
        }

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", updateResult.Errors.Select(e => e.Description)) });
        }

        return Ok(new
        {
            message = request.IsActive
                ? $"Account for {user.Email} has been reactivated."
                : $"Account for {user.Email} has been archived/deactivated."
        });
    }

    /// <summary>
    /// Hard deletes a user account only if they have no linked audit or transaction records.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        if (_currentUserService.UserId == id)
        {
            return BadRequest(new { message = "Administrators cannot delete their own account." });
        }

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        // Check for auditing / transaction references across the system
        var hasPurchaseOrders = await _dbContext.PurchaseOrders.AnyAsync(po => po.ApprovedById == id);
        if (hasPurchaseOrders)
        {
            return BadRequest(new
            {
                message = "User has approved purchase orders and cannot be permanently deleted for auditing purposes. Please deactivate or archive the user instead."
            });
        }

        // Remove user facilities mappings first
        var userFacilities = await _dbContext.UserFacilities.Where(uf => uf.UserId == id).ToListAsync();
        if (userFacilities.Any())
        {
            _dbContext.UserFacilities.RemoveRange(userFacilities);
            await _dbContext.SaveChangesAsync();
        }

        // Remove user refresh tokens
        var tokens = await _dbContext.RefreshTokens.Where(rt => rt.UserId == id).ToListAsync();
        if (tokens.Any())
        {
            _dbContext.RefreshTokens.RemoveRange(tokens);
            await _dbContext.SaveChangesAsync();
        }

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });
        }

        return Ok(new { message = $"User {user.Email} was permanently deleted." });
    }
}
