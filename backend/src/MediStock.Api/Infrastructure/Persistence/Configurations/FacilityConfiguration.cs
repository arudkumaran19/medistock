using MediStock.Api.Features.Inventory.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MediStock.Api.Infrastructure.Persistence.Configurations;

public sealed class FacilityConfiguration : IEntityTypeConfiguration<Facility>
{
    public void Configure(EntityTypeBuilder<Facility> builder)
    {
        builder.ToTable("Facilities");
        builder.HasKey(facility => facility.Id);
        builder.HasIndex(facility => facility.Code).IsUnique();
        builder.Property(facility => facility.Code).IsRequired().HasMaxLength(64);
        builder.Property(facility => facility.Name).IsRequired().HasMaxLength(200);
        builder.Property(facility => facility.Address).IsRequired();
        builder.Property(facility => facility.IsActive).IsRequired();
    }
}
