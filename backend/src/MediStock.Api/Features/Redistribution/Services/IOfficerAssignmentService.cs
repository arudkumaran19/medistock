using System;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Common;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Services;

public interface IOfficerAssignmentService
{
    Task<ApiResponse<TransferResponse>> AssignOfficerAsync(Guid transferId, Guid? preferredOfficerId = null, CancellationToken ct = default);
}
