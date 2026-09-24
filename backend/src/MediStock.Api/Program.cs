using System.Text;
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

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
{
    var defaultInvalidModelStateResponseFactory = options.InvalidModelStateResponseFactory;
    options.InvalidModelStateResponseFactory = context =>
    {
        context.ActionDescriptor.RouteValues.TryGetValue("controller", out var controller);
        if (controller is not ("Medicines" or "Inventory" or "MedicineBatches"))
            return defaultInvalidModelStateResponseFactory(context);

        var message = context.ModelState.Keys.Any(key => key.Contains("minimumStockLevel", StringComparison.OrdinalIgnoreCase))
            ? "Minimum stock must be a non-negative whole number."
            : context.ModelState.Keys.Any(key => key.Contains("batchNumber", StringComparison.OrdinalIgnoreCase))
                ? "Batch number must follow the format BATCH-###, for example BATCH-001."
                : "The request contains an invalid value.";
        return new BadRequestObjectResult(new ErrorResponse
        {
            Error = new ErrorDetail { Code = "INVALID_REQUEST", Message = message, TraceId = context.HttpContext.TraceIdentifier }
        });
    };
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (builder.Environment.IsEnvironment("Testing") || builder.Configuration.GetValue<bool>("UseInMemoryDatabase"))
        options.UseInMemoryDatabase("medistock-tests");
    else
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services
    .AddIdentityCore<ApplicationUser>()
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager();

var jwtConfiguration = builder.Configuration.GetSection(JwtConfiguration.SectionName).Get<JwtConfiguration>()
    ?? throw new InvalidOperationException("JWT configuration is missing.");
if (string.IsNullOrWhiteSpace(jwtConfiguration.Issuer)) throw new InvalidOperationException("JWT issuer is missing.");
if (string.IsNullOrWhiteSpace(jwtConfiguration.Audience)) throw new InvalidOperationException("JWT audience is missing.");
if (string.IsNullOrWhiteSpace(jwtConfiguration.SigningKey)) throw new InvalidOperationException("JWT signing key is missing.");

builder.Services.AddSingleton(jwtConfiguration);
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<RefreshTokenService>();
builder.Services.AddScoped<SupplierService>();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<FacilityAuthorizationService>();
builder.Services.AddScoped<PolicyValidationService>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
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

builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<BatchService>();
builder.Services.AddScoped<StockTransactionService>();
builder.Services.AddScoped<MedicineService>();
builder.Services.AddExceptionHandler<MediStockExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddCors(options => options.AddPolicy("LocalWeb", policy =>
    policy.WithOrigins("http://localhost:5173", "http://localhost:5174").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter your JWT access token."
    });
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    if (db.Database.IsRelational() && db.Database.GetMigrations().Any()) db.Database.Migrate();
    else db.Database.EnsureCreated();
    SeedData.Apply(db);
}
await SeedUsers.SeedAsync(app.Services);

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
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.Run();

public partial class Program;
