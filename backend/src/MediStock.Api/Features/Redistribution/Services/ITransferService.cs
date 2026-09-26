using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Common;
using MediStock.Api.Domain.Enums;
using MediStock.Api.Features.Redistribution.DTOs;

namespace MediStock.Api.Features.Redistribution.Services;

public interface ITransferService
{
    // 8 Core API Endpoints Support
    Task<PagedResponse<TransferResponse>> GetTransfersAsync(
        int page,
        int pageSize,
        string? search,
        string? sortBy,
        string? sortOrder,
        Guid? facilityId,
        TransferStatus? status,
        CancellationToken ct = default);

    Task<TransferResponse?> GetTransferByIdAsync(Guid id, CancellationToken ct = default);

    Task<ApiResponse<TransferResponse>> CreateTransferAsync(CreateTransferRequest request, Guid userId, CancellationToken ct = default);

    Task<ApiResponse<TransferResponse>> SubmitTransferRequestAsync(Guid transferId, Guid userId, string? notes = null, CancellationToken ct = default);

    Task<ApiResponse<TransferResponse>> ReserveTransferAsync(Guid transferId, ReserveTransferRequest request, CancellationToken ct = default);

    Task<ApiResponse<TransferResponse>> ReceiveTransferAsync(Guid transferId, ReceiveTransferRequest request, CancellationToken ct = default);

    Task<ApiResponse<List<CandidateFacilityResponse>>> GetCandidatesForTransferAsync(Guid transferId, CancellationToken ct = default);

    Task<ApiResponse<RouteResponse>> GetRouteForTransferAsync(Guid transferId, CancellationToken ct = default);

    // Internal workflow / orchestration transitions (triggered by WorkflowController / ApprovalService)
    Task<ApiResponse<TransferResponse>> ApproveTransferInternalAsync(Guid transferId, Guid approverUserId, string? notes = null, CancellationToken ct = default);

    Task<ApiResponse<TransferResponse>> RejectTransferInternalAsync(Guid transferId, Guid rejectorUserId, string reason, CancellationToken ct = default);

    Task<ApiResponse<TransferResponse>> ProposeCandidateInternalAsync(Guid transferId, Guid sourceFacilityId, Guid userId, CancellationToken ct = default);

    Task AttachWorkflowRunInternalAsync(Guid transferId, Guid workflowRunId, CancellationToken ct = default);
}
