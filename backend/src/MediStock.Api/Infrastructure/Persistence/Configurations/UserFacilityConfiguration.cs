using MediStock.Api.Domain.Entities;
using MediStock.Api.Infrastructure.Persistence.Identity;
using Facility = MediStock.Api.Features.Inventory.Models.Facility;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MediStock.Api.Infrastructure.Persistence.Configurations;

public sealed class UserFacilityConfiguration : IEntityTypeConfiguration<UserFacility>
{
    public void Configure(EntityTypeBuilder<UserFacility> builder)
    {
        builder.ToTable("UserFacilities");
        builder.HasKey(userFacility => new { userFacility.UserId, userFacility.FacilityId });
        builder.HasOne<ApplicationUser>().WithMany()
            .HasForeignKey(userFacility => userFacility.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Facility>().WithMany()
            .HasForeignKey(userFacility => userFacility.FacilityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
