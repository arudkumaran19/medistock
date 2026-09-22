using MediStock.Api.Features.Inventory.Models;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Infrastructure.Persistence;

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<MedicineBatch> MedicineBatches => Set<MedicineBatch>();
    public DbSet<InventoryBalance> InventoryBalances => Set<InventoryBalance>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Medicine>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
        });
        modelBuilder.Entity<Facility>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
        });
        modelBuilder.Entity<MedicineBatch>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.MedicineId, x.FacilityId, x.BatchNumber }).IsUnique();
            entity.Property(x => x.BatchNumber).HasMaxLength(100).IsRequired();
            entity.HasOne(x => x.Medicine).WithMany(x => x.Batches).HasForeignKey(x => x.MedicineId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Facility).WithMany(x => x.Batches).HasForeignKey(x => x.FacilityId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<InventoryBalance>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.MedicineId, x.FacilityId }).IsUnique();
            entity.HasOne(x => x.Medicine).WithMany(x => x.InventoryBalances).HasForeignKey(x => x.MedicineId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Facility).WithMany(x => x.InventoryBalances).HasForeignKey(x => x.FacilityId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<StockTransaction>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Reason).HasMaxLength(500).IsRequired();
            entity.HasOne(x => x.MedicineBatch).WithMany(x => x.StockTransactions).HasForeignKey(x => x.MedicineBatchId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}