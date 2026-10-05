using System.Text;
using System.Text.Json.Serialization;
using MediStock.Api.Common;
using MediStock.Api.Data;
using MediStock.Api.Features.Auth.Services;
using MediStock.Api.Features.Demand.Services;
using MediStock.Api.Features.Demand.Validators;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Procurement.Services;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Validation.Services;
using MediStock.Api.Features.Workflow.Services;
using MediStock.Api.Infrastructure.AI;
using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Identity;
using MediStock.Api.Infrastructure.Persistence.Seed;
using MediStock.Api.Middleware;
using MediStock.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

// ============================================================
// Load backend/.env for local development.
// ============================================================
static void LoadDotEnv()
{
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
                var key = trimmed[..idx].Trim();
                var value = trimmed[(idx + 1)..].Trim();
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

// Controllers with JSON formatting
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        var defaultInvalidModelStateResponseFactory = options.InvalidModelStateResponseFactory;

        options.InvalidModelStateResponseFactory = context =>
        {
            context.ActionDescriptor.RouteValues.TryGetValue("controller", out var controller);

            if (controller is not ("Medicines" or "Inventory" or "MedicineBatches"))
            {
                return defaultInvalidModelStateResponseFactory(context);
            }

            var message =
                context.ModelState.Keys.Any(key =>
                    key.Contains("minimumStockLevel", StringComparison.OrdinalIgnoreCase))
                    ? "Minimum stock must be a non-negative whole number."
                    : context.ModelState.Keys.Any(key =>
                        key.Contains("batchNumber", StringComparison.OrdinalIgnoreCase))
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

// Database Contexts
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
    if (builder.Environment.IsEnvironment("Testing") ||
        builder.Configuration.GetValue<bool>("UseInMemoryDatabase"))
    {
        options.UseInMemoryDatabase("medistock-tests");
    }
    else
    {
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    }
});

builder.Services.AddDbContext<MediStockDbContext>(options =>
{
    var useInMemory = builder.Configuration.GetValue<bool>("UseInMemoryDatabase") ||
                      builder.Environment.IsEnvironment("Testing");
    if (useInMemory)
    {
        options.UseInMemoryDatabase("medistock_db");
    }
    else
    {
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
        options.UseNpgsql(connectionString);
    }
});

// Identity
builder.Services
    .AddIdentityCore<ApplicationUser>()
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager();

// JWT Configuration
var jwtConfiguration =
    builder.Configuration
        .GetSection(JwtConfiguration.SectionName)
        .Get<JwtConfiguration>() ?? new JwtConfiguration();

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
    jwtConfiguration.Issuer = "MediStock.Api";
}

if (string.IsNullOrWhiteSpace(jwtConfiguration.Audience))
{
    jwtConfiguration.Audience = "MediStock.Client";
}

if (string.IsNullOrWhiteSpace(jwtConfiguration.SigningKey) || jwtConfiguration.SigningKey.Length < 32)
{
    jwtConfiguration.SigningKey = "MediStockSecretKeyForAuthenticationAndJwtTokenGeneration12345!";
}

builder.Services.AddSingleton(jwtConfiguration);

// Auth & Security Services
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
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtConfiguration.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtConfiguration.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfiguration.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR();

// Inventory Vertical Slice
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<BatchService>();
builder.Services.AddScoped<StockTransactionService>();
builder.Services.AddScoped<MedicineService>();

// Demand & Shortage Vertical Slice
builder.Services.AddScoped<ConsumptionService>();
builder.Services.AddScoped<ForecastService>();
builder.Services.AddScoped<ShortageService>();
builder.Services.AddScoped<DemandValidator>();

// AI & External HttpClients
builder.Services.Configure<AgentServiceOptions>(builder.Configuration.GetSection(AgentServiceOptions.SectionName));
builder.Services.AddHttpClient<AgentServiceClient>((serviceProvider, client) =>
{
    var agentOptions = serviceProvider.GetRequiredService<IOptions<AgentServiceOptions>>().Value;
    if (Uri.TryCreate(agentOptions.BaseUrl, UriKind.Absolute, out var agentBaseAddress))
    {
        client.BaseAddress = agentBaseAddress;
    }
    client.Timeout = TimeSpan.FromSeconds(agentOptions.TimeoutSeconds > 0 ? agentOptions.TimeoutSeconds : 30);
});

builder.Services.AddHttpClient<IRoutingService, RoutingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(8);
});

builder.Services.AddHttpClient<IAgentGateway, AgentGateway>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Redistribution & Workflow Services
builder.Services.AddSingleton<MediStock.Api.Features.Redistribution.Validators.TransferValidator>();
builder.Services.AddScoped<MediStock.Api.Features.Redistribution.Services.ITransferNotificationService, MediStock.Api.Features.Redistribution.Services.TransferNotificationService>();
builder.Services.AddScoped<MediStock.Api.Features.Redistribution.Services.ICandidateFacilityService, MediStock.Api.Features.Redistribution.Services.CandidateFacilityService>();
builder.Services.AddScoped<MediStock.Api.Features.Redistribution.Services.ITransferService, MediStock.Api.Features.Redistribution.Services.TransferService>();
builder.Services.AddScoped<MediStock.Api.Features.Workflow.Services.IWorkflowStateService, MediStock.Api.Features.Workflow.Services.WorkflowStateService>();
builder.Services.AddScoped<MediStock.Api.Features.Workflow.Services.IApprovalService, MediStock.Api.Features.Workflow.Services.ApprovalService>();
builder.Services.AddScoped<MediStock.Api.Features.Workflow.Services.IWorkflowService, MediStock.Api.Features.Workflow.Services.WorkflowService>();

// Error Handling
builder.Services.AddExceptionHandler<MediStockExceptionHandler>();
builder.Services.AddProblemDetails();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalWeb", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
    options.AddPolicy("AllowAllOrigins", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "MediStock API",
        Version = "v1",
        Description = "MediStock Core & Redistribution Platform API"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT access token."
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
});

var app = builder.Build();

// Database Initialization & Seed
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var appDb = services.GetRequiredService<ApplicationDbContext>();

    if (appDb.Database.IsRelational() && appDb.Database.GetMigrations().Any())
    {
        appDb.Database.Migrate();
    }
    else
    {
        appDb.Database.EnsureCreated();
    }

    SeedData.Apply(appDb);
    DemandSeedData.Apply(appDb);

    var logger = services.GetRequiredService<ILogger<Program>>();
    var mediStockDb = services.GetRequiredService<MediStockDbContext>();
    await DbInitializer.InitializeAsync(mediStockDb, logger);
}

await SeedUsers.SeedAsync(app.Services);

// HTTP Pipeline
app.UseExceptionHandler();
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseCors("LocalWeb");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "MediStock API v1");
    });
}

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<MediStock.Api.Features.Redistribution.Hubs.TransferHub>("/hubs/transfers");

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

public partial class Program;
