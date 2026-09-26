using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace MediStock.Api.Features.Workflow.Services;

public record AgentPlanningRequest(
    Guid WorkflowRunId,
    Guid DestinationFacilityId,
    Guid MedicineId,
    int ShortageQuantity,
    string? AdditionalContext = null);

public record AgentPlanningResult(
    bool Success,
    Guid? SelectedFacilityId,
    string? SelectedFacilityName,
    int ProposedQuantity,
    decimal DistanceKm,
    decimal DurationMinutes,
    string Provider,
    string Reasoning,
    int PromptTokens,
    int CompletionTokens,
    long ExecutionTimeMs,
    List<AgentToolCallRecord> ToolCalls,
    string? ErrorMessage = null);

public record AgentToolCallRecord(
    string ToolName,
    string InputJson,
    string OutputJson,
    long DurationMs,
    bool Success);

public interface IAgentGateway
{
    Task<AgentPlanningResult> RunRedistributionPlanningAgentAsync(AgentPlanningRequest request, CancellationToken ct = default);
}
