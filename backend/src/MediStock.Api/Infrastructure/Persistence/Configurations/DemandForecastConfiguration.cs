namespace MediStock.Api.Infrastructure.Persistence.Configurations;

using MediStock.Api.Features.Demand.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public class DemandForecastConfiguration : IEntityTypeConfiguration<DemandForecast>
{
    public void Configure(EntityTypeBuilder<DemandForecast> builder)
    {
        builder.ToTable("DemandForecasts");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.FacilityId).IsRequired();
        builder.Property(x => x.MedicineId).IsRequired();
        builder.Property(x => x.ForecastDate).IsRequired();
        builder.Property(x => x.PredictedDemand).IsRequired();
        builder.Property(x => x.AverageDailyConsumption).IsRequired();

        builder.Property(x => x.Method)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(x => x.WindowDays).IsRequired();
        builder.Property(x => x.HorizonDays).IsRequired();
        builder.Property(x => x.LeadTimeDays).IsRequired();
        builder.Property(x => x.GeneratedAt).IsRequired();

        builder.Property(x => x.ConfidenceScore)
            .HasPrecision(5, 4)
            .IsRequired();

        builder.Property(x => x.Status)
            .IsRequired()
            .HasMaxLength(32);

        builder.HasIndex(x => new { x.FacilityId, x.MedicineId, x.GeneratedAt })
            .HasDatabaseName("IX_DemandForecasts_Facility_Medicine_GeneratedAt");
    }
}
