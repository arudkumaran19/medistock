using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Middleware;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
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
