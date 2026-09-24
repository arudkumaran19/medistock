using MediStock.Api.Features.Procurement.DTOs;
using MediStock.Api.Features.Procurement.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Procurement.Services;

public sealed class SupplierService
{
    private readonly ApplicationDbContext _dbContext;

    public SupplierService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<SupplierResponse>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Suppliers
            .AsNoTracking()
            .OrderBy(supplier => supplier.Name)
            .Select(supplier => new SupplierResponse(
                supplier.Id,
                supplier.Name,
                supplier.ContactPerson,
                supplier.Email,
                supplier.Phone,
                supplier.Address,
                supplier.LeadTimeDays,
                supplier.IsActive))
            .ToListAsync(cancellationToken);
    }

    public async Task<SupplierResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Suppliers
            .AsNoTracking()
            .Where(supplier => supplier.Id == id)
            .Select(supplier => new SupplierResponse(
                supplier.Id,
                supplier.Name,
                supplier.ContactPerson,
                supplier.Email,
                supplier.Phone,
                supplier.Address,
                supplier.LeadTimeDays,
                supplier.IsActive))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<SupplierResponse> CreateAsync(
        SupplierRequest request,
        CancellationToken cancellationToken = default)
    {
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            ContactPerson = request.ContactPerson,
            Email = request.Email,
            Phone = request.Phone,
            Address = request.Address,
            LeadTimeDays = request.LeadTimeDays,
            IsActive = request.IsActive
        };

        _dbContext.Suppliers.Add(supplier);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SupplierResponse(
            supplier.Id,
            supplier.Name,
            supplier.ContactPerson,
            supplier.Email,
            supplier.Phone,
            supplier.Address,
            supplier.LeadTimeDays,
            supplier.IsActive);
    }

    public async Task<SupplierResponse?> UpdateAsync(
        Guid id,
        SupplierRequest request,
        CancellationToken cancellationToken = default)
    {
        var supplier = await _dbContext.Suppliers
            .SingleOrDefaultAsync(
                supplier => supplier.Id == id,
                cancellationToken);

        if (supplier is null)
        {
            return null;
        }

        supplier.Name = request.Name;
        supplier.ContactPerson = request.ContactPerson;
        supplier.Email = request.Email;
        supplier.Phone = request.Phone;
        supplier.Address = request.Address;
        supplier.LeadTimeDays = request.LeadTimeDays;
        supplier.IsActive = request.IsActive;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new SupplierResponse(
            supplier.Id,
            supplier.Name,
            supplier.ContactPerson,
            supplier.Email,
            supplier.Phone,
            supplier.Address,
            supplier.LeadTimeDays,
            supplier.IsActive);
    }
}