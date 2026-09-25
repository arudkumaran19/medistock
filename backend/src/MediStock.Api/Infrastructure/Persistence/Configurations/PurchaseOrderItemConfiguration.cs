using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Procurement.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MediStock.Api.Infrastructure.Persistence.Configurations;

public sealed class PurchaseOrderItemConfiguration
    : IEntityTypeConfiguration<PurchaseOrderItem>
{
    public void Configure(
        EntityTypeBuilder<PurchaseOrderItem> builder)
    {
        builder.ToTable(
            "PurchaseOrderItems",
            tableBuilder => tableBuilder.HasCheckConstraint(
                "CK_PurchaseOrderItems_RequestedQuantity_Positive",
                "\"RequestedQuantity\" > 0"));

        builder.HasKey(x => x.Id);

        builder.Property(x => x.PurchaseOrderId)
            .IsRequired();

        builder.Property(x => x.MedicineId)
            .IsRequired();

        builder.Property(x => x.RequestedQuantity)
            .IsRequired();

        builder.Property(x => x.UnitPrice)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.HasOne<Medicine>()
            .WithMany()
            .HasForeignKey(x => x.MedicineId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}