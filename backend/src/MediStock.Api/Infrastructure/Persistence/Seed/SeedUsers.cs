using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Infrastructure.Persistence.Seed;

public static class SeedUsers
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var roleManager =
            scope.ServiceProvider
                .GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager =
            scope.ServiceProvider
                .GetRequiredService<UserManager<ApplicationUser>>();
        var dbContext =
            scope.ServiceProvider
                .GetRequiredService<ApplicationDbContext>();

        // Seed both enum-based and blueprint-standard role names for full compatibility
        var roles = new[]
        {
            "OperationalStaff", "STORE_OFFICER",
            "FacilityManager", "FACILITY_MANAGER",
            "SupplierOfficer", "SUPPLIER_OFFICER",
            "Administrator", "ADMIN"
        };

        foreach (var roleName in roles)
        {
            if (await roleManager.RoleExistsAsync(roleName))
            {
                continue;
            }

            var result = await roleManager.CreateAsync(
                new IdentityRole<Guid>(roleName));

            if (!result.Succeeded)
            {
                var errors = string.Join(
                    "; ",
                    result.Errors.Select(error => error.Description));

                throw new InvalidOperationException(
                    $"Failed to seed role '{roleName}': {errors}");
            }
        }

        // Seed deterministic demo users for development and testing
        var defaultUsers = new[]
        {
            (Email: "manager@medistock.com", Roles: new[] { "FacilityManager", "FACILITY_MANAGER" }),
            (Email: "store@medistock.com", Roles: new[] { "OperationalStaff", "STORE_OFFICER" }),
            (Email: "supplier@medistock.com", Roles: new[] { "SupplierOfficer", "SUPPLIER_OFFICER" }),
            (Email: "admin@medistock.com", Roles: new[] { "Administrator", "ADMIN" }),
        };

        const string defaultPassword = "Password123!";

        var allFacilityIds = new[]
        {
            SeedData.CentralFacilityId,
            SeedData.NorthClinicFacilityId,
            SeedData.EastHospitalFacilityId,
            SeedData.WestDispensaryFacilityId
        };

        foreach (var u in defaultUsers)
        {
            var user = await userManager.FindByEmailAsync(u.Email);
            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = u.Email,
                    Email = u.Email,
                    EmailConfirmed = true
                };

                var createRes = await userManager.CreateAsync(user, defaultPassword);
                if (!createRes.Succeeded)
                {
                    var errors = string.Join("; ", createRes.Errors.Select(e => e.Description));
                    throw new InvalidOperationException($"Failed to create seed user {u.Email}: {errors}");
                }
            }
            else
            {
                // Ensure default password works
                var validPass = await userManager.CheckPasswordAsync(user, defaultPassword);
                if (!validPass)
                {
                    var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
                    await userManager.ResetPasswordAsync(user, resetToken, defaultPassword);
                }
            }

            // Ensure roles
            var existingRoles = await userManager.GetRolesAsync(user);
            var missingRoles = u.Roles.Where(r => !existingRoles.Contains(r)).ToArray();
            if (missingRoles.Length > 0)
            {
                await userManager.AddToRolesAsync(user, missingRoles);
            }

            // Ensure UserFacility associations for operational & manager roles
            var userFacilities = await dbContext.UserFacilities
                .Where(uf => uf.UserId == user.Id)
                .Select(uf => uf.FacilityId)
                .ToListAsync();

            var targetFacilities = (u.Roles.Contains("ADMIN") || u.Roles.Contains("FacilityManager"))
                ? allFacilityIds
                : new[] { SeedData.CentralFacilityId };

            foreach (var facId in targetFacilities)
            {
                if (!userFacilities.Contains(facId))
                {
                    dbContext.UserFacilities.Add(new UserFacility
                    {
                        UserId = user.Id,
                        FacilityId = facId
                    });
                }
            }
        }

        await dbContext.SaveChangesAsync();
    }
}