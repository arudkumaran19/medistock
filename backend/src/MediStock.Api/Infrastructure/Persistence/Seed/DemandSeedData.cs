// Demand & Shortage seed data - Sathurstiga S. (IT24103156).
//
// Infrastructure/Persistence is this vertical's ownership (blueprint section 30).
// This content previously lived in Seed/SeedData.cs while that file was an empty
// placeholder. On develop, SeedData.cs belongs to the inventory and procurement
// owners and seeds their reference data, so the demand seed lives here instead and
// is applied after theirs. Nothing in their file is changed.

namespace MediStock.Api.Infrastructure.Persistence.Seed;

using MediStock.Api.Features.Demand.Models;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Shared seed-data integration point. Primary owner: Sathurstiga S. (IT24103156).
///
/// Seeding runs at startup rather than through EF model seeding, because the demand
/// dataset is a rolling window relative to the current date and model seeding requires
/// static values.
///
/// Identifiers below are fixed so the demonstration and the golden cases are
/// reproducible. The facility and medicine identifiers must be aligned with the
/// Inventory vertical's seed on integration - the Demand vertical does not define
/// Facility or Medicine entities.
/// </summary>
public static class DemandSeedData
{
    /// <summary>Hospital B - the facility at shortage risk in the blueprint example.</summary>
    public static readonly Guid FacilityBId = Guid.Parse("b1000000-0000-0000-0000-000000000002");

    /// <summary>Hospital A - the surplus facility in the blueprint example.</summary>
    public static readonly Guid FacilityAId = Guid.Parse("b1000000-0000-0000-0000-000000000001");

    /// <summary>Amoxicillin - the medicine used throughout the blueprint examples.</summary>
    public static readonly Guid AmoxicillinId = Guid.Parse("c1000000-0000-0000-0000-000000000001");

    /// <summary>Paracetamol - a second medicine, so list filtering and search are demonstrable.</summary>
    public static readonly Guid ParacetamolId = Guid.Parse("c1000000-0000-0000-0000-000000000002");

    /// <summary>
    /// Reproduces the blueprint's worked example:
    /// average consumption 20/day, lead time 10 days, so stock of 120 gives 6 days
    /// remaining and 6 &lt; 10 is a shortage risk.
    /// </summary>
    public const decimal DemoDailyConsumption = 20m;

    public const int DemoLeadTimeDays = 10;

    public const int DemoWindowDays = 30;

    /// <summary>
    /// Applies pending migrations and inserts the demand dataset when it is absent.
    /// Safe to call on every startup.
    /// </summary>
    /// <summary>
    /// Synchronous entry point, matching develop's SeedData.Apply(db) convention so
    /// Program.cs can call both the same way.
    /// </summary>
    public static void Apply(ApplicationDbContext db)
    {
        EnsureSeededAsync(db).GetAwaiter().GetResult();
    }

    public static async Task EnsureSeededAsync(ApplicationDbContext db, CancellationToken cancellationToken = default)
    {
        if (db.Database.IsRelational())
        {
            await db.Database.MigrateAsync(cancellationToken);
        }

        await SeedReorderRulesAsync(db, cancellationToken);
        await SeedConsumptionAsync(db, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedReorderRulesAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
        if (await db.ReorderRules.AnyAsync(cancellationToken))
        {
            return;
        }

        db.ReorderRules.AddRange(
            new ReorderRule
            {
                Id = Guid.Parse("d1000000-0000-0000-0000-000000000001"),
                FacilityId = FacilityBId,
                MedicineId = AmoxicillinId,
                MinimumStock = 150m,
                ReorderPoint = 300m,
                SafetyStock = 60m,
                LeadTimeDays = DemoLeadTimeDays,
                CreatedAt = DateTime.UtcNow
            },
            new ReorderRule
            {
                Id = Guid.Parse("d1000000-0000-0000-0000-000000000002"),
                FacilityId = FacilityBId,
                MedicineId = ParacetamolId,
                MinimumStock = 200m,
                ReorderPoint = 400m,
                SafetyStock = 80m,
                LeadTimeDays = 7,
                CreatedAt = DateTime.UtcNow
            },
            new ReorderRule
            {
                Id = Guid.Parse("d1000000-0000-0000-0000-000000000003"),
                FacilityId = FacilityAId,
                MedicineId = AmoxicillinId,
                MinimumStock = 150m,
                ReorderPoint = 300m,
                SafetyStock = 60m,
                LeadTimeDays = DemoLeadTimeDays,
                CreatedAt = DateTime.UtcNow
            });
    }

    private static async Task SeedConsumptionAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
        if (await db.ConsumptionRecords.AnyAsync(cancellationToken))
        {
            return;
        }

        var today = DateTime.UtcNow.Date;
        var records = new List<ConsumptionRecord>();

        // Amoxicillin at Hospital B: exactly 20 units a day across the 30-day window,
        // which is the input that makes the worked example reproducible.
        for (var dayOffset = DemoWindowDays; dayOffset >= 1; dayOffset--)
        {
            records.Add(new ConsumptionRecord
            {
                Id = Guid.NewGuid(),
                FacilityId = FacilityBId,
                MedicineId = AmoxicillinId,
                QuantityUsed = DemoDailyConsumption,
                ConsumptionDate = DateTime.SpecifyKind(today.AddDays(-dayOffset), DateTimeKind.Utc),
                Source = "SEED",
                Notes = "Seeded demonstration consumption",
                CreatedAt = DateTime.UtcNow
            });
        }

        // Paracetamol at Hospital B: a rising trend, so the trend forecasting method
        // produces a visibly different result from the flat moving average.
        for (var dayOffset = DemoWindowDays; dayOffset >= 1; dayOffset--)
        {
            var quantity = 10m + ((DemoWindowDays - dayOffset) * 0.5m);

            records.Add(new ConsumptionRecord
            {
                Id = Guid.NewGuid(),
                FacilityId = FacilityBId,
                MedicineId = ParacetamolId,
                QuantityUsed = decimal.Round(quantity, 2),
                ConsumptionDate = DateTime.SpecifyKind(today.AddDays(-dayOffset), DateTimeKind.Utc),
                Source = "SEED",
                Notes = "Seeded demonstration consumption",
                CreatedAt = DateTime.UtcNow
            });
        }

        // Amoxicillin at Hospital A: lower usage, the surplus side of the example.
        for (var dayOffset = DemoWindowDays; dayOffset >= 1; dayOffset--)
        {
            records.Add(new ConsumptionRecord
            {
                Id = Guid.NewGuid(),
                FacilityId = FacilityAId,
                MedicineId = AmoxicillinId,
                QuantityUsed = 8m,
                ConsumptionDate = DateTime.SpecifyKind(today.AddDays(-dayOffset), DateTimeKind.Utc),
                Source = "SEED",
                Notes = "Seeded demonstration consumption",
                CreatedAt = DateTime.UtcNow
            });
        }

        db.ConsumptionRecords.AddRange(records);
    }
}
