using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.Models;

namespace MediStock.Api.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(MediStockDbContext context, ILogger logger)
    {
        try
        {
            // Ensure database schema is created
            await context.Database.EnsureCreatedAsync();

            if (!await context.Facilities.AnyAsync())
            {
                logger.LogInformation("Seeding initial facilities, medicines, and inventories...");

                var facColombo = new Facility
                {
                    Id = Guid.Parse("a0000000-0000-0000-0000-000000000001"),
                    Name = "National Hospital of Sri Lanka",
                    FacilityCode = "FAC-COL-01",
                    FacilityType = "Central Depot",
                    Latitude = 6.9175,
                    Longitude = 79.8653,
                    Address = "Regent Street, Colombo 10",
                    City = "Colombo",
                    ContactPhone = "+94 11 269 1111",
                    ContactPerson = "Dr. Perera",
                    IsActive = true
                };

                var facGalle = new Facility
                {
                    Id = Guid.Parse("a0000000-0000-0000-0000-000000000002"),
                    Name = "Teaching Hospital Karapitiya",
                    FacilityCode = "FAC-GAL-02",
                    FacilityType = "Hospital",
                    Latitude = 6.0682,
                    Longitude = 80.2217,
                    Address = "Karapitiya, Galle",
                    City = "Galle",
                    ContactPhone = "+94 91 223 2250",
                    ContactPerson = "Dr. Jayasinghe",
                    IsActive = true
                };

                var facKandy = new Facility
                {
                    Id = Guid.Parse("a0000000-0000-0000-0000-000000000003"),
                    Name = "Teaching Hospital Kandy",
                    FacilityCode = "FAC-KAN-03",
                    FacilityType = "Hospital",
                    Latitude = 7.2882,
                    Longitude = 80.6278,
                    Address = "William Gopallawa Mawatha, Kandy",
                    City = "Kandy",
                    ContactPhone = "+94 81 222 2261",
                    ContactPerson = "Dr. Fernando",
                    IsActive = true
                };

                var facNegombo = new Facility
                {
                    Id = Guid.Parse("a0000000-0000-0000-0000-000000000004"),
                    Name = "District General Hospital Negombo",
                    FacilityCode = "FAC-NEG-04",
                    FacilityType = "Hospital",
                    Latitude = 7.2144,
                    Longitude = 79.8488,
                    Address = "Colombo Road, Negombo",
                    City = "Negombo",
                    ContactPhone = "+94 31 222 2261",
                    ContactPerson = "Dr. Silva",
                    IsActive = true
                };

                await context.Facilities.AddRangeAsync(facColombo, facGalle, facKandy, facNegombo);

                var medAmox = new Medicine
                {
                    Id = Guid.Parse("b0000000-0000-0000-0000-000000000001"),
                    Name = "Amoxicillin 500mg",
                    GenericName = "Amoxicillin",
                    Sku = "MED-AMX-500",
                    UnitOfMeasure = "capsules",
                    Category = "Antibiotics",
                    RequiresRefrigeration = false,
                    IsActive = true
                };

                var medPara = new Medicine
                {
                    Id = Guid.Parse("b0000000-0000-0000-0000-000000000002"),
                    Name = "Paracetamol 500mg",
                    GenericName = "Paracetamol",
                    Sku = "MED-PCM-500",
                    UnitOfMeasure = "tablets",
                    Category = "Analgesics",
                    RequiresRefrigeration = false,
                    IsActive = true
                };

                var medInsulin = new Medicine
                {
                    Id = Guid.Parse("b0000000-0000-0000-0000-000000000003"),
                    Name = "Insulin Glargine 100IU/ml",
                    GenericName = "Insulin Glargine",
                    Sku = "MED-INS-100",
                    UnitOfMeasure = "vials",
                    Category = "Endocrine",
                    RequiresRefrigeration = true,
                    IsActive = true
                };

                var medMetformin = new Medicine
                {
                    Id = Guid.Parse("b0000000-0000-0000-0000-000000000004"),
                    Name = "Metformin 500mg",
                    GenericName = "Metformin HCl",
                    Sku = "MED-MET-500",
                    UnitOfMeasure = "tablets",
                    Category = "Antidiabetic",
                    RequiresRefrigeration = false,
                    IsActive = true
                };

                await context.Medicines.AddRangeAsync(medAmox, medPara, medInsulin, medMetformin);

                // Inventories:
                // Colombo: Surplus 700 Amoxicillin (1200 - 500 safety stock)
                var invColomboAmox = new FacilityInventory
                {
                    Id = Guid.Parse("c0000000-0000-0000-0000-000000000001"),
                    FacilityId = facColombo.Id,
                    MedicineId = medAmox.Id,
                    StockOnHand = 1200,
                    SafetyStockThreshold = 500,
                    ReservedStock = 0,
                    BatchNumber = "BAT-AMX-2026A",
                    ExpiryDate = DateTime.UtcNow.AddYears(2)
                };

                // Negombo: Surplus 300 Amoxicillin (600 - 300 safety stock)
                var invNegomboAmox = new FacilityInventory
                {
                    Id = Guid.Parse("c0000000-0000-0000-0000-000000000003"),
                    FacilityId = facNegombo.Id,
                    MedicineId = medAmox.Id,
                    StockOnHand = 600,
                    SafetyStockThreshold = 300,
                    ReservedStock = 0,
                    BatchNumber = "BAT-AMX-2026N",
                    ExpiryDate = DateTime.UtcNow.AddMonths(18)
                };

                // Galle: Shortage of Amoxicillin (Stock 50, Safety Stock 500 -> Deficit 450)
                var invGalleAmox = new FacilityInventory
                {
                    Id = Guid.Parse("c0000000-0000-0000-0000-000000000004"),
                    FacilityId = facGalle.Id,
                    MedicineId = medAmox.Id,
                    StockOnHand = 50,
                    SafetyStockThreshold = 500,
                    ReservedStock = 0,
                    BatchNumber = "BAT-AMX-2025G",
                    ExpiryDate = DateTime.UtcNow.AddMonths(4)
                };

                await context.FacilityInventories.AddRangeAsync(invColomboAmox, invNegomboAmox, invGalleAmox);

                // Initial sample transfer proposal
                var sampleTransfer = new TransferRequest
                {
                    Id = Guid.Parse("d0000000-0000-0000-0000-000000000001"),
                    TransferNumber = "TR-20260923-0001",
                    SourceFacilityId = facColombo.Id,
                    DestinationFacilityId = facGalle.Id,
                    Status = TransferStatus.Proposed,
                    Priority = TransferPriority.High,
                    EstimatedDistanceKm = 119.5m,
                    EstimatedDurationMinutes = 115.0m,
                    RoutingProvider = "OpenRouteService",
                    RequestedByUserId = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                    Notes = "Urgent redistribution of Amoxicillin to cover critical deficit at Galle.",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                sampleTransfer.Items.Add(new TransferItem
                {
                    Id = Guid.NewGuid(),
                    TransferRequestId = sampleTransfer.Id,
                    MedicineId = medAmox.Id,
                    MedicineName = medAmox.Name,
                    RequestedQuantity = 400,
                    AllocatedQuantity = 400,
                    UnitOfMeasure = "capsules",
                    BatchNumber = "BAT-AMX-2026A",
                    ExpiryDate = DateTime.UtcNow.AddYears(2)
                });

                sampleTransfer.StatusHistory.Add(new TransferStatusHistory
                {
                    Id = Guid.NewGuid(),
                    TransferRequestId = sampleTransfer.Id,
                    FromStatus = null,
                    ToStatus = TransferStatus.Draft,
                    ChangedByUserId = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                    Reason = "Redistribution request initiated"
                });

                sampleTransfer.StatusHistory.Add(new TransferStatusHistory
                {
                    Id = Guid.NewGuid(),
                    TransferRequestId = sampleTransfer.Id,
                    FromStatus = TransferStatus.Draft,
                    ToStatus = TransferStatus.Proposed,
                    ChangedByUserId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    Reason = "Agent proposed Colombo as optimal source facility"
                });

                await context.TransferRequests.AddAsync(sampleTransfer);

                await context.SaveChangesAsync();
                logger.LogInformation("Database seeded successfully with initial facilities, medicines, and sample transfer.");
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DbInitializer was unable to auto-seed (e.g. database offline or awaiting configuration).");
        }
    }
}
