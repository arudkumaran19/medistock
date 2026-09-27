// SHARED HOST SCAFFOLDING - NOT owned by the Demand vertical.
//
// Composition root. Created by Sathurstiga S. (IT24103156) only so the Demand &
// Shortage vertical slice compiles, runs and is testable end to end.
//
// Authentication wiring belongs to Vaisnavi L. (IT24102469); middleware and logging
// belong to ILHAM MM (IT24103530); the error format belongs to Arudkumaran V.
// (IT24103011). Those owners replace their sections on integration - the Demand
// vertical does not design them.

using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// JSON - frozen API convention: camelCase, ISO 8601 dates.
// ---------------------------------------------------------------------------
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    });

// ---------------------------------------------------------------------------
// PostgreSQL - the single source of truth.
// Persistence is owned by Sathurstiga S. (IT24103156).
// ---------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("MediStock")
                       ?? "Host=localhost;Port=5432;Database=medistock;Username=postgres;Password=postgres";

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// ---------------------------------------------------------------------------
// Demand & Shortage vertical services - Sathurstiga S. (IT24103156).
// ---------------------------------------------------------------------------
builder.Services.AddScoped<ConsumptionService>();
builder.Services.AddScoped<ForecastService>();
builder.Services.AddScoped<ShortageService>();
builder.Services.AddScoped<DemandValidator>();

// ---------------------------------------------------------------------------
// Authentication and authorization.
// PLACEHOLDER - primary owner: Vaisnavi L. (IT24102469). Replace on integration.
// ---------------------------------------------------------------------------
var configuredJwtKey = builder.Configuration["Jwt:Key"];

// A blank setting must be treated as absent, not as a zero-length signing key.
// Outside development that is a deployment error, so fail fast rather than start the
// API with a key an attacker could guess.
if (string.IsNullOrWhiteSpace(configuredJwtKey)
    && !builder.Environment.IsDevelopment()
    && !builder.Environment.IsEnvironment("Testing"))
{
    throw new InvalidOperationException(
        "Jwt:Key is not configured. Set it through the environment before starting the API.");
}

var jwtKey = string.IsNullOrWhiteSpace(configuredJwtKey)
    ? "medistock-development-only-signing-key-change-me"
    : configuredJwtKey;

var jwtIssuer = builder.Configuration["Jwt:Issuer"];
jwtIssuer = string.IsNullOrWhiteSpace(jwtIssuer) ? "MediStock" : jwtIssuer;

var jwtAudience = builder.Configuration["Jwt:Audience"];
jwtAudience = string.IsNullOrWhiteSpace(jwtAudience) ? "MediStock" : jwtAudience;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// ---------------------------------------------------------------------------
// Swagger / OpenAPI.
// ---------------------------------------------------------------------------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "MediStock API",
        Version = "v1",
        Description = "Medicine inventory and supply coordination platform."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT bearer token."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);

    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }
});

// ---------------------------------------------------------------------------
// CORS for the React management application.
// PLACEHOLDER - configuration owner to confirm allowed origins on deployment.
// ---------------------------------------------------------------------------
const string WebCorsPolicy = "MediStockWeb";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { "http://localhost:5173" };

builder.Services.AddCors(options =>
    options.AddPolicy(WebCorsPolicy, policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(WebCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Health endpoint required by the deployment evidence.
app.MapGet("/health", () => Results.Ok(new { status = "healthy" })).AllowAnonymous();

// ---------------------------------------------------------------------------
// Migrate and seed. Skipped under the Testing environment, where the integration
// tests supply their own provider and data.
// ---------------------------------------------------------------------------
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        await SeedData.EnsureSeededAsync(db);
    }
    catch (Exception ex)
    {
        // A database that is unreachable at startup must not take the API down
        // silently - log it and let the health endpoint and requests surface it.
        logger.LogError(ex, "Database migration or seeding failed at startup.");
    }
}

app.Run();

/// <summary>
/// Exposed so the integration tests can host the API with WebApplicationFactory.
/// </summary>
public partial class Program
{
}
