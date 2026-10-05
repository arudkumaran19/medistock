using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;

namespace MediStock.Api.Infrastructure.Persistence.Seed;

public static class SeedData
{
    // Supplier IDs
    public static readonly Guid Supplier1Id = Guid.Parse("d1000001-0000-4000-8000-000000000001");
    public static readonly Guid Supplier2Id = Guid.Parse("d1000002-0000-4000-8000-000000000002");
    public static readonly Guid Supplier3Id = Guid.Parse("d1000003-0000-4000-8000-000000000003");
    public static readonly Guid Supplier4Id = Guid.Parse("d1000004-0000-4000-8000-000000000004");

    // Purchase Order IDs
    public static readonly Guid Po1Id = Guid.Parse("d2000001-0000-4000-8000-000000000001");
    public static readonly Guid Po2Id = Guid.Parse("d2000002-0000-4000-8000-000000000002");
    public static readonly Guid Po3Id = Guid.Parse("d2000003-0000-4000-8000-000000000003");
    public static readonly Guid Po4Id = Guid.Parse("d2000004-0000-4000-8000-000000000004");
    public static readonly Guid Po5Id = Guid.Parse("d2000005-0000-4000-8000-000000000005");
    public static readonly Guid Po6Id = Guid.Parse("d2000006-0000-4000-8000-000000000006");

	public static readonly Guid CentralFacilityId = Guid.Parse("11111111-1111-1111-1111-111111111111");
	public static readonly Guid NorthClinicFacilityId = Guid.Parse("88888888-8888-8888-8888-888888888888");
	public static readonly Guid EastHospitalFacilityId = Guid.Parse("99999999-9999-9999-9999-999999999999");
	public static readonly Guid WestDispensaryFacilityId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
	public static readonly Guid ParacetamolId = Guid.Parse("22222222-2222-2222-2222-222222222222");
	public static readonly Guid AmoxicillinId = Guid.Parse("33333333-3333-3333-3333-333333333333");
	public static readonly Guid IbuprofenId = Guid.Parse("44444444-4444-4444-4444-444444444444");
	public static readonly Guid CetirizineId = Guid.Parse("55555555-5555-5555-5555-555555555555");
	public static readonly Guid OmeprazoleId = Guid.Parse("66666666-6666-6666-6666-666666666666");
	public static readonly Guid AzithromycinId = Guid.Parse("77777777-7777-7777-7777-777777777777");
	public static readonly Guid VitaminCId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

	public static void Apply(ApplicationDbContext db)
	{
		var facilities = new[]
		{
			new Facility { Id = CentralFacilityId, Code = "CENTRAL", Name = "Central Facility", Address = "Demo address" },
			new Facility { Id = NorthClinicFacilityId, Code = "NORTH-CLINIC", Name = "Northside Community Clinic", Address = "12 North Avenue" },
			new Facility { Id = EastHospitalFacilityId, Code = "EAST-HOSPITAL", Name = "Eastview General Hospital", Address = "88 Sunrise Road" },
			new Facility { Id = WestDispensaryFacilityId, Code = "WEST-DISPENSARY", Name = "Westgate Public Dispensary", Address = "41 Market Street" }
		};
		var existingFacilityCodes = db.Facilities.Select(x => x.Code).ToHashSet();
		db.Facilities.AddRange(facilities.Where(x => !existingFacilityCodes.Contains(x.Code)));

		var medicines = new[]
		{
			new Medicine { Id = ParacetamolId, Code = "PARA-500", Name = "Paracetamol 500 mg", Unit = "tablet", MinimumStockLevel = 100 },
			new Medicine { Id = AmoxicillinId, Code = "AMOX-250", Name = "Amoxicillin 250 mg", Unit = "capsule", MinimumStockLevel = 50 },
			new Medicine { Id = IbuprofenId, Code = "IBU-200", Name = "Ibuprofen 200 mg", Unit = "tablet", MinimumStockLevel = 100 },
			new Medicine { Id = CetirizineId, Code = "CET-10", Name = "Cetirizine 10 mg", Unit = "tablet", MinimumStockLevel = 50 },
			new Medicine { Id = OmeprazoleId, Code = "OME-20", Name = "Omeprazole 20 mg", Unit = "capsule", MinimumStockLevel = 50 },
			new Medicine { Id = AzithromycinId, Code = "AZI-250", Name = "Azithromycin 250 mg", Unit = "tablet", MinimumStockLevel = 25 },
			new Medicine { Id = VitaminCId, Code = "VITC-DEMO", Name = "Vitamin C", Unit = "tablet", MinimumStockLevel = 40 }
		};
		var existingCodes = db.Medicines.Select(x => x.Code).ToHashSet();
		db.Medicines.AddRange(medicines.Where(x => !existingCodes.Contains(x.Code)));
		db.SaveChanges();
		ApplyDemoInventory(db);
		ApplyProcurementSeed(db);
	}

	private static void ApplyDemoInventory(ApplicationDbContext db)
	{
		var scenarios = new[]
		{
			new DemoInventorySeed("PARA-500", "CENTRAL", "DEMO-PARA-CENTRAL-001", 420, 0, 0, 0, 240, 240),
			new DemoInventorySeed("AMOX-250", "CENTRAL", "DEMO-AMOX-CENTRAL-001", 12, 20, -8, 0, 210, 180),
			new DemoInventorySeed("AZI-250", "NORTH-CLINIC", "DEMO-AZI-NORTH-001", 1, 8, -7, 0, 20, 120),
			new DemoInventorySeed("IBU-200", "EAST-HOSPITAL", "DEMO-IBU-EAST-001", 150, 0, 0, 0, 75, 180),
			new DemoInventorySeed("CET-10", "WEST-DISPENSARY", "DEMO-CET-WEST-001", 110, 0, 0, 0, 145, 240),
			new DemoInventorySeed("OME-20", "CENTRAL", "DEMO-OME-CENTRAL-001", 90, 0, 0, 15, 220, 180),
			new DemoInventorySeed("VITC-DEMO", "CENTRAL", "DEMO-VITC-CENTRAL-001", 34, 36, -2, 0, 80, 180)
		};

		var now = DateTime.UtcNow;
		foreach (var seed in scenarios)
		{
			var medicine = db.Medicines.FirstOrDefault(x => x.Code == seed.MedicineCode);
			var facility = db.Facilities.FirstOrDefault(x => x.Code == seed.FacilityCode);
			if (medicine is null || facility is null || !medicine.IsActive || !facility.IsActive) continue;

			// A matching batch marks this scenario as already seeded. A pre-existing balance
			// without the marker is treated as real stock and is left completely untouched.
			if (db.MedicineBatches.Any(x => x.MedicineId == medicine.Id && x.FacilityId == facility.Id && x.BatchNumber == seed.BatchNumber)) continue;
			if (db.InventoryBalances.Any(x => x.MedicineId == medicine.Id && x.FacilityId == facility.Id)) continue;

			var batchId = DemoId(seed.BatchNumber, "batch");
			var balanceId = DemoId(seed.BatchNumber, "balance");
			var balance = new InventoryBalance
			{
				Id = balanceId,
				MedicineId = medicine.Id,
				FacilityId = facility.Id,
				QuantityOnHand = seed.FinalQuantity,
				QuantityReserved = seed.ReservedQuantity,
				UpdatedAtUtc = now
			};
			var batch = new MedicineBatch
			{
				Id = batchId,
				MedicineId = medicine.Id,
				FacilityId = facility.Id,
				BatchNumber = seed.BatchNumber,
				QuantityOnHand = seed.FinalQuantity,
				ManufacturingDateUtc = now.Date.AddDays(-seed.ManufactureDaysAgo),
				ExpiryDateUtc = now.Date.AddDays(seed.ExpiryDaysFromNow)
			};

			db.InventoryBalances.Add(balance);
			db.MedicineBatches.Add(batch);
			if (seed.ReceiptQuantity > 0)
				db.StockTransactions.Add(DemoTransaction(seed, "receipt", medicine.Id, facility.Id, batchId, StockTransactionType.Receipt, seed.ReceiptQuantity, seed.ReceiptQuantity, "Demo opening stock receipt", now.AddMinutes(-3)));
			if (seed.AdjustmentDelta != 0)
				db.StockTransactions.Add(DemoTransaction(seed, "adjustment", medicine.Id, facility.Id, batchId, StockTransactionType.Adjustment, seed.AdjustmentDelta, seed.FinalQuantity, "Demo cycle-count adjustment", now.AddMinutes(-2)));
			if (seed.ReceiptQuantity == 0 && seed.AdjustmentDelta == 0)
				db.StockTransactions.Add(DemoTransaction(seed, "receipt", medicine.Id, facility.Id, batchId, StockTransactionType.Receipt, seed.FinalQuantity, seed.FinalQuantity, "Demo opening stock receipt", now.AddMinutes(-3)));
			if (seed.ReservedQuantity > 0)
				db.StockTransactions.Add(DemoTransaction(seed, "reservation", medicine.Id, facility.Id, null, StockTransactionType.Reservation, seed.ReservedQuantity, seed.FinalQuantity - seed.ReservedQuantity, "Demo stock reservation", now.AddMinutes(-1)));
		}

		db.SaveChanges();
	}

	private static StockTransaction DemoTransaction(DemoInventorySeed seed, string key, Guid medicineId, Guid facilityId, Guid? batchId, StockTransactionType type, int quantity, int balanceAfter, string reason, DateTime createdAtUtc) => new()
	{
		Id = DemoId(seed.BatchNumber, key),
		MedicineId = medicineId,
		FacilityId = facilityId,
		MedicineBatchId = batchId,
		Type = type,
		Quantity = quantity,
		BalanceAfter = balanceAfter,
		Reason = reason,
		ActorId = "demo-seed",
		CreatedAtUtc = createdAtUtc
	};

	private static Guid DemoId(string batchNumber, string key) => Guid.Parse($"d3e00000-0000-4000-8000-{Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"{batchNumber}:{key}")))[..12].ToLowerInvariant()}");

	private sealed record DemoInventorySeed(string MedicineCode, string FacilityCode, string BatchNumber, int FinalQuantity, int ReceiptQuantity, int AdjustmentDelta, int ReservedQuantity, int ExpiryDaysFromNow, int ManufactureDaysAgo);

	// ============================================================
	// Procurement Seed (Suppliers + Purchase Orders)
	// ============================================================

	private static void ApplyProcurementSeed(ApplicationDbContext db)
	{
		var now = DateTime.UtcNow;

		// ── Suppliers ──────────────────────────────────────────
		var suppliers = new[]
		{
			new Supplier { Id = Supplier1Id, Name = "MedPharma Supplies Ltd", ContactPerson = "Rajesh Kumar", Email = "rajesh@medpharma.example.com", Phone = "+91-9876543210", Address = "142 Industrial Estate, Mumbai, MH 400001", LeadTimeDays = 7,  IsActive = true },
			new Supplier { Id = Supplier2Id, Name = "HealthCore Distributors", ContactPerson = "Priya Nair",  Email = "priya@healthcore.example.com",   Phone = "+91-9123456780", Address = "56 Commerce Road, Bengaluru, KA 560001",   LeadTimeDays = 10, IsActive = true },
			new Supplier { Id = Supplier3Id, Name = "PharmaLink Global",      ContactPerson = "Amit Shah",   Email = "amit@pharmalink.example.com",    Phone = "+91-9012345678", Address = "88 Trade Centre, Chennai, TN 600001",     LeadTimeDays = 14, IsActive = true },
			new Supplier { Id = Supplier4Id, Name = "CureMed Wholesale",      ContactPerson = "Sunita Rao",  Email = "sunita@curemed.example.com",     Phone = "+91-9345678901", Address = "33 Pharma Hub, Hyderabad, TS 500001",     LeadTimeDays = 5,  IsActive = true },
		};

		var existingSupplierIds = db.Suppliers.Select(x => x.Id).ToHashSet();
		db.Suppliers.AddRange(suppliers.Where(s => !existingSupplierIds.Contains(s.Id)));
		db.SaveChanges();

		// ── Purchase Orders ────────────────────────────────────
		// Skip if already seeded (use PO1 as the marker)
		if (db.PurchaseOrders.Any(x => x.Id == Po1Id))
			return;

		// Resolve medicine IDs from the already-seeded medicines
		var para     = db.Medicines.First(x => x.Code == "PARA-500");
		var amox     = db.Medicines.First(x => x.Code == "AMOX-250");
		var ibu      = db.Medicines.First(x => x.Code == "IBU-200");
		var azi      = db.Medicines.First(x => x.Code == "AZI-250");
		var ome      = db.Medicines.First(x => x.Code == "OME-20");
		var vitc     = db.Medicines.First(x => x.Code == "VITC-DEMO");

		// PO 1 – Approved (Paracetamol + Amoxicillin, Central)
		db.PurchaseOrders.Add(new PurchaseOrder
		{
			Id = Po1Id, SupplierId = Supplier1Id, FacilityId = CentralFacilityId,
			Status = PurchaseOrderStatus.Approved,
			RequestedAt = now.AddDays(-10), ApprovedAt = now.AddDays(-8), ApprovedById = null,
			Items = new List<PurchaseOrderItem>
			{
				new() { Id = Guid.NewGuid(), MedicineId = para.Id, RequestedQuantity = 500, UnitPrice = 1.20m },
				new() { Id = Guid.NewGuid(), MedicineId = amox.Id, RequestedQuantity = 200, UnitPrice = 3.50m },
			}
		});

		// PO 2 – PendingApproval (Ibuprofen, East Hospital)
		db.PurchaseOrders.Add(new PurchaseOrder
		{
			Id = Po2Id, SupplierId = Supplier2Id, FacilityId = EastHospitalFacilityId,
			Status = PurchaseOrderStatus.PendingApproval,
			RequestedAt = now.AddDays(-3),
			Items = new List<PurchaseOrderItem>
			{
				new() { Id = Guid.NewGuid(), MedicineId = ibu.Id, RequestedQuantity = 300, UnitPrice = 2.80m },
			}
		});

		// PO 3 – Received (Azithromycin, North Clinic)
		db.PurchaseOrders.Add(new PurchaseOrder
		{
			Id = Po3Id, SupplierId = Supplier3Id, FacilityId = NorthClinicFacilityId,
			Status = PurchaseOrderStatus.Received,
			RequestedAt = now.AddDays(-20), ApprovedAt = now.AddDays(-18), ReceivedAt = now.AddDays(-5),
			Items = new List<PurchaseOrderItem>
			{
				new() { Id = Guid.NewGuid(), MedicineId = azi.Id, RequestedQuantity = 150, UnitPrice = 8.00m },
			}
		});

		// PO 4 – Draft (Omeprazole + Vitamin C, Central)
		db.PurchaseOrders.Add(new PurchaseOrder
		{
			Id = Po4Id, SupplierId = Supplier4Id, FacilityId = CentralFacilityId,
			Status = PurchaseOrderStatus.Draft,
			RequestedAt = now.AddDays(-1),
			Items = new List<PurchaseOrderItem>
			{
				new() { Id = Guid.NewGuid(), MedicineId = ome.Id,  RequestedQuantity = 200, UnitPrice = 4.25m },
				new() { Id = Guid.NewGuid(), MedicineId = vitc.Id, RequestedQuantity = 100, UnitPrice = 0.90m },
			}
		});

		// PO 5 – Rejected (Paracetamol, West Dispensary)
		db.PurchaseOrders.Add(new PurchaseOrder
		{
			Id = Po5Id, SupplierId = Supplier1Id, FacilityId = WestDispensaryFacilityId,
			Status = PurchaseOrderStatus.Rejected,
			RequestedAt = now.AddDays(-15), RejectionReason = "Budget exceeded for this quarter",
			Items = new List<PurchaseOrderItem>
			{
				new() { Id = Guid.NewGuid(), MedicineId = para.Id, RequestedQuantity = 1000, UnitPrice = 1.15m },
			}
		});

		// PO 6 – RevisionRequired (Amoxicillin + Azithromycin, East Hospital)
		db.PurchaseOrders.Add(new PurchaseOrder
		{
			Id = Po6Id, SupplierId = Supplier2Id, FacilityId = EastHospitalFacilityId,
			Status = PurchaseOrderStatus.RevisionRequired,
			RequestedAt = now.AddDays(-6), RevisionReason = "Quantities must be adjusted — reduce Azithromycin by 50 units",
			Items = new List<PurchaseOrderItem>
			{
				new() { Id = Guid.NewGuid(), MedicineId = amox.Id, RequestedQuantity = 100, UnitPrice = 3.50m },
				new() { Id = Guid.NewGuid(), MedicineId = azi.Id,  RequestedQuantity = 80,  UnitPrice = 7.80m },
			}
		});

		db.SaveChanges();
	}
}

