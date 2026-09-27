namespace MediStock.Api.Infrastructure.Persistence.Configurations;

using MediStock.Api.Features.Demand.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public class ReorderRuleConfiguration : IEntityTypeConfiguration<ReorderRule>
{
    public void Configure(EntityTypeBuilder<ReorderRule> builder)
    {
        builder.ToTable("ReorderRules");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.FacilityId).IsRequired();
        builder.Property(x => x.MedicineId).IsRequired();
        builder.Property(x => x.MinimumStock).IsRequired();
        builder.Property(x => x.ReorderPoint).IsRequired();
        builder.Property(x => x.SafetyStock).IsRequired();
        builder.Property(x => x.LeadTimeDays).IsRequired();
        builder.Property(x => x.CreatedAt).IsRequired();

        // One threshold rule per medicine per facility, so getShortageThreshold has a
        // single unambiguous answer.
        builder.HasIndex(x => new { x.FacilityId, x.MedicineId })
            .IsUnique()
            .HasDatabaseName("IX_ReorderRules_Facility_Medicine");
    }
}
