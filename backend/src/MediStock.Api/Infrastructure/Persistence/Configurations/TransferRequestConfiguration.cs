namespace MediStock.Api.Infrastructure.Persistence.Configurations;

using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Redistribution.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Redistribution vertical (Member 3). Transfers reference the shared Medicines and
/// Facilities tables owned by Inventory; they add nothing to those tables.
/// </summary>
public class TransferRequestConfiguration : IEntityTypeConfiguration<TransferRequest>
{
    public void Configure(EntityTypeBuilder<TransferRequest> builder)
    {
        builder.ToTable("TransferRequests");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.TransferNumber).IsRequired().HasMaxLength(32);
        builder.HasIndex(x => x.TransferNumber).IsUnique();

        // Stored as text: readable in the database and immune to enum reordering.
        builder.Property(x => x.Status).IsRequired().HasConversion<string>().HasMaxLength(16);
        builder.Property(x => x.Priority).IsRequired().HasConversion<string>().HasMaxLength(16);

        builder.Property(x => x.Quantity).IsRequired();
        builder.Property(x => x.BatchNumber).HasMaxLength(64);
        builder.Property(x => x.EstimatedDistanceKm).HasPrecision(10, 2);
        builder.Property(x => x.EstimatedDurationMinutes).HasPrecision(10, 2);
        builder.Property(x => x.RoutingProvider).HasMaxLength(64);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.RejectionReason).HasMaxLength(500);

        // Restrict, not cascade: deleting a medicine or facility must never take the
        // transfer history with it.
        builder.HasOne<Medicine>().WithMany().HasForeignKey(x => x.MedicineId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Facility>().WithMany().HasForeignKey(x => x.DestinationFacilityId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Facility>().WithMany().HasForeignKey(x => x.SourceFacilityId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.StatusHistory)
            .WithOne(x => x.TransferRequest)
            .HasForeignKey(x => x.TransferRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.Status, x.CreatedAtUtc }).HasDatabaseName("IX_TransferRequests_Status_CreatedAt");
    }
}

/// <summary>Audit trail of transfer status changes. Redistribution vertical.</summary>
public class TransferStatusHistoryConfiguration : IEntityTypeConfiguration<TransferStatusHistory>
{
    public void Configure(EntityTypeBuilder<TransferStatusHistory> builder)
    {
        builder.ToTable("TransferStatusHistory");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.FromStatus).HasConversion<string>().HasMaxLength(16);
        builder.Property(x => x.ToStatus).IsRequired().HasConversion<string>().HasMaxLength(16);
        builder.Property(x => x.ChangedByEmail).HasMaxLength(256);
        builder.Property(x => x.Reason).HasMaxLength(500);
        builder.HasIndex(x => new { x.TransferRequestId, x.ChangedAtUtc });
    }
}
