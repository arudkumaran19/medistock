using MediStock.Api.Features.Inventory.Models;

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
			new Medicine { Id = AzithromycinId, Code = "AZI-250", Name = "Azithromycin 250 mg", Unit = "tablet", MinimumStockLevel = 25 }
		};
	var existingCodes = db.Medicines.Select(x => x.Code).ToHashSet();
	db.Medicines.AddRange(medicines.Where(x => !existingCodes.Contains(x.Code)));
	db.SaveChanges();
	}
}
