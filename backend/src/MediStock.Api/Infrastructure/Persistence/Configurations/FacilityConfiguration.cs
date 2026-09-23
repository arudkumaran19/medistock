using MediStock.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MediStock.Api.Infrastructure.Persistence.Configurations;

public sealed class FacilityConfiguration
    : IEntityTypeConfiguration<Facility>
{
    public void Configure(
        EntityTypeBuilder<Facility> builder)
    {
        builder.ToTable("Facilities");

        builder.HasKey(facility => facility.Id);

        builder.Property(facility => facility.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(facility => facility.IsActive)
            .IsRequired()
            .HasDefaultValue(true);
    }
}
