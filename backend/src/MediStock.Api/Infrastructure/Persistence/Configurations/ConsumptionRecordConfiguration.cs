namespace MediStock.Api.Infrastructure.Persistence.Configurations;

using MediStock.Api.Features.Demand.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public class ConsumptionRecordConfiguration : IEntityTypeConfiguration<ConsumptionRecord>
{
    public void Configure(EntityTypeBuilder<ConsumptionRecord> builder)
    {
        builder.ToTable("ConsumptionRecords");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.FacilityId).IsRequired();
        builder.Property(x => x.MedicineId).IsRequired();
        builder.Property(x => x.QuantityUsed).IsRequired();
        builder.Property(x => x.ConsumptionDate).IsRequired();

        builder.Property(x => x.Source)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(x => x.Notes)
            .HasMaxLength(512);

        builder.Property(x => x.CreatedAt).IsRequired();

        // Consumption is always read as a per-facility, per-medicine time series,
        // which is exactly the shape the forecast window query uses.
        builder.HasIndex(x => new { x.FacilityId, x.MedicineId, x.ConsumptionDate })
            .HasDatabaseName("IX_ConsumptionRecords_Facility_Medicine_Date");
    }
}
