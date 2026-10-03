namespace MediStock.Api.Infrastructure.Persistence.Configurations;

using MediStock.Api.Features.Demand.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public class ShortageAlertConfiguration : IEntityTypeConfiguration<ShortageAlert>
{
    public void Configure(EntityTypeBuilder<ShortageAlert> builder)
    {
        builder.ToTable("ShortageAlerts");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.FacilityId).IsRequired();
        builder.Property(x => x.MedicineId).IsRequired();
        builder.Property(x => x.CurrentStock).IsRequired();
        builder.Property(x => x.AverageDailyConsumption).IsRequired();
        builder.Property(x => x.DaysRemaining).IsRequired();
        builder.Property(x => x.LeadTimeDays).IsRequired();
        builder.Property(x => x.RequiresTransfer).IsRequired();
        builder.Property(x => x.GeneratedAt).IsRequired();

        builder.Property(x => x.RiskLevel)
            .IsRequired()
            .HasMaxLength(16);

        builder.Property(x => x.Status)
            .IsRequired()
            .HasMaxLength(32);

        // The forecast an alert was derived from. Left as a plain nullable key rather
        // than a required relationship so an alert recalculated from a caller-supplied
        // stock figure is still valid.
        builder.HasOne<DemandForecast>()
            .WithMany()
            .HasForeignKey(x => x.DemandForecastId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => new { x.FacilityId, x.Status, x.GeneratedAt })
            .HasDatabaseName("IX_ShortageAlerts_Facility_Status_GeneratedAt");

        builder.HasIndex(x => x.RiskLevel)
            .HasDatabaseName("IX_ShortageAlerts_RiskLevel");
    }
}
