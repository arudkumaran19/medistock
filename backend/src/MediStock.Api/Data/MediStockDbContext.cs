using Microsoft.EntityFrameworkCore;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Redistribution.Models;
using MediStock.Api.Features.Workflow.Models;

namespace MediStock.Api.Data;

public class MediStockDbContext : DbContext
{
    public MediStockDbContext(DbContextOptions<MediStockDbContext> options) : base(options)
    {
    }

    // Support Domain Entities
    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<FacilityInventory> FacilityInventories => Set<FacilityInventory>();

    // Redistribution Slice Entities
    public DbSet<TransferRequest> TransferRequests => Set<TransferRequest>();
    public DbSet<TransferItem> TransferItems => Set<TransferItem>();
    public DbSet<TransferStatusHistory> TransferStatusHistories => Set<TransferStatusHistory>();

    // Workflow Entities
    public DbSet<WorkflowRun> WorkflowRuns => Set<WorkflowRun>();
    public DbSet<WorkflowPlanStep> WorkflowPlanSteps => Set<WorkflowPlanStep>();
    public DbSet<AgentExecution> AgentExecutions => Set<AgentExecution>();
    public DbSet<ToolExecution> ToolExecutions => Set<ToolExecution>();
    public DbSet<ValidationResult> ValidationResults => Set<ValidationResult>();
    public DbSet<Approval> Approvals => Set<Approval>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Facility
        modelBuilder.Entity<Facility>(entity =>
        {
            entity.ToTable("facilities");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.FacilityCode).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => e.FacilityCode).IsUnique();
            entity.Property(e => e.FacilityType).HasMaxLength(50);
            entity.Property(e => e.Address).HasMaxLength(300);
            entity.Property(e => e.City).HasMaxLength(100);
            entity.Property(e => e.ContactPhone).HasMaxLength(50);
            entity.Property(e => e.ContactPerson).HasMaxLength(150);
        });

        // Medicine
        modelBuilder.Entity<Medicine>(entity =>
        {
            entity.ToTable("medicines");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.GenericName).HasMaxLength(200);
            entity.Property(e => e.Sku).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => e.Sku).IsUnique();
            entity.Property(e => e.UnitOfMeasure).HasMaxLength(50);
            entity.Property(e => e.Category).HasMaxLength(100);
        });

        // FacilityInventory
        modelBuilder.Entity<FacilityInventory>(entity =>
        {
            entity.ToTable("facility_inventories");
            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Facility)
                .WithMany(f => f.Inventories)
                .HasForeignKey(e => e.FacilityId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Medicine)
                .WithMany()
                .HasForeignKey(e => e.MedicineId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(e => e.BatchNumber).HasMaxLength(100);
            entity.HasIndex(e => new { e.FacilityId, e.MedicineId });
        });

        // TransferRequest
        modelBuilder.Entity<TransferRequest>(entity =>
        {
            entity.ToTable("transfer_requests");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.TransferNumber).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => e.TransferNumber).IsUnique();

            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(e => e.Priority).HasConversion<string>().HasMaxLength(20);

            entity.Property(e => e.EstimatedDistanceKm).HasPrecision(10, 2);
            entity.Property(e => e.EstimatedDurationMinutes).HasPrecision(10, 2);
            entity.Property(e => e.RoutingProvider).HasMaxLength(50);

            entity.HasOne(e => e.SourceFacility)
                .WithMany()
                .HasForeignKey(e => e.SourceFacilityId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.DestinationFacility)
                .WithMany()
                .HasForeignKey(e => e.DestinationFacilityId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.DestinationFacilityId);
            entity.HasIndex(e => e.SourceFacilityId);
            entity.HasIndex(e => e.CreatedAt);
        });

        // TransferItem
        modelBuilder.Entity<TransferItem>(entity =>
        {
            entity.ToTable("transfer_items");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.MedicineName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.UnitOfMeasure).IsRequired().HasMaxLength(50);
            entity.Property(e => e.BatchNumber).HasMaxLength(100);

            entity.HasOne(e => e.TransferRequest)
                .WithMany(t => t.Items)
                .HasForeignKey(e => e.TransferRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Medicine)
                .WithMany()
                .HasForeignKey(e => e.MedicineId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.TransferRequestId);
            entity.HasIndex(e => e.MedicineId);
        });

        // TransferStatusHistory
        modelBuilder.Entity<TransferStatusHistory>(entity =>
        {
            entity.ToTable("transfer_status_histories");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.FromStatus).HasConversion<string>().HasMaxLength(30);
            entity.Property(e => e.ToStatus).HasConversion<string>().HasMaxLength(30);

            entity.HasOne(e => e.TransferRequest)
                .WithMany(t => t.StatusHistory)
                .HasForeignKey(e => e.TransferRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.TransferRequestId, e.ChangedAt });
        });

        // WorkflowRun
        modelBuilder.Entity<WorkflowRun>(entity =>
        {
            entity.ToTable("workflow_runs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.WorkflowType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasIndex(e => e.Status);
        });

        // WorkflowPlanStep
        modelBuilder.Entity<WorkflowPlanStep>(entity =>
        {
            entity.ToTable("workflow_plan_steps");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StepName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);

            entity.HasOne(e => e.WorkflowRun)
                .WithMany(w => w.Steps)
                .HasForeignKey(e => e.WorkflowRunId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // AgentExecution
        modelBuilder.Entity<AgentExecution>(entity =>
        {
            entity.ToTable("agent_executions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AgentName).IsRequired().HasMaxLength(100);

            entity.HasOne(e => e.WorkflowRun)
                .WithMany(w => w.AgentExecutions)
                .HasForeignKey(e => e.WorkflowRunId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ToolExecution
        modelBuilder.Entity<ToolExecution>(entity =>
        {
            entity.ToTable("tool_executions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ToolName).IsRequired().HasMaxLength(100);

            entity.HasOne(e => e.AgentExecution)
                .WithMany(a => a.ToolExecutions)
                .HasForeignKey(e => e.AgentExecutionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ValidationResult
        modelBuilder.Entity<ValidationResult>(entity =>
        {
            entity.ToTable("validation_results");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.RuleName).IsRequired().HasMaxLength(200);

            entity.HasOne(e => e.WorkflowRun)
                .WithMany(w => w.ValidationResults)
                .HasForeignKey(e => e.WorkflowRunId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Approval
        modelBuilder.Entity<Approval>(entity =>
        {
            entity.ToTable("approvals");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(30);

            entity.HasOne(e => e.WorkflowRun)
                .WithMany(w => w.Approvals)
                .HasForeignKey(e => e.WorkflowRunId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // AuditLog
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EntityName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => new { e.EntityName, e.EntityId });
            entity.HasIndex(e => e.Timestamp);
        });
    }
}
