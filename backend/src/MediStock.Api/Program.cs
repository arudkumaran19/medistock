using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Middleware;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Infrastructure.Persistence.Seed;
using MediStock.Api.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
				? "Batch number must start with a letter or number and may contain only letters, numbers, hyphens, and underscores (max 50 characters)."
				: "The request contains an invalid value.";
		return new BadRequestObjectResult(new ErrorResponse
		{
			Error = new ErrorDetail { Code = "INVALID_REQUEST", Message = message, TraceId = context.HttpContext.TraceIdentifier }
		});
	};
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options => options.AddPolicy("LocalWeb", policy => policy.WithOrigins("http://localhost:5173", "http://localhost:5174").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
	if (builder.Environment.IsEnvironment("Testing") || builder.Configuration.GetValue<bool>("UseInMemoryDatabase")) options.UseInMemoryDatabase("medistock-tests");
	else options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<BatchService>();
builder.Services.AddScoped<StockTransactionService>();
builder.Services.AddScoped<MedicineService>();
builder.Services.AddExceptionHandler<MediStockExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
	var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
	if (db.Database.IsRelational() && db.Database.GetMigrations().Any()) db.Database.Migrate();
	else db.Database.EnsureCreated();
	SeedData.Apply(db);
}
app.UseExceptionHandler();
app.UseCors("LocalWeb");
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.Run();

public partial class Program;
