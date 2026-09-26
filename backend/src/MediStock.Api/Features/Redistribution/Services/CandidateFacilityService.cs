using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MediStock.Api.Data;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Services;

public class CandidateFacilityService : ICandidateFacilityService
{
    private readonly MediStockDbContext _dbContext;
    private readonly IRoutingService _routingService;
    private readonly ILogger<CandidateFacilityService> _logger;

    public CandidateFacilityService(
        MediStockDbContext dbContext,
        IRoutingService routingService,
        ILogger<CandidateFacilityService> logger)
    {
        _dbContext = dbContext;
        _routingService = routingService;
        _logger = logger;
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

        // Query active candidate facilities that have inventory records for the requested medicine
        var candidateInventories = await _dbContext.FacilityInventories
            .AsNoTracking()
            .Include(fi => fi.Facility)
            .Where(fi => fi.FacilityId != destinationFacilityId
                      && fi.MedicineId == medicineId
                      && fi.Facility != null
                      && fi.Facility.IsActive)
            .ToListAsync(ct);

        var candidateResponses = new List<CandidateFacilityResponse>();

        foreach (var inv in candidateInventories)
        {
            var facility = inv.Facility!;
            var availableSurplus = inv.StockOnHand - inv.SafetyStockThreshold - inv.ReservedStock;

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
