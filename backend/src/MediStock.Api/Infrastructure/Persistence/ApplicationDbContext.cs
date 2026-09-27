namespace MediStock.Api.Infrastructure.Persistence;

using MediStock.Api.Features.Demand.Models;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// The single MediStock PostgreSQL persistence boundary.
/// Primary owner of this directory: Sathurstiga S. (IT24103156).
///
/// Every vertical registers its entities here. Each vertical owner supplies their entity
/// requirements and configuration through this boundary; the Demand vertical does not
/// define other verticals' models.
/// </summary>
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // ---------------------------------------------------------------------
    // Demand & Shortage vertical - Sathurstiga S. (IT24103156)
    // ---------------------------------------------------------------------

    public DbSet<ConsumptionRecord> ConsumptionRecords => Set<ConsumptionRecord>();

    public DbSet<DemandForecast> DemandForecasts => Set<DemandForecast>();

    public DbSet<ShortageAlert> ShortageAlerts => Set<ShortageAlert>();

    public DbSet<ReorderRule> ReorderRules => Set<ReorderRule>();

    // ---------------------------------------------------------------------
    // Inventory, Redistribution, Procurement, Workflow and Auth entity sets are
    // added here by their owners through this same shared boundary.
    // ---------------------------------------------------------------------

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Picks up every IEntityTypeConfiguration in this assembly, so each vertical
        // owner can add their configuration file without editing this method.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        // Quantities are stored as exact numerics rather than floating point, so stock
        // and consumption arithmetic stays reproducible.
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }
}
