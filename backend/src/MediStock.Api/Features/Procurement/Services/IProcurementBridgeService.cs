using System;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Common;
using MediStock.Api.Features.Procurement.DTOs;

namespace MediStock.Api.Features.Procurement.Services;

public interface IProcurementBridgeService
{
    Task<ApiResponse<ReplenishmentRequestDto>> CreateReplenishmentRequestFromTransferAsync(
        Guid transferId,
        Guid rejectorUserId,
        string reason,
        CancellationToken ct = default);
}
