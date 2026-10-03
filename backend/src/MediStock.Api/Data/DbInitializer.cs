using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Workflow.Models;

namespace MediStock.Api.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(MediStockDbContext context, ILogger logger)
    {
        try
        {
            // Ensure database schema is created
            await context.Database.EnsureCreatedAsync();

            if (!context.Database.IsInMemory())
            {
                await context.Database.ExecuteSqlRawAsync(@"
                    ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS ""LastLatitude"" double precision;
                    ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS ""LastLongitude"" double precision;
                    ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS ""LastLocationAt"" timestamp with time zone;

                    CREATE TABLE IF NOT EXISTS transfer_notifications (
                        ""Id"" uuid NOT NULL PRIMARY KEY,
                        ""TransferId"" uuid NOT NULL,
                        ""Audience"" character varying(50) NOT NULL,
                        ""RecipientUserId"" uuid NULL,
                        ""Title"" character varying(200) NOT NULL,
                        ""Message"" character varying(1000) NOT NULL,
                        ""IsRead"" boolean NOT NULL DEFAULT FALSE,
                        ""CreatedAt"" timestamp with time zone NOT NULL,
                        CONSTRAINT ""FK_transfer_notifications_transfer_requests_TransferId""
                            FOREIGN KEY (""TransferId"") REFERENCES transfer_requests (""Id"") ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS ""IX_transfer_notifications_TransferId"" ON transfer_notifications (""TransferId"");
                    CREATE INDEX IF NOT EXISTS ""IX_transfer_notifications_Audience"" ON transfer_notifications (""Audience"");
                    CREATE INDEX IF NOT EXISTS ""IX_transfer_notifications_RecipientUserId"" ON transfer_notifications (""RecipientUserId"");
                    CREATE INDEX IF NOT EXISTS ""IX_transfer_notifications_IsRead"" ON transfer_notifications (""IsRead"");
                    CREATE INDEX IF NOT EXISTS ""IX_transfer_notifications_CreatedAt"" ON transfer_notifications (""CreatedAt"");
                ");
            }

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

                var facKandyAlt = new Facility
                {
                    Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                    Name = "Teaching Hospital Kandy",
                    FacilityCode = "FAC-KAN-ALT",
                    FacilityType = "Hospital",
                    Latitude = 7.2882,
                    Longitude = 80.6278,
                    Address = "William Gopallawa Mawatha, Kandy",
                    City = "Kandy",
                    ContactPhone = "+94 81 222 2261",
                    ContactPerson = "Dr. Fernando",
                    IsActive = true
                };

                var facColomboAlt = new Facility
                {
                    Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    Name = "National Hospital of Sri Lanka",
                    FacilityCode = "FAC-COL-ALT",
                    FacilityType = "Central Depot",
                    Latitude = 6.9175,
                    Longitude = 79.8653,
                    Address = "Regent Street, Colombo 10",
                    City = "Colombo",
                    ContactPhone = "+94 11 269 1111",
                    ContactPerson = "Dr. Perera",
                    IsActive = true
                };

                var facGalleAlt = new Facility
                {
                    Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                    Name = "Teaching Hospital Karapitiya",
                    FacilityCode = "FAC-GAL-ALT",
                    FacilityType = "Hospital",
                    Latitude = 6.0682,
                    Longitude = 80.2217,
                    Address = "Karapitiya, Galle",
                    City = "Galle",
                    ContactPhone = "+94 91 223 2250",
                    ContactPerson = "Dr. Jayasinghe",
                    IsActive = true
                };

                await context.Facilities.AddRangeAsync(facColombo, facGalle, facKandy, facNegombo, facColomboAlt, facGalleAlt, facKandyAlt);

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

                var medCeftriaxone = new Medicine
                {
                    Id = Guid.Parse("b0000000-0000-0000-0000-000000000005"),
                    Name = "Ceftriaxone 1g Injection Vials",
                    GenericName = "Ceftriaxone",
                    Sku = "MED-CEF-1G",
                    UnitOfMeasure = "vials",
                    Category = "Antibiotics",
                    RequiresRefrigeration = false,
                    IsActive = true
                };

                var medCeftriaxoneAlt = new Medicine
                {
                    Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
                    Name = "Ceftriaxone 1g Injection Vials",
                    GenericName = "Ceftriaxone",
                    Sku = "MED-CEF-ALT",
                    UnitOfMeasure = "vials",
                    Category = "Antibiotics",
                    RequiresRefrigeration = false,
                    IsActive = true
                };

                await context.Medicines.AddRangeAsync(medAmox, medPara, medInsulin, medMetformin, medCeftriaxone, medCeftriaxoneAlt);

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

                var sampleWorkflowRun = new WorkflowRun
                {
                    Id = Guid.Parse("e0000000-0000-0000-0000-000000000001"),
                    WorkflowType = "RedistributionPlanning",
                    Status = WorkflowStatus.WaitingForApproval,
                    InitiatorUserId = sampleTransfer.RequestedByUserId,
                    StartedAt = DateTime.UtcNow,
                    ContextJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        transferRequestId = sampleTransfer.Id,
                        transferNumber = sampleTransfer.TransferNumber,
                        destinationFacilityId = sampleTransfer.DestinationFacilityId,
                        sourceFacilityId = sampleTransfer.SourceFacilityId,
                        priority = sampleTransfer.Priority.ToString(),
                        notes = sampleTransfer.Notes
                    })
                };

                sampleWorkflowRun.Steps.Add(new WorkflowPlanStep
                {
                    Id = Guid.NewGuid(),
                    WorkflowRunId = sampleWorkflowRun.Id,
                    StepNumber = 1,
                    StepName = "Detect Shortage & Initialize Context",
                    Status = WorkflowStatus.Completed,
                    ExecutedAt = DateTime.UtcNow
                });

                sampleWorkflowRun.Steps.Add(new WorkflowPlanStep
                {
                    Id = Guid.NewGuid(),
                    WorkflowRunId = sampleWorkflowRun.Id,
                    StepNumber = 2,
                    StepName = "Agentic Candidate & Route Analysis",
                    Status = WorkflowStatus.Completed,
                    ExecutedAt = DateTime.UtcNow
                });

                sampleWorkflowRun.Steps.Add(new WorkflowPlanStep
                {
                    Id = Guid.NewGuid(),
                    WorkflowRunId = sampleWorkflowRun.Id,
                    StepNumber = 3,
                    StepName = "Deterministic Business Rule Validation",
                    Status = WorkflowStatus.Completed,
                    ExecutedAt = DateTime.UtcNow
                });

                sampleWorkflowRun.Steps.Add(new WorkflowPlanStep
                {
                    Id = Guid.NewGuid(),
                    WorkflowRunId = sampleWorkflowRun.Id,
                    StepNumber = 4,
                    StepName = "Awaiting Human-in-the-Loop Management Approval",
                    Status = WorkflowStatus.WaitingForApproval,
                    ExecutedAt = DateTime.UtcNow
                });

                sampleTransfer.WorkflowRunId = sampleWorkflowRun.Id;

                await context.WorkflowRuns.AddAsync(sampleWorkflowRun);
                await context.TransferRequests.AddAsync(sampleTransfer);

                await context.SaveChangesAsync();
                logger.LogInformation("Database seeded successfully with initial facilities, medicines, sample transfer, and workflow run.");
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DbInitializer was unable to auto-seed (e.g. database offline or awaiting configuration).");
        }
    }
}
