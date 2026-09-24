using MediStock.Api.Domain.Enums;
using MediStock.Api.Infrastructure.Persistence.Identity;
using Microsoft.AspNetCore.Identity;

namespace MediStock.Api.Infrastructure.Persistence.Seed;

public static class SeedUsers
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var roleManager =
            scope.ServiceProvider
                .GetRequiredService<RoleManager<IdentityRole<Guid>>>();

        foreach (var role in Enum.GetValues<UserRole>())
        {
            var roleName = role.ToString();

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
    }
}