using System;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Common;
using MediStock.Api.Features.Workflow.DTOs;

namespace MediStock.Api.Features.Workflow.Services;

public interface IApprovalService
{
    Task<ApiResponse<WorkflowResponse>> ApproveAsync(Guid workflowRunId, ApprovalRequest request, CancellationToken ct = default);
    Task<ApiResponse<WorkflowResponse>> RejectAsync(Guid workflowRunId, ApprovalRequest request, CancellationToken ct = default);
}
