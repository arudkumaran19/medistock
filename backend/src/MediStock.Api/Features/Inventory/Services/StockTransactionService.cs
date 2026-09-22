using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Inventory.Services;

public sealed class StockTransactionService(ApplicationDbContext db)
{
    public async Task<IReadOnlyList<StockTransaction>> GetForInventoryAsync(Guid medicineId, Guid facilityId, CancellationToken cancellationToken) => await db.StockTransactions.AsNoTracking().Where(x => x.MedicineId == medicineId && x.FacilityId == facilityId).OrderByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
}