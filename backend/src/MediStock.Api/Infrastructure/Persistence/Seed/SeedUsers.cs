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
            "Administrator", "ADMIN",
            "FieldOfficer", "FIELD_OFFICER"
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
            (Email: "user@medistock.com", Roles: new[] { "FacilityManager", "FACILITY_MANAGER" }),
            (Email: "officer@medistock.com", Roles: new[] { "FieldOfficer", "FIELD_OFFICER" }),
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

            // Determine legitimate facility assignments:
            // - admin@medistock.com: System Administrator has system-wide scope; no personal facility forced.
            // - manager@medistock.com: Assigned to Central Facility.
            // - user@medistock.com: Multi-facility manager assigned to Central Facility & Northside Community Clinic.
            // - store@medistock.com: Operational Staff assigned to Central Facility.
            // - officer@medistock.com: Field Officer assigned to Eastview General Hospital.
            // - supplier@medistock.com: External supplier representative; no internal healthcare facility assigned.
            var targetFacilities = u.Email switch
            {
                "manager@medistock.com" => new[] { SeedData.CentralFacilityId },
                "user@medistock.com" => new[] { SeedData.CentralFacilityId, SeedData.NorthClinicFacilityId },
                "store@medistock.com" => new[] { SeedData.CentralFacilityId },
                "officer@medistock.com" => new[] { SeedData.EastHospitalFacilityId },
                "admin@medistock.com" => Array.Empty<Guid>(),
                "supplier@medistock.com" => Array.Empty<Guid>(),
                _ => Array.Empty<Guid>()
            };

            // Synchronize UserFacility associations
            var existingAssignments = await dbContext.UserFacilities
                .Where(uf => uf.UserId == user.Id)
                .ToListAsync();

            var obsolete = existingAssignments
                .Where(uf => !targetFacilities.Contains(uf.FacilityId))
                .ToList();

            if (obsolete.Count > 0)
            {
                dbContext.UserFacilities.RemoveRange(obsolete);
            }

            var existingIds = existingAssignments.Select(uf => uf.FacilityId).ToHashSet();
            foreach (var facId in targetFacilities)
            {
                if (!existingIds.Contains(facId))
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