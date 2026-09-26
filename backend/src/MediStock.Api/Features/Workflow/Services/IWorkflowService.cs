using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediStock.Api.Common;
using MediStock.Api.Features.Workflow.DTOs;
using MediStock.Api.Features.Workflow.Models;

namespace MediStock.Api.Features.Workflow.Services;

public interface IWorkflowService
{
    Task<ApiResponse<WorkflowResponse>> StartPlanningWorkflowAsync(StartWorkflowRequest request, CancellationToken ct = default);
    Task<WorkflowResponse?> GetWorkflowRunByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<AuditLog>> GetWorkflowAuditLogsAsync(Guid id, CancellationToken ct = default);
}
