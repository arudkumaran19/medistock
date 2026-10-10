using System;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Services;

public interface IRoutingService
{
    Task<RouteResponse> CalculateRouteAsync(Facility source, Facility destination, CancellationToken ct = default);
    Task<RouteResponse> CalculateRouteCoordinatesAsync(
        double sourceLat,
        double sourceLon,
        double destLat,
        double destLon,
        string sourceName = "",
        string destName = "",
        Guid? sourceId = null,
        Guid? destId = null,
        CancellationToken ct = default);
}
