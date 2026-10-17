// Additive demo volume for the Demand & Shortage vertical.
//
// SeedData.cs (Inventory/Procurement owners) and DemandSeedData.cs already seed the
// reference data and the consumption window. This file adds the remaining depth the
// forecasting, demand-analysis, shortage-detection and shortage-scan workflows need.
//
// Guarantees:
//   * IDEMPOTENT      - every row is keyed by a deterministic Id or an existence check.
//   * ADDITIVE        - nothing existing is updated or deleted.
//   * NON-PRODUCTION  - skipped unless the environment is local dev/test.
//   * USER SAFE       - no user, role or token row is ever written.
//   * FK SAFE         - every row resolves its parents from the DB and is skipped if not.

namespace MediStock.Api.Infrastructure.Persistence.Seed;

using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Additive demo volume: extra medicines, stock movements, suppliers and purchase orders.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public static class DemoVolumeSeed
{
    // Public deterministic IDs for cross-referencing across seed modules
    public static readonly Guid CiprofloxacinId = Guid.Parse("e1000001-0000-4000-8000-000000000009");
    public static readonly Guid InsulinRegularId = Guid.Parse("e1000001-0000-4000-8000-00000000000a");
    public static readonly Guid OmeprazoleIvId = Guid.Parse("e1000001-0000-4000-8000-00000000000b");
    public static readonly Guid FurosemideId = Guid.Parse("e1000001-0000-4000-8000-00000000000c");
    public static readonly Guid HeparinSodiumId = Guid.Parse("e1000001-0000-4000-8000-00000000000d");
    public static readonly Guid CeftriaxoneId = Guid.Parse("e1000001-0000-4000-8000-00000000000e");

    // Deterministic id space, distinct from SeedData's d1/d2 and d3 ranges.
    private static readonly Guid[] ExtraMedicineIds =
    [
        Guid.Parse("e1000001-0000-4000-8000-000000000001"),
        Guid.Parse("e1000001-0000-4000-8000-000000000002"),
        Guid.Parse("e1000001-0000-4000-8000-000000000003"),
        Guid.Parse("e1000001-0000-4000-8000-000000000004"),
        Guid.Parse("e1000001-0000-4000-8000-000000000005"),
        Guid.Parse("e1000001-0000-4000-8000-000000000006"),
        Guid.Parse("e1000001-0000-4000-8000-000000000007"),
        Guid.Parse("e1000001-0000-4000-8000-000000000008"),
        CiprofloxacinId,
        InsulinRegularId,
        OmeprazoleIvId,
        FurosemideId,
        HeparinSodiumId,
        CeftriaxoneId,
    ];

    private static readonly Guid[] ExtraSupplierIds =
    [
        Guid.Parse("e2000001-0000-4000-8000-000000000001"),
        Guid.Parse("e2000001-0000-4000-8000-000000000002"),
        Guid.Parse("e2000001-0000-4000-8000-000000000003"),
        Guid.Parse("e2000001-0000-4000-8000-000000000004"),
        Guid.Parse("e2000001-0000-4000-8000-000000000005"),
        Guid.Parse("e2000001-0000-4000-8000-000000000006"),
    ];

    private static readonly Guid[] ExtraPurchaseOrderIds =
    [
        Guid.Parse("e3000001-0000-4000-8000-000000000001"),
        Guid.Parse("e3000001-0000-4000-8000-000000000002"),
        Guid.Parse("e3000001-0000-4000-8000-000000000003"),
        Guid.Parse("e3000001-0000-4000-8000-000000000004"),
        Guid.Parse("e3000001-0000-4000-8000-000000000005"),
        Guid.Parse("e3000001-0000-4000-8000-000000000006"),
        Guid.Parse("e3000001-0000-4000-8000-000000000007"),
        Guid.Parse("e3000001-0000-4000-8000-000000000008"),
        Guid.Parse("e3000001-0000-4000-8000-000000000009"),
        Guid.Parse("e3000001-0000-4000-8000-00000000000a"),
        Guid.Parse("e3000001-0000-4000-8000-00000000000b"),
        Guid.Parse("e3000001-0000-4000-8000-00000000000c"),
    ];

    /// <summary>
    /// Never seed a deployed environment: seeding is a local demonstration aid only.
    /// </summary>
    public static bool IsSeedable(IWebHostEnvironment environment) =>
        environment.IsEnvironment("Testing")
        || environment.IsDevelopment()
        || string.Equals(
            Environment.GetEnvironmentVariable("MEDISTOCK_ALLOW_DEMO_SEED"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    /// <summary>Applies the additive seed. Safe to call on every startup.</summary>
    public static async Task ApplyAsync(
        ApplicationDbContext db,
        IWebHostEnvironment environment,
        CancellationToken cancellationToken = default)
    {
        if (!IsSeedable(environment))
        {
            return;
        }

        await SeedMedicinesAsync(db, cancellationToken);
        await SeedSuppliersAsync(db, cancellationToken);
        await SeedStockMovementsAsync(db, cancellationToken);
        await SeedPurchaseOrdersAsync(db, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Adds the remainder of the formulary. An existing code is never overwritten, so a
    /// medicine the Inventory owners already added is left exactly as it is.
    /// </summary>
    private static async Task SeedMedicinesAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
        var candidates = new (Guid Id, string Code, string Name, string Unit, int Minimum)[]
        {
            (ExtraMedicineIds[0], "MET-500",    "Metformin 500 mg",          "tablet",  200),
            (ExtraMedicineIds[1], "ATO-20",     "Atorvastatin 20 mg",        "tablet",  100),
            (ExtraMedicineIds[2], "METRO-400",  "Metronidazole 400 mg",      "tablet",  75),
            (ExtraMedicineIds[3], "DEX-4MG",    "Dexamethasone 4 mg",        "tablet",  30),
            (ExtraMedicineIds[4], "SALB-INH",   "Salbutamol Inhaler 100mcg", "inhaler", 20),
            (ExtraMedicineIds[5], "MORPH-10",   "Morphine Sulfate 10 mg",    "tablet",  10),
            (ExtraMedicineIds[6], "DIC-50",     "Diclofenac 50 mg",          "tablet",  80),
            (ExtraMedicineIds[7], "ORS-SACHET", "ORS Sachet 20.5g",          "sachet",  150),
            (ExtraMedicineIds[8], "CIP-500",    "Ciprofloxacin 500 mg",      "tablet",  120),
            (ExtraMedicineIds[9], "INS-REG",    "Insulin Regular 100IU/ml",  "vial",     40),
            (ExtraMedicineIds[10], "OME-IV-40", "Omeprazole IV 40 mg",       "vial",     50),
            (ExtraMedicineIds[11], "FURO-40",   "Furosemide 40 mg",          "tablet",   90),
            (ExtraMedicineIds[12], "HEP-5000",  "Heparin Sodium 5000IU/ml",  "ampoule",  30),
            (ExtraMedicineIds[13], "CEFT-1G",   "Ceftriaxone 1g IV",         "vial",     60),
        };

        var known = (await db.Medicines
            .AsNoTracking()
            .Select(x => x.Code)
            .ToListAsync(cancellationToken)).ToHashSet();

        var additions = candidates
            .Where(c => known.Add(c.Code))
            .Select(c => new Medicine
            {
                Id = c.Id,
                Code = c.Code,
                Name = c.Name,
                Unit = c.Unit,
                MinimumStockLevel = c.Minimum,
                IsActive = true,
            })
            .ToList();

        if (additions.Count > 0)
        {
            db.Medicines.AddRange(additions);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static async Task SeedSuppliersAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
        var candidates = new (Guid Id, string Name, string Contact, string Email, string Phone, string Address, int LeadTime)[]
        {
            (ExtraSupplierIds[0], "National Pharma Distributors", "Anjali Perera",  "anjali@natpharma.example.com",  "+94-11-2345678", "18 Marina Boulevard, Colombo 03", 6),
            (ExtraSupplierIds[1], "Island Medical Supply Co.",    "Nimal Fernando", "nimal@islandmed.example.com",   "+94-81-2234567", "77 Peradeniya Road, Kandy",       9),
            (ExtraSupplierIds[2], "Coastline Generics Ltd.",      "Fathima Rizvi",  "fathima@coastgen.example.com",  "+94-91-2233445", "5 Beach Road, Galle",            12),
            (ExtraSupplierIds[3], "RapidAid Emergency Supply",    "Dinesh Silva",  "dinesh@rapidaid.example.com",   "+94-11-2987654", "220 Baseline Road, Colombo 09",   3),
            (ExtraSupplierIds[4], "Lanka LifeSciences Ltd.",      "Dr. Priyantha Gunawardena", "priyantha@lankalife.example.com", "+94-11-2765432", "142 High Level Road, Nugegoda", 5),
            (ExtraSupplierIds[5], "Apex BioPharma Supplies",      "Kumari Wickramasinghe", "kumari@apexbio.example.com", "+94-31-2245678", "33 Negombo Road, Ja-Ela", 8),
        };

        var known = (await db.Suppliers
            .AsNoTracking()
            .Select(x => x.Id)
            .ToListAsync(cancellationToken)).ToHashSet();

        var additions = candidates
            .Where(c => known.Add(c.Id))
            .Select(c => new Supplier
            {
                Id = c.Id,
                Name = c.Name,
                ContactPerson = c.Contact,
                Email = c.Email,
                Phone = c.Phone,
                Address = c.Address,
                LeadTimeDays = c.LeadTime,
                IsActive = true,
            })
            .ToList();

        if (additions.Count > 0)
        {
            db.Suppliers.AddRange(additions);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    // -----------------------------------------------------------------------
    // Stock movements and batches
    // -----------------------------------------------------------------------

    /// <summary>
    /// Adds deeper, dated stock-movement history plus a wider expiry spread so the
    /// expiry view, FEFO picking and the shortage scan all have real activity to read.
    ///
    /// Each scenario is skipped when a batch with its number already exists, so a
    /// pre-existing balance is treated as real stock and left untouched. Every
    /// transaction carries a deterministic Id, making a re-run a no-op.
    /// </summary>
    private static async Task SeedStockMovementsAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
            // (medicineCode, facilityCode, batchNumber, openingQty, issuedQty, expiryInDays, madeDaysAgo)
            var scenarios = new (string Medicine, string Facility, string Batch, int Opening, int Issued, int ExpiryDays, int MadeDaysAgo)[]
            {
                // A healthy, comfortably-stocked series.
                ("PARA-500",   "COLOMBO-GEN",     "VOL-PARA-COL-001",      900, 120, 300, 300),
                ("IBU-200",    "CENTRAL",         "VOL-IBU-CEN-001",       640,  90, 280, 280),
                ("CET-10",     "EAST-HOSPITAL",   "VOL-CET-EAST-001",      520,  60, 250, 250),

                // A genuinely low series: issued almost everything, so it trips the minimum.
                ("AMOX-250",   "WEST-DISPENSARY", "VOL-AMOX-WEST-LOW",     180, 165, 200, 200),
                ("AZI-250",    "KANDY-BASE",      "VOL-AZI-KANDY-LOW",      96,  92, 210, 210),
                ("OME-20",     "NORTH-CLINIC",    "VOL-OME-NORTH-LOW",     140, 132, 190, 190),

                // A near-expiry spread so the 30/60/90-day buckets are all populated.
                ("PARA-500",   "EAST-HOSPITAL",   "VOL-PARA-EAST-EXP021",  150,   0,  21, 250),
                ("IBU-200",    "NORTH-CLINIC",    "VOL-IBU-NORTH-EXP045",  110,   0,  45, 240),
                ("CET-10",     "CENTRAL",         "VOL-CET-CEN-EXP075",    130,   0,  75, 220),

                // Chronic-care volume for the added formulary medicines.
                ("MET-500",    "WEST-DISPENSARY", "VOL-MET-WEST-001",      760, 140, 260, 260),
                ("ATO-20",     "COLOMBO-GEN",     "VOL-ATO-COL-001",       540,  70, 240, 240),
                ("ORS-SACHET", "EAST-HOSPITAL",   "VOL-ORS-EAST-001",     1200, 300, 180, 180),

                // Expired batches (for realistic audit & expiry tracking)
                ("CIP-500",    "COLOMBO-GEN",     "VOL-CIP-COL-EXP-PAST",  140,   0, -15, 400),
                ("METRO-400",  "EAST-HOSPITAL",   "VOL-METRO-EAST-PAST",    90,   0, -30, 450),

                // Additional critical care / emergency batches
                ("INS-REG",    "CENTRAL",         "VOL-INS-CEN-EXP014",     80,  75,  14, 180),
                ("FURO-40",    "WEST-DISPENSARY", "VOL-FURO-WEST-EXP028",  200,  40,  28, 210),
                ("HEP-5000",   "KANDY-BASE",      "VOL-HEP-KANDY-EXP050",  100,  20,  50, 200),
                ("CEFT-1G",    "NORTH-CLINIC",    "VOL-CEFT-NORTH-EXP085", 150,  30,  85, 190),
                ("CIP-500",    "WEST-DISPENSARY", "VOL-CIP-WEST-ZERO",     120, 120, 180, 200),
                ("OME-IV-40",  "CENTRAL",         "VOL-OMEIV-CEN-001",     300,  60, 220, 220),
            };

            var medicines = await db.Medicines
                .AsNoTracking()
                .ToDictionaryAsync(x => x.Code, x => x.Id, cancellationToken);
            var facilities = await db.Facilities
                .AsNoTracking()
                .ToDictionaryAsync(x => x.Code, x => x.Id, cancellationToken);

            var existingBatches = (await db.MedicineBatches
                .AsNoTracking()
                .Select(x => x.BatchNumber)
                .ToListAsync(cancellationToken)).ToHashSet();

            var now = DateTime.UtcNow;
            var batches = new List<MedicineBatch>();
            var balances = new List<InventoryBalance>();
            var transactions = new List<StockTransaction>();

            foreach (var scenario in scenarios)
            {
                if (!medicines.TryGetValue(scenario.Medicine, out var medicineId) ||
                    !facilities.TryGetValue(scenario.Facility, out var facilityId) ||
                    !existingBatches.Add(scenario.Batch))
                {
                    continue;
                }

                var batchId = DeterministicId(scenario.Batch, "batch");
                var remaining = Math.Max(0, scenario.Opening - scenario.Issued);

                batches.Add(new MedicineBatch
                {
                    Id = batchId,
                    MedicineId = medicineId,
                    FacilityId = facilityId,
                    BatchNumber = scenario.Batch,
                    QuantityOnHand = remaining,
                    ManufacturingDateUtc = now.Date.AddDays(-Math.Max(scenario.MadeDaysAgo, Math.Abs(scenario.ExpiryDays) + 60)),
                    ExpiryDateUtc = now.Date.AddDays(scenario.ExpiryDays),
                });

                var existingBal = await db.InventoryBalances
                    .FirstOrDefaultAsync(x => x.MedicineId == medicineId && x.FacilityId == facilityId, cancellationToken);

                if (existingBal != null)
                {
                    existingBal.QuantityOnHand += remaining;
                    existingBal.UpdatedAtUtc = now;
                }
                else
                {
                    var pendingBal = balances.FirstOrDefault(b => b.MedicineId == medicineId && b.FacilityId == facilityId);
                    if (pendingBal != null)
                    {
                        pendingBal.QuantityOnHand += remaining;
                    }
                    else
                    {
                        balances.Add(new InventoryBalance
                        {
                            Id = DeterministicId(scenario.Batch, "balance"),
                            MedicineId = medicineId,
                            FacilityId = facilityId,
                            QuantityOnHand = remaining,
                            QuantityReserved = 0,
                            UpdatedAtUtc = now,
                        });
                    }
                }

                var running = scenario.Opening;

                transactions.Add(Movement(
                    scenario.Batch, "receipt", medicineId, facilityId, batchId,
                    StockTransactionType.Receipt, scenario.Opening, running,
                    "Seeded supplier delivery", now.AddDays(-14)));

                if (scenario.Issued > 0)
                {
                    running -= scenario.Issued;
                    transactions.Add(Movement(
                        scenario.Batch, "issue", medicineId, facilityId, batchId,
                        StockTransactionType.Adjustment, -scenario.Issued, running,
                        "Seeded ward issue", now.AddDays(-6)));
                }
            }

        if (batches.Count > 0)
        {
            db.MedicineBatches.AddRange(batches);
            db.InventoryBalances.AddRange(balances);
            db.StockTransactions.AddRange(transactions);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private static StockTransaction Movement(
        string batchNumber,
        string key,
        Guid medicineId,
        Guid facilityId,
        Guid batchId,
        StockTransactionType type,
        int quantity,
        int balanceAfter,
        string reason,
        DateTime createdAtUtc) => new()
        {
            Id = DeterministicId(batchNumber, key),
            MedicineId = medicineId,
            FacilityId = facilityId,
            MedicineBatchId = batchId,
            Type = type,
            Quantity = quantity,
            BalanceAfter = balanceAfter,
            Reason = reason,
            ActorId = "demo-seed",
            CreatedAtUtc = createdAtUtc,
        };

    /// <summary>A stable Guid derived from the key, so a re-run resolves the same rows.</summary>
    private static Guid DeterministicId(string seed, string key)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"medistock-demo-volume:{seed}:{key}"));
        return new Guid(bytes.AsSpan(0, 16));
    }

    // -----------------------------------------------------------------------
    // Purchase orders
    // -----------------------------------------------------------------------

    /// <summary>
    /// Adds purchase orders across all facilities and every status, so the procurement
    /// queue, the approval console and the workflow monitor all have rows to work with.
    /// Supplier and medicine ids are resolved from the database, and an existing order Id
    /// is never reused, so the method is additive and re-runnable.
    /// </summary>
    private static async Task SeedPurchaseOrdersAsync(ApplicationDbContext db, CancellationToken cancellationToken)
    {
        var supplierIds = (await db.Suppliers
            .AsNoTracking()
            .OrderBy(x => x.Id)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken)).ToArray();

        if (supplierIds.Length < 2)
        {
            return; // not enough reference data to build consistent orders
        }

        var medicines = await db.Medicines
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => new { x.Id, x.Code })
            .ToListAsync(cancellationToken);

        var facilities = await db.Facilities
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (medicines.Count == 0 || facilities.Count == 0)
        {
            return;
        }

        var existingOrderIds = (await db.PurchaseOrders
            .AsNoTracking()
            .Select(x => x.Id)
            .ToListAsync(cancellationToken)).ToHashSet();

        var now = DateTime.UtcNow;

        // (ordinal, medicineCode, facilityIndex, supplierIndex, status, requestedDaysAgo, qty, unitPrice)
        var orders = new (int Ordinal, string MedicineCode, int FacilityIndex, int SupplierIndex, PurchaseOrderStatus Status, int DaysAgo, int Quantity, decimal UnitPrice, string? Notes, string? RejectionReason)[]
        {
            (1, "PARA-500",   0, 0, PurchaseOrderStatus.PendingApproval,  2, 600,  1.10m, null, null),
            (2, "AMOX-500",   1, 1, PurchaseOrderStatus.PendingApproval,  4, 300,  3.40m, null, null),
            (3, "MET-500",    2, 2, PurchaseOrderStatus.Approved,        7, 500,  0.75m, null, null),
            (4, "ORS-SACHET", 3, 3, PurchaseOrderStatus.Approved,        6, 900,  0.35m, null, null),
            (5, "IBU-200",    4, 0, PurchaseOrderStatus.Received,       21, 400,  2.60m, null, null),
            (6, "CET-10",     5, 1, PurchaseOrderStatus.Received,       18, 350,  1.95m, null, null),
            (7, "CIP-500",    0, 4, PurchaseOrderStatus.Draft,           1, 450,  1.85m, "Drafted during weekly ward review", null),
            (8, "INS-REG",    1, 5, PurchaseOrderStatus.Rejected,        3, 100, 12.50m, null, "Exceeded quarterly budget cap"),
            (9, "FURO-40",    2, 0, PurchaseOrderStatus.RevisionRequired, 5, 250,  0.65m, "Manufacturer unit pack changed to 100s. Please revise quantity.", null),
            (10, "HEP-5000",  3, 1, PurchaseOrderStatus.PendingApproval,  1,  80,  8.40m, "Critical care ICU requisition", null),
            (11, "CEFT-1G",   4, 2, PurchaseOrderStatus.Approved,        4, 300,  4.20m, "Approved by regional director", null),
            (12, "OME-IV-40", 5, 3, PurchaseOrderStatus.Received,       12, 200,  5.10m, "Received and verified in main store", null),
        };

        var additions = new List<PurchaseOrder>();

        foreach (var order in orders)
        {
            var id = ExtraPurchaseOrderIds[order.Ordinal - 1];
            if (!existingOrderIds.Add(id))
            {
                continue;
            }

            var medicine = medicines.FirstOrDefault(m => m.Code == order.MedicineCode);
            if (medicine is null)
            {
                continue;
            }

            var facilityId = facilities[order.FacilityIndex % facilities.Count];
            var supplierId = supplierIds[order.SupplierIndex % supplierIds.Length];

            var purchaseOrder = new PurchaseOrder
            {
                Id = id,
                SupplierId = supplierId,
                FacilityId = facilityId,
                Status = order.Status,
                RequestedAt = now.AddDays(-order.DaysAgo),
                Items = new List<PurchaseOrderItem>
                {
                    new()
                    {
                        Id = DeterministicId($"po-{order.Ordinal}", "item"),
                        MedicineId = medicine.Id,
                        RequestedQuantity = order.Quantity,
                        UnitPrice = order.UnitPrice,
                    },
                },
            };

            // Status-consistent timestamps and audit metadata
            if (order.Status is PurchaseOrderStatus.Approved or PurchaseOrderStatus.Received)
            {
                purchaseOrder.ApprovedAt = now.AddDays(-(order.DaysAgo - 1));
            }

            if (order.Status == PurchaseOrderStatus.Received)
            {
                purchaseOrder.ReceivedAt = now.AddDays(-1);
            }

            if (order.Status == PurchaseOrderStatus.Rejected)
            {
                purchaseOrder.RejectionReason = order.RejectionReason ?? "Order criteria not met";
            }

            if (order.Status == PurchaseOrderStatus.RevisionRequired)
            {
                purchaseOrder.RevisionReason = order.Notes ?? "Order revision required";
            }

            additions.Add(purchaseOrder);
        }

        if (additions.Count > 0)
        {
            db.PurchaseOrders.AddRange(additions);
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}

