using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Infrastructure.Persistence.Seed;

public static class SeedData
{
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
	public static readonly Guid VitaminCId = Guid.Parse("88888888-8888-8888-8888-888888888888");

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
}
