using System.Text;
using System.Text.Json.Serialization;
using MediStock.Api.Common;
using MediStock.Api.Features.Auth.Services;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Procurement.Services;
using MediStock.Api.Features.Validation.Services;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Identity;
using MediStock.Api.Infrastructure.Persistence.Seed;
using MediStock.Api.Middleware;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// ============================================================
// Load backend/.env for local development.
// Environment variables set here are visible to IConfiguration
// via the standard ASP.NET Core environment-variable provider.
// The double-underscore (__) separator maps to the config
// hierarchy: Jwt__SigningKey  →  Jwt:SigningKey.
// In production/CI supply env vars directly; .env is optional.
// ============================================================
static void LoadDotEnv()
{
    // Walk up from the assembly location to find the repo root
    // that contains .env (or backend/.env fallback).
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null)
    {
        var rootCandidate = Path.Combine(dir.FullName, ".env");
        var backendCandidate = Path.Combine(dir.FullName, "backend", ".env");
        var candidate = File.Exists(rootCandidate) ? rootCandidate : (File.Exists(backendCandidate) ? backendCandidate : null);
        if (candidate is not null)
        {
            foreach (var line in File.ReadAllLines(candidate))
            {
                var trimmed = line.Trim();
                if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith('#'))
                    continue;
                var idx = trimmed.IndexOf('=');
                if (idx < 1)
                    continue;
                var key   = trimmed[..idx].Trim();
                var value = trimmed[(idx + 1)..].Trim();
                // Only set if not already supplied by the real environment.
                if (Environment.GetEnvironmentVariable(key) is null)
                    Environment.SetEnvironmentVariable(key, value);
            }
            break;
        }
        dir = dir.Parent;
    }
}

LoadDotEnv();

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter());
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        var defaultInvalidModelStateResponseFactory =
            options.InvalidModelStateResponseFactory;

        options.InvalidModelStateResponseFactory = context =>
        {
            context.ActionDescriptor.RouteValues
                .TryGetValue("controller", out var controller);

            if (controller is not
                ("Medicines" or "Inventory" or "MedicineBatches"))
            {
                return defaultInvalidModelStateResponseFactory(context);
            }

            var message =
                context.ModelState.Keys.Any(key =>
                    key.Contains(
                        "minimumStockLevel",
                        StringComparison.OrdinalIgnoreCase))
                    ? "Minimum stock must be a non-negative whole number."
                    : context.ModelState.Keys.Any(key =>
                        key.Contains(
                            "batchNumber",
                            StringComparison.OrdinalIgnoreCase))
                        ? "Batch number must follow the format BATCH-###, for example BATCH-001."
                        : "The request contains an invalid value.";

            return new BadRequestObjectResult(new ErrorResponse
            {
                Error = new ErrorDetail
                {
                    Code = "INVALID_REQUEST",
                    Message = message,
                    TraceId = context.HttpContext.TraceIdentifier
                }
            });
        };
    });

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (builder.Environment.IsEnvironment("Testing") ||
        builder.Configuration.GetValue<bool>("UseInMemoryDatabase"))
    {
        options.UseInMemoryDatabase("medistock-tests");
    }
    else
    {
        options.UseNpgsql(
            builder.Configuration.GetConnectionString("DefaultConnection"));
    }
});

builder.Services
    .AddIdentityCore<ApplicationUser>()
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager();

var jwtConfiguration =
    builder.Configuration
        .GetSection(JwtConfiguration.SectionName)
        .Get<JwtConfiguration>() ?? new JwtConfiguration();

// Support flat environment variable overrides (e.g. from container or .env)
if (builder.Configuration["JWT_ISSUER"] is { Length: > 0 } envIssuer)
{
    jwtConfiguration.Issuer = envIssuer;
}

if (builder.Configuration["JWT_AUDIENCE"] is { Length: > 0 } envAudience)
{
    jwtConfiguration.Audience = envAudience;
}

if (builder.Configuration["JWT_SIGNING_KEY"] is { Length: > 0 } envSigningKey)
{
    jwtConfiguration.SigningKey = envSigningKey;
}

if (builder.Configuration["JWT_ACCESS_TOKEN_EXPIRATION_MINUTES"] is { Length: > 0 } envAccess &&
    int.TryParse(envAccess, out var parsedAccessMins) && parsedAccessMins > 0)
{
    jwtConfiguration.AccessTokenExpirationMinutes = parsedAccessMins;
}

if (builder.Configuration["JWT_REFRESH_TOKEN_EXPIRATION_DAYS"] is { Length: > 0 } envRefresh &&
    int.TryParse(envRefresh, out var parsedRefreshDays) && parsedRefreshDays > 0)
{
    jwtConfiguration.RefreshTokenExpirationDays = parsedRefreshDays;
}

if (string.IsNullOrWhiteSpace(jwtConfiguration.Issuer))
{
    throw new InvalidOperationException("JWT issuer is missing. Set JWT_ISSUER or Jwt__Issuer in your environment or backend/.env.");
}

if (string.IsNullOrWhiteSpace(jwtConfiguration.Audience))
{
    throw new InvalidOperationException("JWT audience is missing. Set JWT_AUDIENCE or Jwt__Audience in your environment or backend/.env.");
}

if (string.IsNullOrWhiteSpace(jwtConfiguration.SigningKey))
{
    throw new InvalidOperationException(
        "JWT signing key is missing. Set JWT_SIGNING_KEY or Jwt__SigningKey in your environment or backend/.env.");
}

if (jwtConfiguration.SigningKey.Length < 32)
{
    throw new InvalidOperationException(
        "JWT signing key is too short. Use at least 32 characters for HMAC-SHA256.");
}

builder.Services.AddSingleton(jwtConfiguration);

builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<RefreshTokenService>();

builder.Services.AddScoped<SupplierService>();
builder.Services.AddScoped<ProcurementService>();
builder.Services.AddScoped<DeliveryService>();

builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<FacilityAuthorizationService>();
builder.Services.AddScoped<PolicyValidationService>();

builder.Services.AddHttpContextAccessor();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            JwtBearerDefaults.AuthenticationScheme;

        options.DefaultChallengeScheme =
            JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtConfiguration.Issuer,

                ValidateAudience = true,
                ValidAudience = jwtConfiguration.Audience,

                ValidateIssuerSigningKey = true,
                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(
                            jwtConfiguration.SigningKey)),

                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };
    });

builder.Services.AddAuthorization();


// ============================================================
// Inventory Vertical Slice
// ============================================================

builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<BatchService>();
builder.Services.AddScoped<StockTransactionService>();
builder.Services.AddScoped<MedicineService>();


// ============================================================
// Validation & Error Handling
// ============================================================

builder.Services.AddExceptionHandler<MediStockExceptionHandler>();
builder.Services.AddProblemDetails();


// ============================================================
// CORS
// ============================================================

builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalWeb", policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return uri.Host == "localhost" || uri.Host == "127.0.0.1";
                }
                return false;
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


// ============================================================
// Swagger
// ============================================================

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition(
        "Bearer",
        new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            Description = "Enter your JWT access token."
        });

    options.AddSecurityRequirement(
        new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
        {
            {
                new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference =
                        new Microsoft.OpenApi.Models.OpenApiReference
                        {
                            Type =
                                Microsoft.OpenApi.Models.ReferenceType
                                    .SecurityScheme,
                            Id = "Bearer"
                        }
                },
                Array.Empty<string>()
            }
        });
});


var app = builder.Build();


// ============================================================
// Database Initialization & Seed
// ============================================================

using (var scope = app.Services.CreateScope())
{
    var db =
        scope.ServiceProvider
            .GetRequiredService<ApplicationDbContext>();

    if (db.Database.IsRelational() &&
        db.Database.GetMigrations().Any())
    {
        db.Database.Migrate();
    }
    else
    {
        db.Database.EnsureCreated();
    }

    SeedData.Apply(db);
}

await SeedUsers.SeedAsync(app.Services);


// ============================================================
// HTTP Pipeline
// ============================================================

app.UseExceptionHandler();

app.UseCors("LocalWeb");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet(
    "/health",
    () => Results.Ok(new { status = "ok" }));

app.Run();

public partial class Program;
