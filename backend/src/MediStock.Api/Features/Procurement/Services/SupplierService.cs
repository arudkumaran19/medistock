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
        string? search = null,
        bool? isActive = null,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Suppliers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmedSearch = search.Trim();
            query = query.Where(s =>
                EF.Functions.Like(s.Name, $"%{trimmedSearch}%") ||
                EF.Functions.Like(s.ContactPerson, $"%{trimmedSearch}%") ||
                EF.Functions.Like(s.Email, $"%{trimmedSearch}%"));
        }

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        return await query
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
        Validators.ProcurementValidator.ValidateSupplier(request);

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            ContactPerson = request.ContactPerson.Trim(),
            Email = request.Email.Trim(),
            Phone = request.Phone.Trim(),
            Address = request.Address.Trim(),
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
        Validators.ProcurementValidator.ValidateSupplier(request);

        var supplier = await _dbContext.Suppliers
            .SingleOrDefaultAsync(
                supplier => supplier.Id == id,
                cancellationToken);

        if (supplier is null)
        {
            return null;
        }

        supplier.Name = request.Name.Trim();
        supplier.ContactPerson = request.ContactPerson.Trim();
        supplier.Email = request.Email.Trim();
        supplier.Phone = request.Phone.Trim();
        supplier.Address = request.Address.Trim();
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