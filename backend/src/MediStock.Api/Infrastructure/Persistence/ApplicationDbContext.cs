using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Infrastructure.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

using Medicine = MediStock.Api.Features.Inventory.Models.Medicine;

namespace MediStock.Api.Infrastructure.Persistence;

public sealed class ApplicationDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<UserFacility> UserFacilities => Set<UserFacility>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    public DbSet<ReplenishmentRequest> ReplenishmentRequests => Set<ReplenishmentRequest>();

    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<MedicineBatch> MedicineBatches => Set<MedicineBatch>();
    public DbSet<InventoryBalance> InventoryBalances => Set<InventoryBalance>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();

    // Demand & Shortage vertical - Sathurstiga S. (IT24103156).
    // Blueprint section 33 (Demand tables). The entity configurations live in
    // Infrastructure/Persistence/Configurations/ and are picked up automatically by
    // ApplyConfigurationsFromAssembly below, so nothing else here needs to change.
    public DbSet<ConsumptionRecord> ConsumptionRecords => Set<ConsumptionRecord>();
    public DbSet<DemandForecast> DemandForecasts => Set<DemandForecast>();
    public DbSet<ReorderRule> ReorderRules => Set<ReorderRule>();
    public DbSet<ShortageAlert> ShortageAlerts => Set<ShortageAlert>();
    public DbSet<ShortageStatusHistory> ShortageStatusHistories => Set<ShortageStatusHistory>();

    // Redistribution vertical (Member 3). Additive: two tables, configured in
    // TransferRequestConfiguration.cs.
    public DbSet<Features.Redistribution.Models.TransferRequest> TransferRequests => Set<Features.Redistribution.Models.TransferRequest>();
    public DbSet<Features.Redistribution.Models.TransferStatusHistory> TransferStatusHistory => Set<Features.Redistribution.Models.TransferStatusHistory>();

    // Workflow & Multi-Agent Orchestration
    public DbSet<MediStock.Api.Features.Workflow.Models.WorkflowRun> WorkflowRuns => Set<MediStock.Api.Features.Workflow.Models.WorkflowRun>();
    public DbSet<MediStock.Api.Features.Workflow.Models.WorkflowPlanStep> WorkflowPlanSteps => Set<MediStock.Api.Features.Workflow.Models.WorkflowPlanStep>();
    public DbSet<MediStock.Api.Features.Workflow.Models.Approval> Approvals => Set<MediStock.Api.Features.Workflow.Models.Approval>();
    public DbSet<MediStock.Api.Features.Workflow.Models.AuditLog> AuditLogs => Set<MediStock.Api.Features.Workflow.Models.AuditLog>();
    public DbSet<SystemAuditLog> SystemAuditLogs => Set<SystemAuditLog>();
    public DbSet<AppNotification> AppNotifications => Set<AppNotification>();
    public DbSet<MediStock.Api.Features.Workflow.Models.AgentExecution> AgentExecutions => Set<MediStock.Api.Features.Workflow.Models.AgentExecution>();
    public DbSet<MediStock.Api.Features.Workflow.Models.ToolExecution> ToolExecutions => Set<MediStock.Api.Features.Workflow.Models.ToolExecution>();
    public DbSet<MediStock.Api.Features.Workflow.Models.ValidationResult> ValidationResults => Set<MediStock.Api.Features.Workflow.Models.ValidationResult>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        builder.Entity<Medicine>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
        });

        builder.Entity<MedicineBatch>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.MedicineId, x.FacilityId, x.BatchNumber }).IsUnique();
            entity.Property(x => x.BatchNumber).HasMaxLength(100).IsRequired();

            entity.HasOne(x => x.Medicine)
                .WithMany(x => x.Batches)
                .HasForeignKey(x => x.MedicineId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Facility)
                .WithMany()
                .HasForeignKey(x => x.FacilityId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<InventoryBalance>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.MedicineId, x.FacilityId }).IsUnique();

            entity.HasOne(x => x.Medicine)
                .WithMany(x => x.InventoryBalances)
                .HasForeignKey(x => x.MedicineId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Facility)
                .WithMany()
                .HasForeignKey(x => x.FacilityId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<StockTransaction>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Reason)
                .HasMaxLength(500)
                .IsRequired();

            entity.HasOne(x => x.MedicineBatch)
                .WithMany(x => x.StockTransactions)
                .HasForeignKey(x => x.MedicineBatchId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ReplenishmentRequest>(entity =>
        {
            entity.ToTable("replenishment_requests");
            entity.HasKey(x => x.Id);
        });

        builder.Entity<SystemAuditLog>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Timestamp);
            entity.HasIndex(x => x.Action);
            entity.HasIndex(x => x.ResourceType);
            entity.HasIndex(x => x.ActorEmail);
            entity.HasIndex(x => x.CorrelationId);
            entity.Property(x => x.Action).HasMaxLength(128).IsRequired();
            entity.Property(x => x.ResourceType).HasMaxLength(128).IsRequired();
            entity.Property(x => x.Outcome).HasMaxLength(32).IsRequired();
        });

        builder.Entity<ShortageStatusHistory>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.ShortageAlertId);
            entity.HasIndex(x => x.ChangedAt);
            entity.Property(x => x.FromStatus).HasMaxLength(64).IsRequired();
            entity.Property(x => x.ToStatus).HasMaxLength(64).IsRequired();
            entity.Property(x => x.ChangedBy).HasMaxLength(256).IsRequired();
        });

        builder.Entity<AppNotification>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => x.FacilityId);
            entity.HasIndex(x => x.Role);
            entity.HasIndex(x => x.IsRead);
            entity.HasIndex(x => x.CreatedAtUtc);
            entity.HasIndex(x => x.ShortageAlertId);
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Severity).HasMaxLength(50).IsRequired();
            entity.Property(x => x.LinkUrl).HasMaxLength(500);
        });
    }
}
