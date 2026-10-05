using Microsoft.AspNetCore.Identity;

namespace MediStock.Api.Infrastructure.Persistence.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
}
