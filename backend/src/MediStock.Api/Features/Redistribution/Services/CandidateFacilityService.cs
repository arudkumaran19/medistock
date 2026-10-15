using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Data;
using MediStock.Api.Features.Redistribution.DTOs;
using MediStock.Api.Infrastructure.Persistence;

namespace MediStock.Api.Features.Redistribution.Services;

public class CandidateFacilityService : ICandidateFacilityService
{
    private readonly MediStockDbContext _dbContext;
    private readonly ApplicationDbContext? _appDbContext;
    private readonly IRoutingService _routingService;
    private readonly ILogger<CandidateFacilityService> _logger;

    public CandidateFacilityService(
        MediStockDbContext dbContext,
        IRoutingService routingService,
        ILogger<CandidateFacilityService> logger,
        ApplicationDbContext? appDbContext = null)
    {
        _dbContext = dbContext;
        _routingService = routingService;
        _logger = logger;
        _appDbContext = appDbContext;
    }

    public async Task<List<CandidateFacilityResponse>> FindCandidatesAsync(
        Guid destinationFacilityId,
        Guid medicineId,
        int requestedQuantity,
        CancellationToken ct = default)
    {
        var destination = await _dbContext.Facilities
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == destinationFacilityId, ct);

        if (destination == null)
        {
            _logger.LogWarning("Destination facility {DestinationFacilityId} not found when searching candidates", destinationFacilityId);
            return new List<CandidateFacilityResponse>();
        }

        // Requirement 2: Coordinates guard - never compute a route to/from (0,0) or invalid coordinates
        if ((destination.Latitude == 0 && destination.Longitude == 0) || double.IsNaN(destination.Latitude) || double.IsNaN(destination.Longitude))
        {
            _logger.LogWarning("Destination facility {DestinationFacilityId} ({Name}) has invalid coordinates ({Lat},{Lng}). Route calculation skipped.", destinationFacilityId, destination.Name, destination.Latitude, destination.Longitude);
            return new List<CandidateFacilityResponse>();
        }

        var candidateResponses = new List<CandidateFacilityResponse>();

        // Option B: Read from InventoryBalances (Single Source of Truth) if ApplicationDbContext is available
        if (_appDbContext != null)
        {
            var balances = await _appDbContext.InventoryBalances
                .AsNoTracking()
                .Include(ib => ib.Facility)
                .Include(ib => ib.Medicine)
                .Where(ib => ib.FacilityId != destinationFacilityId
                          && ib.MedicineId == medicineId
                          && ib.Facility != null
                          && ib.Facility.IsActive)
                .ToListAsync(ct);

            foreach (var ib in balances)
            {
                var facility = ib.Facility!;

                // Requirement 2: Coordinates guard - candidate facility must have valid coordinates (not 0,0 and not null)
                if ((facility.Latitude == 0 && facility.Longitude == 0) || double.IsNaN(facility.Latitude) || double.IsNaN(facility.Longitude))
                {
                    _logger.LogWarning("Candidate facility {FacilityId} ({FacilityName}) skipped due to invalid coordinates ({Lat}, {Lng})", facility.Id, facility.Name, facility.Latitude, facility.Longitude);
                    continue;
                }

                var minStock = ib.Medicine?.MinimumStockLevel ?? 0;
                var availableSurplus = ib.QuantityOnHand - minStock - ib.QuantityReserved;

                // Must have strictly positive surplus
                if (availableSurplus <= 0)
                {
                    continue;
                }

                var route = await _routingService.CalculateRouteAsync(facility, destination, ct);
                var recommendedQty = Math.Min(availableSurplus, requestedQuantity);

                // Scoring algorithm:
                // 60% weight on meeting requested shortage quantity
                // 40% weight on proximity (normalized to 300km)
                var surplusCoverageRatio = Math.Min(1.0, (double)availableSurplus / Math.Max(1, requestedQuantity));
                var proximityRatio = Math.Max(0.0, 1.0 - ((double)route.DistanceKm / 300.0));
                var score = Math.Round((surplusCoverageRatio * 60.0) + (proximityRatio * 40.0), 2);

                candidateResponses.Add(new CandidateFacilityResponse
                {
                    FacilityId = facility.Id,
                    FacilityName = facility.Name,
                    FacilityCode = facility.FacilityCode,
                    FacilityType = facility.FacilityType,
                    City = facility.City,
                    Latitude = facility.Latitude,
                    Longitude = facility.Longitude,
                    AvailableSurplus = availableSurplus,
                    StockOnHand = ib.QuantityOnHand,
                    SafetyStockThreshold = minStock,
                    DistanceKm = route.DistanceKm,
                    EstimatedDurationMinutes = route.DurationMinutes,
                    RoutingProvider = route.Provider,
                    RecommendedQuantity = recommendedQty,
                    Score = score
                });
            }

            if (candidateResponses.Any())
            {
                return candidateResponses
                    .OrderByDescending(c => c.Score)
                    .ThenBy(c => c.DistanceKm)
                    .ToList();
            }
        }

        // Fallback for in-memory unit tests or environments where only MediStockDbContext is configured
        var candidateInventories = await _dbContext.FacilityInventories
            .AsNoTracking()
            .Include(fi => fi.Facility)
            .Where(fi => fi.FacilityId != destinationFacilityId
                      && fi.MedicineId == medicineId
                      && fi.Facility != null
                      && fi.Facility.IsActive)
            .ToListAsync(ct);

        foreach (var inv in candidateInventories)
        {
            var facility = inv.Facility!;

            // Requirement 2: Coordinates guard
            if ((facility.Latitude == 0 && facility.Longitude == 0) || double.IsNaN(facility.Latitude) || double.IsNaN(facility.Longitude))
            {
                _logger.LogWarning("Candidate facility {FacilityId} ({FacilityName}) skipped due to invalid coordinates ({Lat}, {Lng})", facility.Id, facility.Name, facility.Latitude, facility.Longitude);
                continue;
            }

            var availableSurplus = inv.StockOnHand - inv.SafetyStockThreshold - inv.ReservedStock;
            if (availableSurplus <= 0)
            {
                continue;
            }

            var route = await _routingService.CalculateRouteAsync(facility, destination, ct);
            var recommendedQty = Math.Min(availableSurplus, requestedQuantity);

            var surplusCoverageRatio = Math.Min(1.0, (double)availableSurplus / Math.Max(1, requestedQuantity));
            var proximityRatio = Math.Max(0.0, 1.0 - ((double)route.DistanceKm / 300.0));
            var score = Math.Round((surplusCoverageRatio * 60.0) + (proximityRatio * 40.0), 2);

            candidateResponses.Add(new CandidateFacilityResponse
            {
                FacilityId = facility.Id,
                FacilityName = facility.Name,
                FacilityCode = facility.FacilityCode,
                FacilityType = facility.FacilityType,
                City = facility.City,
                Latitude = facility.Latitude,
                Longitude = facility.Longitude,
                AvailableSurplus = availableSurplus,
                StockOnHand = inv.StockOnHand,
                SafetyStockThreshold = inv.SafetyStockThreshold,
                DistanceKm = route.DistanceKm,
                EstimatedDurationMinutes = route.DurationMinutes,
                RoutingProvider = route.Provider,
                RecommendedQuantity = recommendedQty,
                Score = score
            });
        }

        return candidateResponses
            .OrderByDescending(c => c.Score)
            .ThenBy(c => c.DistanceKm)
            .ToList();
    }

    public async Task<List<CandidateFacilityResponse>> FindCandidatesForTransferAsync(
        Guid transferRequestId,
        CancellationToken ct = default)
    {
        var transfer = await _dbContext.TransferRequests
            .AsNoTracking()
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == transferRequestId, ct);

        if (transfer == null || !transfer.Items.Any())
        {
            return new List<CandidateFacilityResponse>();
        }

        var primaryItem = transfer.Items.First();
        return await FindCandidatesAsync(
            transfer.DestinationFacilityId,
            primaryItem.MedicineId,
            primaryItem.RequestedQuantity,
            ct);
    }
}
