using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Inventory.Services;

public sealed class StockTransactionService(ApplicationDbContext db)
{
    public async Task<IReadOnlyList<StockTransaction>> GetForInventoryAsync(Guid medicineId, Guid facilityId, CancellationToken cancellationToken) => await db.StockTransactions.AsNoTracking().Where(x => x.MedicineId == medicineId && x.FacilityId == facilityId).OrderByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockTransactionResponse>> GetHistoryAsync(Guid medicineId, Guid facilityId, CancellationToken cancellationToken) =>
        await db.StockTransactions.AsNoTracking().Where(x => x.MedicineId == medicineId && x.FacilityId == facilityId)
            .OrderByDescending(x => x.CreatedAtUtc).Take(100)
            .Select(x => new StockTransactionResponse(x.Id, x.CreatedAtUtc, x.Type.ToString().ToUpperInvariant(), x.Quantity, x.Reason, x.BalanceAfter, x.MedicineBatch == null ? null : x.MedicineBatch.BatchNumber))
            .ToListAsync(cancellationToken);
}
