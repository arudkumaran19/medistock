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
        await SeedRealFacilityReorderRulesAsync(db, cancellationToken);
        await SeedConsumptionAsync(db, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Default lead time for the real facilities' reorder rules.
    ///
    /// Not specified in the final blueprint: real lead times, minimum stock, reorder
    /// points and safety stock per facility and medicine. These defaults exist only so
    /// real medicines stop failing with DEMAND_THRESHOLD_NOT_FOUND. Do not assume or
    /// introduce a new decision without team-level confirmation.
    /// </summary>
    public const int DefaultLeadTimeDays = ReorderRuleDefaults.LeadTimeDays;

    /// <summary>Minimum stock used when a medicine has no MinimumStockLevel of its own.</summary>
    public const decimal DefaultMinimumStock = ReorderRuleDefaults.MinimumStock;

    /// <summary>
    /// develop's real facilities, from the Inventory owners' SeedData (read, not changed).
    /// </summary>
    public static readonly Guid[] RealFacilityIds =
    [
        SeedData.CentralFacilityId,
        SeedData.EastHospitalFacilityId,
        SeedData.NorthClinicFacilityId,
        SeedData.WestDispensaryFacilityId,
        SeedData.ColomboHospitalFacilityId,
        SeedData.KandyHospitalFacilityId
    ];

    /// <summary>develop's real medicines, from the Inventory owners' SeedData.</summary>
    public static readonly Guid[] RealMedicineIds =
    [
        SeedData.ParacetamolId,
        SeedData.AmoxicillinId,
        SeedData.Amoxicillin500mgId,
        SeedData.IbuprofenId,
        SeedData.CetirizineId,
        SeedData.OmeprazoleId,
        SeedData.AzithromycinId,
        SeedData.VitaminCId,
        // Extended formulary - added with DemoVolumeSeed (idempotent by code)
        SeedData.MetforminId,
        SeedData.AtorvastatinId,
        SeedData.MetronidazoleId,
        SeedData.DexamethasoneId,
        SeedData.SalbutamolId,
        SeedData.MorphineId,
        SeedData.DiclofenacId,
        SeedData.OrsSachetId,
    ];

    /// <summary>Additional clinical formulary medicines seeded via DemoVolumeSeed.</summary>
    public static readonly Guid[] ExtendedMedicineIds =
    [
        DemoVolumeSeed.CiprofloxacinId,
        DemoVolumeSeed.InsulinRegularId,
        DemoVolumeSeed.OmeprazoleIvId,
        DemoVolumeSeed.FurosemideId,
        DemoVolumeSeed.HeparinSodiumId,
        DemoVolumeSeed.CeftriaxoneId,
    ];

    /// <summary>
    /// The blueprint demo rules. Each rule is checked on its own, so the seed is
    /// idempotent and never overwrites a rule that already exists.
    /// </summary>
    private static async Task SeedReorderRulesAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
        var demoRules = new[]
        {
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
            }
        };

        var existing = await ExistingRulePairsAsync(db, cancellationToken);
        var existingIds = (await db.ReorderRules.AsNoTracking().Select(x => x.Id).ToListAsync(cancellationToken))
            .ToHashSet();

        db.ReorderRules.AddRange(demoRules.Where(rule =>
            !existing.Contains((rule.FacilityId, rule.MedicineId)) && !existingIds.Contains(rule.Id)));
    }

    /// <summary>
    /// Reorder rules for develop's real facilities and medicines, so the shortage
    /// check and the agent's getShortageThreshold work for real stock.
    ///
    /// Minimum stock comes from the medicine's own MinimumStockLevel (Inventory
    /// vertical, read-only); reorder point is twice that, safety stock half of it.
    /// A facility or medicine missing from the database is skipped, and an existing
    /// rule is never touched, so this is safe to run on every startup.
    /// </summary>
    public static async Task SeedRealFacilityReorderRulesAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken = default)
    {
        var facilityIds = await db.Facilities
            .AsNoTracking()
            .Where(x => RealFacilityIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        var allCandidateIds = RealMedicineIds.Concat(ExtendedMedicineIds).ToArray();
        var medicines = await db.Medicines
            .AsNoTracking()
            .Where(x => allCandidateIds.Contains(x.Id))
            .Select(x => new { x.Id, x.MinimumStockLevel })
            .ToListAsync(cancellationToken);

        var existing = await ExistingRulePairsAsync(db, cancellationToken);
        var now = DateTime.UtcNow;

        foreach (var facilityId in facilityIds.OrderBy(x => x))
        {
            foreach (var medicine in medicines.OrderBy(x => x.Id))
            {
                if (!existing.Add((facilityId, medicine.Id)))
                {
                    continue;
                }

                var rule = ReorderRuleDefaults.For(facilityId, medicine.Id, medicine.MinimumStockLevel);
                rule.CreatedAt = now;

                db.ReorderRules.Add(rule);
            }
        }
    }

    /// <summary>
    /// Facility and medicine pairs that already have a rule, saved or pending.
    /// </summary>
    private static async Task<HashSet<(Guid FacilityId, Guid MedicineId)>> ExistingRulePairsAsync(
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var saved = await db.ReorderRules
            .AsNoTracking()
            .Select(x => new { x.FacilityId, x.MedicineId })
            .ToListAsync(cancellationToken);

        return saved
            .Select(x => (x.FacilityId, x.MedicineId))
            .Concat(db.ReorderRules.Local.Select(x => (x.FacilityId, x.MedicineId)))
            .ToHashSet();
    }

    /// <summary>
    /// Loads the consumption history the forecast, demand-analysis and shortage scans
    /// depend on.
    ///
    /// IDEMPOTENCY: the check is per series (facility + medicine + date), not "does the
    /// table hold anything". A single global guard meant that once the blueprint demo
    /// rows existed, every real facility was silently skipped and the real facilities
    /// had no history at all - so forecasting, demand analysis and shortage detection
    /// had nothing to work on. Existing rows are never modified or deleted.
    /// </summary>
    private static async Task SeedConsumptionAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var records = new List<ConsumptionRecord>();

        // Every (facility, medicine, date) combination already present, so a re-run adds
        // only what is genuinely missing and never duplicates or overwrites anything.
        var existing = (await db.ConsumptionRecords
                .AsNoTracking()
                .Select(x => new { x.FacilityId, x.MedicineId, x.ConsumptionDate })
                .ToListAsync(cancellationToken))
            .Select(x => (x.FacilityId, x.MedicineId, x.ConsumptionDate.Date))
            .ToHashSet();

        void Add(Guid facilityId, Guid medicineId, DateTime date, decimal quantity, string notes)
        {
            if (existing.Add((facilityId, medicineId, date.Date)))
            {
                records.Add(MakeRecord(facilityId, medicineId, date, quantity, "SEED", notes));
            }
        }

        const int WindowDays = 90; // 90-day rolling window for meaningful forecasts

        // ── Demo facilities (blueprint example) ──────────────────────────────
        // Amoxicillin at Hospital B: exactly 20 units/day - reproduces worked example.
        for (var d = WindowDays; d >= 1; d--)
            Add(FacilityBId, AmoxicillinId, today.AddDays(-d), DemoDailyConsumption, "Blueprint demo: steady amoxicillin consumption");

        // Paracetamol at Hospital B: rising trend (10→25/day) - demonstrates trend forecasting.
        for (var d = WindowDays; d >= 1; d--)
        {
            var qty = 10m + ((WindowDays - d) * (15m / WindowDays));
            Add(FacilityBId, ParacetamolId, today.AddDays(-d), decimal.Round(qty, 2), "Blueprint demo: rising paracetamol demand");
        }

        // Amoxicillin at Hospital A: lower usage (surplus side of example)
        for (var d = WindowDays; d >= 1; d--)
            Add(FacilityAId, AmoxicillinId, today.AddDays(-d), 8m, "Blueprint demo: stable low amoxicillin usage");

        // ── Real facilities ───────────────────────────────────────────────────
        // Daily consumption rates: realistic per-medicine-per-facility values.
        // Seasonal variation: ±15% using a sine wave (peak ~45 days ago, trough now)
        // This gives the trend algorithm something to detect.
        var realConsumptionSchedule = new (Guid Facility, Guid Medicine, decimal BaseRate, string Pattern)[]
        {
            // Central Facility - high-volume hub
            (SeedData.CentralFacilityId,      SeedData.ParacetamolId,     20.0m, "stable"),
            (SeedData.CentralFacilityId,      SeedData.AmoxicillinId,     14.5m, "declining"),
            (SeedData.CentralFacilityId,      SeedData.IbuprofenId,        8.0m, "stable"),
            (SeedData.CentralFacilityId,      SeedData.OmeprazoleId,       6.0m, "rising"),
            (SeedData.CentralFacilityId,      SeedData.CetirizineId,       4.5m, "seasonal"),
            (SeedData.CentralFacilityId,      SeedData.VitaminCId,         3.0m, "stable"),
            (SeedData.CentralFacilityId,      SeedData.AzithromycinId,     3.5m, "seasonal"),
            (SeedData.CentralFacilityId,      SeedData.Amoxicillin500mgId, 5.0m, "stable"),

            // East Hospital - medium volume
            (SeedData.EastHospitalFacilityId, SeedData.IbuprofenId,       12.0m, "stable"),
            (SeedData.EastHospitalFacilityId, SeedData.ParacetamolId,     15.0m, "rising"),
            (SeedData.EastHospitalFacilityId, SeedData.AmoxicillinId,      7.0m, "stable"),
            (SeedData.EastHospitalFacilityId, SeedData.Amoxicillin500mgId, 4.0m, "declining"),
            (SeedData.EastHospitalFacilityId, SeedData.OmeprazoleId,       5.0m, "stable"),
            (SeedData.EastHospitalFacilityId, SeedData.CetirizineId,       3.0m, "seasonal"),
            (SeedData.EastHospitalFacilityId, SeedData.AzithromycinId,     2.5m, "seasonal"),
            (SeedData.EastHospitalFacilityId, SeedData.VitaminCId,         2.0m, "stable"),

            // North Clinic - small clinic, focus on antibiotics
            (SeedData.NorthClinicFacilityId,  SeedData.AzithromycinId,     2.5m, "seasonal"),
            (SeedData.NorthClinicFacilityId,  SeedData.AmoxicillinId,      3.0m, "rising"),
            (SeedData.NorthClinicFacilityId,  SeedData.ParacetamolId,      5.0m, "stable"),
            (SeedData.NorthClinicFacilityId,  SeedData.IbuprofenId,        3.5m, "stable"),
            (SeedData.NorthClinicFacilityId,  SeedData.CetirizineId,       2.0m, "seasonal"),
            (SeedData.NorthClinicFacilityId,  SeedData.OmeprazoleId,       1.5m, "stable"),
            (SeedData.NorthClinicFacilityId,  SeedData.VitaminCId,         1.0m, "stable"),
            (SeedData.NorthClinicFacilityId,  SeedData.Amoxicillin500mgId, 1.5m, "stable"),

            // West Dispensary - chronic disease + OTC focus
            (SeedData.WestDispensaryFacilityId, SeedData.CetirizineId,     6.0m, "seasonal"),
            (SeedData.WestDispensaryFacilityId, SeedData.OmeprazoleId,     5.5m, "rising"),
            (SeedData.WestDispensaryFacilityId, SeedData.ParacetamolId,    8.0m, "stable"),
            (SeedData.WestDispensaryFacilityId, SeedData.IbuprofenId,      5.0m, "stable"),
            (SeedData.WestDispensaryFacilityId, SeedData.VitaminCId,       4.0m, "rising"),
            (SeedData.WestDispensaryFacilityId, SeedData.AmoxicillinId,    2.5m, "stable"),
            (SeedData.WestDispensaryFacilityId, SeedData.AzithromycinId,   1.5m, "stable"),
            (SeedData.WestDispensaryFacilityId, SeedData.Amoxicillin500mgId,2.0m,"stable"),

            // Colombo General Hospital - largest volume
            (SeedData.ColomboHospitalFacilityId, SeedData.ParacetamolId,  20.0m, "stable"),
            (SeedData.ColomboHospitalFacilityId, SeedData.Amoxicillin500mgId, 14.5m, "declining"),
            (SeedData.ColomboHospitalFacilityId, SeedData.IbuprofenId,    10.0m, "stable"),
            (SeedData.ColomboHospitalFacilityId, SeedData.AmoxicillinId,   8.0m, "rising"),
            (SeedData.ColomboHospitalFacilityId, SeedData.OmeprazoleId,    7.0m, "stable"),
            (SeedData.ColomboHospitalFacilityId, SeedData.CetirizineId,    5.0m, "seasonal"),
            (SeedData.ColomboHospitalFacilityId, SeedData.AzithromycinId,  4.0m, "seasonal"),
            (SeedData.ColomboHospitalFacilityId, SeedData.VitaminCId,      3.5m, "rising"),

            // Kandy Base Hospital - rising demand (population growth scenario)
            (SeedData.KandyHospitalFacilityId, SeedData.ParacetamolId,    16.0m, "rising"),
            (SeedData.KandyHospitalFacilityId, SeedData.AmoxicillinId,    10.0m, "rising"),
            (SeedData.KandyHospitalFacilityId, SeedData.Amoxicillin500mgId,6.0m, "stable"),
            (SeedData.KandyHospitalFacilityId, SeedData.IbuprofenId,       8.0m, "stable"),
            (SeedData.KandyHospitalFacilityId, SeedData.OmeprazoleId,      5.0m, "rising"),
            (SeedData.KandyHospitalFacilityId, SeedData.CetirizineId,      4.0m, "seasonal"),
            (SeedData.KandyHospitalFacilityId, SeedData.AzithromycinId,    3.0m, "rising"),
            (SeedData.KandyHospitalFacilityId, SeedData.VitaminCId,        2.5m, "stable"),

            // ── Extended formulary: chronic-care & essential medicines ─────────
            // Metformin 500 mg: high-volume chronic-care, rising with diabetes prevalence
            (SeedData.CentralFacilityId,         SeedData.MetforminId,    28.0m, "rising"),
            (SeedData.EastHospitalFacilityId,    SeedData.MetforminId,    20.0m, "rising"),
            (SeedData.NorthClinicFacilityId,     SeedData.MetforminId,     8.0m, "stable"),
            (SeedData.WestDispensaryFacilityId,  SeedData.MetforminId,    18.0m, "rising"),
            (SeedData.ColomboHospitalFacilityId, SeedData.MetforminId,    25.0m, "rising"),
            (SeedData.KandyHospitalFacilityId,   SeedData.MetforminId,    15.0m, "rising"),

            // Atorvastatin 20 mg: steady lipid-lowering therapy
            (SeedData.CentralFacilityId,         SeedData.AtorvastatinId, 14.0m, "stable"),
            (SeedData.EastHospitalFacilityId,    SeedData.AtorvastatinId,  9.0m, "stable"),
            (SeedData.NorthClinicFacilityId,     SeedData.AtorvastatinId,  4.0m, "stable"),
            (SeedData.WestDispensaryFacilityId,  SeedData.AtorvastatinId, 12.0m, "rising"),
            (SeedData.ColomboHospitalFacilityId, SeedData.AtorvastatinId, 16.0m, "stable"),
            (SeedData.KandyHospitalFacilityId,   SeedData.AtorvastatinId,  7.0m, "stable"),

            // Metronidazole 400 mg: episodic antibiotic, seasonal peaks
            (SeedData.CentralFacilityId,         SeedData.MetronidazoleId, 7.0m, "seasonal"),
            (SeedData.EastHospitalFacilityId,    SeedData.MetronidazoleId, 5.0m, "seasonal"),
            (SeedData.NorthClinicFacilityId,     SeedData.MetronidazoleId, 2.5m, "seasonal"),
            (SeedData.WestDispensaryFacilityId,  SeedData.MetronidazoleId, 4.0m, "seasonal"),
            (SeedData.ColomboHospitalFacilityId, SeedData.MetronidazoleId, 8.0m, "seasonal"),
            (SeedData.KandyHospitalFacilityId,   SeedData.MetronidazoleId, 5.5m, "seasonal"),

            // Dexamethasone 4 mg: acute use, highly variable (stable mean with jitter)
            (SeedData.CentralFacilityId,         SeedData.DexamethasoneId, 3.5m, "stable"),
            (SeedData.EastHospitalFacilityId,    SeedData.DexamethasoneId, 2.5m, "stable"),
            (SeedData.NorthClinicFacilityId,     SeedData.DexamethasoneId, 1.0m, "stable"),
            (SeedData.ColomboHospitalFacilityId, SeedData.DexamethasoneId, 4.0m, "stable"),
            (SeedData.KandyHospitalFacilityId,   SeedData.DexamethasoneId, 2.0m, "stable"),

            // Salbutamol Inhaler: seasonal respiratory peaks (flu season)
            (SeedData.CentralFacilityId,         SeedData.SalbutamolId,    2.0m, "seasonal"),
            (SeedData.EastHospitalFacilityId,    SeedData.SalbutamolId,    1.5m, "seasonal"),
            (SeedData.NorthClinicFacilityId,     SeedData.SalbutamolId,    1.0m, "seasonal"),
            (SeedData.WestDispensaryFacilityId,  SeedData.SalbutamolId,    2.5m, "seasonal"),
            (SeedData.ColomboHospitalFacilityId, SeedData.SalbutamolId,    2.0m, "seasonal"),
            (SeedData.KandyHospitalFacilityId,   SeedData.SalbutamolId,    1.5m, "seasonal"),

            // Morphine Sulfate 10 mg: tightly controlled, very low and stable
            (SeedData.CentralFacilityId,         SeedData.MorphineId,      1.2m, "stable"),
            (SeedData.EastHospitalFacilityId,    SeedData.MorphineId,      0.8m, "stable"),
            (SeedData.ColomboHospitalFacilityId, SeedData.MorphineId,      1.5m, "stable"),
            (SeedData.KandyHospitalFacilityId,   SeedData.MorphineId,      0.9m, "stable"),

            // Diclofenac 50 mg: analgesic/anti-inflammatory, declining as IBU preferred
            (SeedData.CentralFacilityId,         SeedData.DiclofenacId,   10.0m, "declining"),
            (SeedData.EastHospitalFacilityId,    SeedData.DiclofenacId,    7.0m, "declining"),
            (SeedData.NorthClinicFacilityId,     SeedData.DiclofenacId,    3.5m, "stable"),
            (SeedData.WestDispensaryFacilityId,  SeedData.DiclofenacId,    8.0m, "declining"),
            (SeedData.ColomboHospitalFacilityId, SeedData.DiclofenacId,   12.0m, "declining"),
            (SeedData.KandyHospitalFacilityId,   SeedData.DiclofenacId,    6.0m, "stable"),

            // ORS Sachet: oral rehydration, strong seasonal peaks (diarrhoeal disease)
            (SeedData.CentralFacilityId,         SeedData.OrsSachetId,    18.0m, "seasonal"),
            (SeedData.EastHospitalFacilityId,    SeedData.OrsSachetId,    14.0m, "seasonal"),
            (SeedData.NorthClinicFacilityId,     SeedData.OrsSachetId,     7.0m, "seasonal"),
            (SeedData.WestDispensaryFacilityId,  SeedData.OrsSachetId,    10.0m, "seasonal"),
            (SeedData.ColomboHospitalFacilityId, SeedData.OrsSachetId,    22.0m, "seasonal"),
            (SeedData.KandyHospitalFacilityId,   SeedData.OrsSachetId,    12.0m, "seasonal"),

            // ── Added clinical formulary schedules ──────────────────────────────
            // Ciprofloxacin 500 mg: broad antibiotic, acute surges
            (SeedData.CentralFacilityId,         DemoVolumeSeed.CiprofloxacinId,  16.0m, "rising"),
            (SeedData.EastHospitalFacilityId,    DemoVolumeSeed.CiprofloxacinId,  11.0m, "seasonal"),
            (SeedData.NorthClinicFacilityId,     DemoVolumeSeed.CiprofloxacinId,   4.0m, "seasonal"),
            (SeedData.WestDispensaryFacilityId,  DemoVolumeSeed.CiprofloxacinId,   6.5m, "rising"),
            (SeedData.ColomboHospitalFacilityId, DemoVolumeSeed.CiprofloxacinId,  18.0m, "rising"),
            (SeedData.KandyHospitalFacilityId,   DemoVolumeSeed.CiprofloxacinId,   9.0m, "seasonal"),

            // Insulin Regular 100IU/ml: critical endocrine chronic care
            (SeedData.CentralFacilityId,         DemoVolumeSeed.InsulinRegularId,  8.0m, "stable"),
            (SeedData.EastHospitalFacilityId,    DemoVolumeSeed.InsulinRegularId,  5.0m, "stable"),
            (SeedData.NorthClinicFacilityId,     DemoVolumeSeed.InsulinRegularId,  2.0m, "stable"),
            (SeedData.WestDispensaryFacilityId,  DemoVolumeSeed.InsulinRegularId,  4.5m, "stable"),
            (SeedData.ColomboHospitalFacilityId, DemoVolumeSeed.InsulinRegularId, 12.0m, "rising"),
            (SeedData.KandyHospitalFacilityId,   DemoVolumeSeed.InsulinRegularId,  6.0m, "stable"),

            // Omeprazole IV 40 mg: inpatient acute care
            (SeedData.CentralFacilityId,         DemoVolumeSeed.OmeprazoleIvId,    6.0m, "stable"),
            (SeedData.EastHospitalFacilityId,    DemoVolumeSeed.OmeprazoleIvId,    4.0m, "stable"),
            (SeedData.ColomboHospitalFacilityId, DemoVolumeSeed.OmeprazoleIvId,    8.5m, "stable"),
            (SeedData.KandyHospitalFacilityId,   DemoVolumeSeed.OmeprazoleIvId,    4.5m, "stable"),

            // Furosemide 40 mg: cardiac care and diuresis
            (SeedData.CentralFacilityId,         DemoVolumeSeed.FurosemideId,     10.0m, "stable"),
            (SeedData.EastHospitalFacilityId,    DemoVolumeSeed.FurosemideId,      6.0m, "stable"),
            (SeedData.NorthClinicFacilityId,     DemoVolumeSeed.FurosemideId,      3.0m, "stable"),
            (SeedData.WestDispensaryFacilityId,  DemoVolumeSeed.FurosemideId,      7.0m, "stable"),
            (SeedData.ColomboHospitalFacilityId, DemoVolumeSeed.FurosemideId,     14.0m, "rising"),
            (SeedData.KandyHospitalFacilityId,   DemoVolumeSeed.FurosemideId,      5.5m, "stable"),

            // Heparin Sodium 5000IU/ml: high-acuity surgical / ICU
            (SeedData.CentralFacilityId,         DemoVolumeSeed.HeparinSodiumId,   3.0m, "stable"),
            (SeedData.EastHospitalFacilityId,    DemoVolumeSeed.HeparinSodiumId,   1.5m, "stable"),
            (SeedData.ColomboHospitalFacilityId, DemoVolumeSeed.HeparinSodiumId,   4.5m, "stable"),
            (SeedData.KandyHospitalFacilityId,   DemoVolumeSeed.HeparinSodiumId,   2.0m, "stable"),

            // Ceftriaxone 1g IV: hospital-wide broad spectrum antibiotic
            (SeedData.CentralFacilityId,         DemoVolumeSeed.CeftriaxoneId,    12.0m, "seasonal"),
            (SeedData.EastHospitalFacilityId,    DemoVolumeSeed.CeftriaxoneId,     8.0m, "seasonal"),
            (SeedData.NorthClinicFacilityId,     DemoVolumeSeed.CeftriaxoneId,     2.5m, "seasonal"),
            (SeedData.ColomboHospitalFacilityId, DemoVolumeSeed.CeftriaxoneId,    15.0m, "rising"),
            (SeedData.KandyHospitalFacilityId,   DemoVolumeSeed.CeftriaxoneId,     7.0m, "seasonal"),
        };


        foreach (var (facility, medicine, baseRate, pattern) in realConsumptionSchedule)
        {
            for (var d = WindowDays; d >= 1; d--)
            {
                var qty = pattern switch
                {
                    "rising"    => decimal.Round(baseRate * (0.7m + (0.6m * (WindowDays - d) / WindowDays)), 2),
                    "declining" => decimal.Round(baseRate * (1.3m - (0.6m * (WindowDays - d) / WindowDays)), 2),
                    "seasonal"  => decimal.Round(baseRate * (1m + 0.2m * (decimal)Math.Sin(2 * Math.PI * d / 30.0)), 2),
                    // Deterministic jitter: a stable hash of the series and day, so a
                    // re-run reproduces exactly the same history instead of a new
                    // Random() draw that would make the seed non-reproducible.
                    _ => decimal.Round(baseRate * (0.9m + 0.2m * Jitter(facility, medicine, d)), 2),
                };
                Add(facility, medicine, today.AddDays(-d), Math.Max(0.5m, qty), $"Seeded {pattern} consumption pattern");
            }
        }

        if (records.Count > 0)
        {
            db.ConsumptionRecords.AddRange(records);
        }
    }

    /// <summary>
    /// Stable per-series, per-day jitter in [0, 1), derived from a hash rather than a
    /// random generator, so the seed is fully deterministic and reproducible.
    /// </summary>
    private static decimal Jitter(Guid facilityId, Guid medicineId, int day)
    {
        var hash = HashCode.Combine(facilityId, medicineId, day * 31);
        // Map to an unsigned value in [0, 1).
        return (uint)hash / (decimal)uint.MaxValue;
    }

    private static ConsumptionRecord MakeRecord(Guid facilityId, Guid medicineId, DateTime date, decimal qty, string source, string notes) =>
        new()
        {
            Id = Guid.NewGuid(),
            FacilityId = facilityId,
            MedicineId = medicineId,
            QuantityUsed = qty,
            ConsumptionDate = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            Source = source,
            Notes = notes,
            CreatedAt = DateTime.UtcNow
        };
}

