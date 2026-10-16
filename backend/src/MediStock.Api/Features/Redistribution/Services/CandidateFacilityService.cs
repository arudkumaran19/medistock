namespace MediStock.Api.Features.Redistribution.Services;

using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Ranks facilities that could supply a transfer. Redistribution vertical (Member 3).
///
/// Same scoring as the redistribution design - 60 points for how much of the request
/// the surplus covers, 40 for proximity, nothing beyond 300 km - but read from the
/// shared Inventory tables (InventoryBalances, MedicineBatches) rather than a separate
/// inventory table, so a transfer always sees the same stock every other screen does.
///
/// Read-only. Choosing a candidate does not reserve anything; that happens only after
/// a manager approves and the transfer is reserved.
/// </summary>
public sealed class CandidateFacilityService
{
    private const double ProximityCutoffKm = 300.0;

    private readonly ApplicationDbContext _db;
    private readonly RoutingService _routing;

    public CandidateFacilityService(ApplicationDbContext db, RoutingService routing)
    {
        _db = db;
        _routing = routing;
    }

    public async Task<IReadOnlyList<CandidateFacilityResponse>> RankAsync(
        Guid medicineId,
        Guid destinationFacilityId,
        int quantity,
        CancellationToken cancellationToken = default)
    {
        var balances = await _db.InventoryBalances
            .AsNoTracking()
            .Include(x => x.Medicine)
            .Include(x => x.Facility)
            .Where(x => x.MedicineId == medicineId
                        && x.FacilityId != destinationFacilityId
                        && x.Facility.IsActive
                        && x.Medicine.IsActive)
            .ToListAsync(cancellationToken);

        var facilityIds = balances.Select(x => x.FacilityId).ToList();

        // Earliest expiry still holding stock, per facility, so a short-dated batch is
        // visible before it is chosen.
        var expiries = await _db.MedicineBatches
            .AsNoTracking()
            .Where(x => x.MedicineId == medicineId && facilityIds.Contains(x.FacilityId) && x.QuantityOnHand > 0)
            .GroupBy(x => x.FacilityId)
            .Select(g => new { FacilityId = g.Key, Nearest = g.Min(x => x.ExpiryDateUtc) })
            .ToDictionaryAsync(x => x.FacilityId, x => x.Nearest, cancellationToken);

        var candidates = new List<CandidateFacilityResponse>();

        foreach (var balance in balances)
        {
            var surplus = balance.QuantityOnHand - balance.QuantityReserved - balance.Medicine.MinimumStockLevel;

            if (surplus <= 0)
            {
                // Giving stock away would push this facility below its own minimum.
                continue;
            }

            var (distanceKm, minutes) = _routing.Estimate(balance.FacilityId, destinationFacilityId);

            var coverage = quantity > 0 ? Math.Min(1.0, (double)surplus / quantity) : 0.0;
            var proximity = Math.Max(0.0, 1.0 - ((double)distanceKm / ProximityCutoffKm));
            var score = Math.Round((coverage * 60.0) + (proximity * 40.0), 2);

            candidates.Add(new CandidateFacilityResponse
            {
                FacilityId = balance.FacilityId,
                FacilityName = balance.Facility.Name,
                QuantityOnHand = balance.QuantityOnHand,
                QuantityReserved = balance.QuantityReserved,
                MinimumStock = balance.Medicine.MinimumStockLevel,
                AvailableSurplus = surplus,
                CanFulfil = surplus >= quantity,
                NearestExpiryUtc = expiries.TryGetValue(balance.FacilityId, out var expiry) ? expiry : null,
                DistanceKm = distanceKm,
                DurationMinutes = minutes,
                Score = (decimal)score,
            });
        }

        return candidates
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.DistanceKm)
            .ToList();
    }
}
