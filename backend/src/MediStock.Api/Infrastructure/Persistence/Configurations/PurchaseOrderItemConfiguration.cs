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

        builder.HasKey(purchaseOrderItem => purchaseOrderItem.Id);

        builder.Property(purchaseOrderItem => purchaseOrderItem.PurchaseOrderId)
            .IsRequired();

        builder.Property(purchaseOrderItem => purchaseOrderItem.MedicineId)
            .IsRequired();

        builder.Property(purchaseOrderItem => purchaseOrderItem.RequestedQuantity)
            .IsRequired();

        builder.Property(purchaseOrderItem => purchaseOrderItem.UnitPrice)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.HasOne<PurchaseOrder>()
            .WithMany()
            .HasForeignKey(purchaseOrderItem => purchaseOrderItem.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}