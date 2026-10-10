using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Services;

public interface ICandidateFacilityService
{
    Task<List<CandidateFacilityResponse>> FindCandidatesAsync(
        Guid destinationFacilityId,
        Guid medicineId,
        int requestedQuantity,
        CancellationToken ct = default);

    Task<List<CandidateFacilityResponse>> FindCandidatesForTransferAsync(
        Guid transferRequestId,
        CancellationToken ct = default);
}
