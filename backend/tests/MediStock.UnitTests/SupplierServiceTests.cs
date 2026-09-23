using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Features.Procurement.Services;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MediStock.UnitTests;

public sealed class SupplierServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _dbContext;
    private readonly SupplierService _supplierService;

    public SupplierServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _dbContext = new ApplicationDbContext(options);

        _dbContext.Database.EnsureCreated();

        _supplierService = new SupplierService(_dbContext);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsSuppliersOrderedByName()
    {
        _dbContext.Suppliers.AddRange(
            new Supplier
            {
                Id = Guid.NewGuid(),
                Name = "Zeta Pharmaceuticals",
                ContactPerson = "Person Z",
                Email = "zeta@test.com",
                Phone = "0110000000",
                Address = "Colombo",
                LeadTimeDays = 5,
                IsActive = true
            },
            new Supplier
            {
                Id = Guid.NewGuid(),
                Name = "Alpha Pharmaceuticals",
                ContactPerson = "Person A",
                Email = "alpha@test.com",
                Phone = "0110000001",
                Address = "Colombo",
                LeadTimeDays = 3,
                IsActive = true
            });

        await _dbContext.SaveChangesAsync();

        var result = await _supplierService.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Equal("Alpha Pharmaceuticals", result[0].Name);
        Assert.Equal("Zeta Pharmaceuticals", result[1].Name);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsExistingSupplier()
    {
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = "MediCare Pharmaceuticals",
            ContactPerson = "Kamal Perera",
            Email = "kamal@test.com",
            Phone = "0111234567",
            Address = "Colombo",
            LeadTimeDays = 7,
            IsActive = true
        };

        _dbContext.Suppliers.Add(supplier);
        await _dbContext.SaveChangesAsync();

        var result = await _supplierService.GetByIdAsync(supplier.Id);

        Assert.NotNull(result);
        Assert.Equal(supplier.Id, result.Id);
        Assert.Equal("MediCare Pharmaceuticals", result.Name);
        Assert.Equal(7, result.LeadTimeDays);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNullForMissingSupplier()
    {
        var result = await _supplierService.GetByIdAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task CreateAsync_PersistsSupplier()
    {
        var request = new SupplierRequest(
            "New Supplier",
            "Supplier Contact",
            "supplier@test.com",
            "0119876543",
            "Colombo",
            10,
            true);

        var result = await _supplierService.CreateAsync(request);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("New Supplier", result.Name);
        Assert.Equal("Supplier Contact", result.ContactPerson);
        Assert.Equal(10, result.LeadTimeDays);

        var storedSupplier = await _dbContext.Suppliers
            .SingleAsync(supplier => supplier.Id == result.Id);

        Assert.Equal("New Supplier", storedSupplier.Name);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesExistingSupplier()
    {
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = "Original Supplier",
            ContactPerson = "Original Contact",
            Email = "original@test.com",
            Phone = "0111111111",
            Address = "Colombo",
            LeadTimeDays = 5,
            IsActive = true
        };

        _dbContext.Suppliers.Add(supplier);
        await _dbContext.SaveChangesAsync();

        var request = new SupplierRequest(
            "Updated Supplier",
            "Updated Contact",
            "updated@test.com",
            "0112222222",
            "Kandy",
            12,
            false);

        var result = await _supplierService.UpdateAsync(
            supplier.Id,
            request);

        Assert.NotNull(result);
        Assert.Equal("Updated Supplier", result.Name);
        Assert.Equal("Updated Contact", result.ContactPerson);
        Assert.Equal(12, result.LeadTimeDays);
        Assert.False(result.IsActive);

        var storedSupplier = await _dbContext.Suppliers
            .SingleAsync(item => item.Id == supplier.Id);

        Assert.Equal("Updated Supplier", storedSupplier.Name);
        Assert.Equal("Kandy", storedSupplier.Address);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNullForMissingSupplier()
    {
        var request = new SupplierRequest(
            "Updated Supplier",
            "Updated Contact",
            "updated@test.com",
            "0112222222",
            "Kandy",
            12,
            true);

        var result = await _supplierService.UpdateAsync(
            Guid.NewGuid(),
            request);

        Assert.Null(result);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        _connection.Dispose();
    }
}