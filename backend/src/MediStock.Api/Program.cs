using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using MediStock.Api.Data;
using MediStock.Api.Middleware;
using MediStock.Api.Features.Redistribution.Services;
using MediStock.Api.Features.Workflow.Services;

var builder = WebApplication.CreateBuilder(args);

// Database Context
builder.Services.AddDbContext<MediStockDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseNpgsql(connectionString);
});

// Controllers with JSON formatting
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// CORS for React and Mobile
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllOrigins", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "MediStock API - Redistribution Management",
        Version = "v1",
        Description = "API documentation for MediStock Redistribution Slice (Member 3 - ILHAM MM, IT24103530)"
    });
});

// HttpClients
builder.Services.AddHttpClient<IRoutingService, RoutingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(8);
});

builder.Services.AddHttpClient<IAgentGateway, AgentGateway>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Validators
builder.Services.AddSingleton<MediStock.Api.Features.Redistribution.Validators.TransferValidator>();

// Feature Services
builder.Services.AddScoped<MediStock.Api.Features.Redistribution.Services.ICandidateFacilityService, MediStock.Api.Features.Redistribution.Services.CandidateFacilityService>();
builder.Services.AddScoped<MediStock.Api.Features.Redistribution.Services.ITransferService, MediStock.Api.Features.Redistribution.Services.TransferService>();
builder.Services.AddScoped<MediStock.Api.Features.Workflow.Services.IWorkflowStateService, MediStock.Api.Features.Workflow.Services.WorkflowStateService>();
builder.Services.AddScoped<MediStock.Api.Features.Workflow.Services.IApprovalService, MediStock.Api.Features.Workflow.Services.ApprovalService>();
builder.Services.AddScoped<MediStock.Api.Features.Workflow.Services.IWorkflowService, MediStock.Api.Features.Workflow.Services.WorkflowService>();

var app = builder.Build();

// Request logging middleware
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseCors("AllowAllOrigins");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "MediStock API v1");
    });
}

app.UseRouting();

app.MapControllers();

// Ensure DB schema and seed initial data
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var dbContext = services.GetRequiredService<MediStockDbContext>();
    await DbInitializer.InitializeAsync(dbContext, logger);
}

app.Run();
