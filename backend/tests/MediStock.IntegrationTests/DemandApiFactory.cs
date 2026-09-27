namespace MediStock.IntegrationTests;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

/// <summary>
/// Hosts the API in memory for the Demand vertical's API and authorization tests.
/// Sathurstiga S. (IT24103156).
///
/// PostgreSQL is swapped for the in-memory provider so the suite runs in CI without a
/// database server. The authentication pipeline is left exactly as the application
/// configures it, so the role checks under test are the real ones.
/// </summary>
public class DemandApiFactory : WebApplicationFactory<Program>
{
    public const string SigningKey = "medistock-integration-test-signing-key-at-least-32-bytes";
    public const string Issuer = "MediStock";
    public const string Audience = "MediStock";

    /// <summary>Shared secret the agent service presents to the internal tool endpoints.</summary>
    public const string ServiceToken = "medistock-integration-test-service-token";

    private readonly string _databaseName = $"medistock-api-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Skips the startup migrate-and-seed, which has no relational database here.
        builder.UseEnvironment("Testing");

        // UseSetting rather than ConfigureAppConfiguration: Program.cs reads the JWT
        // settings before builder.Build(), and under minimal hosting the
        // ConfigureAppConfiguration callbacks have not run by that point. Host settings
        // are in place from the start.
        builder.UseSetting("Jwt:Key", SigningKey);
        builder.UseSetting("Jwt:Issuer", Issuer);
        builder.UseSetting("Jwt:Audience", Audience);
        builder.UseSetting("AgentService:ServiceToken", ServiceToken);

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.RemoveAll<ApplicationDbContext>();

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));
        });
    }

    /// <summary>
    /// Issues a signed token carrying the given role, so authorization is exercised
    /// through the real JWT pipeline rather than being stubbed out.
    /// </summary>
    public HttpClient CreateClientAs(string role)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", CreateToken(role));

        return client;
    }

    public static string CreateToken(string role)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Name, $"test-{role.ToLowerInvariant()}"),
                new Claim(ClaimTypes.Role, role)
            },
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Runs an action against the hosted application's database.
    /// </summary>
    public async Task WithDbAsync(Func<ApplicationDbContext, Task> action)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        await action(db);
    }
}
