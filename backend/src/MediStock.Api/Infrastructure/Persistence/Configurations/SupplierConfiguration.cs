using MediStock.Api.Features.Procurement.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MediStock.Api.Infrastructure.Persistence.Configurations;

public sealed class SupplierConfiguration
    : IEntityTypeConfiguration<Supplier>
{
    public void Configure(
        EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("Suppliers");

        builder.HasKey(supplier => supplier.Id);

        builder.Property(supplier => supplier.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(supplier => supplier.ContactPerson)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(supplier => supplier.Email)
            .IsRequired()
            .HasMaxLength(254);

        builder.Property(supplier => supplier.Phone)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(supplier => supplier.Address)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(supplier => supplier.LeadTimeDays)
            .IsRequired();

        builder.ToTable(
            "Suppliers",
            tableBuilder => tableBuilder.HasCheckConstraint(
                "CK_Suppliers_LeadTimeDays_NonNegative",
                "\"LeadTimeDays\" >= 0"));

        builder.Property(supplier => supplier.IsActive)
            .IsRequired()
            .HasDefaultValue(true);
    }
}