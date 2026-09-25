using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Infrastructure.Persistence.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

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

    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<MedicineBatch> MedicineBatches => Set<MedicineBatch>();
    public DbSet<InventoryBalance> InventoryBalances => Set<InventoryBalance>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();

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
    }
}
