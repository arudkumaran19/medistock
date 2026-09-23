using MediStock.Api.Features.Procurement.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MediStock.Api.Infrastructure.Persistence.Configurations;

public sealed class PurchaseOrderConfiguration
    : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(
        EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("PurchaseOrders");

        builder.HasKey(purchaseOrder => purchaseOrder.Id);

        builder.Property(purchaseOrder => purchaseOrder.SupplierId)
            .IsRequired();

        builder.Property(purchaseOrder => purchaseOrder.FacilityId)
            .IsRequired();

        builder.Property(purchaseOrder => purchaseOrder.Status)
            .IsRequired();

        builder.Property(purchaseOrder => purchaseOrder.RequestedAt)
            .IsRequired();

        builder.Property(purchaseOrder => purchaseOrder.ApprovedAt)
            .IsRequired(false);

        builder.Property(purchaseOrder => purchaseOrder.ReceivedAt)
            .IsRequired(false);

        builder.HasOne<Supplier>()
            .WithMany()
            .HasForeignKey(purchaseOrder => purchaseOrder.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Domain.Entities.Facility>()
            .WithMany()
            .HasForeignKey(purchaseOrder => purchaseOrder.FacilityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}