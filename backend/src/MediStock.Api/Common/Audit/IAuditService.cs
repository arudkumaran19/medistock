using MediStock.Api.Common;
using MediStock.Api.Domain.Entities;

namespace MediStock.Api.Common.Audit;

public record AuditLogQuery(
    string? Action = null,
    string? ResourceType = null,
    string? ResourceId = null,
    string? Actor = null,
    string? Outcome = null,
    string? CorrelationId = null,
    string? Search = null,
    DateTimeOffset? FromUtc = null,
    DateTimeOffset? ToUtc = null,
    string? SortBy = "Timestamp",
    string? SortOrder = "desc",
    int Page = Constants.DefaultPage,
    int PageSize = Constants.DefaultPageSize);

public record AuditStatsResponse(
    long TotalEvents,
    long SecurityDenials,
    long MutationsCount,
    long ShortageWorkflowEvents,
    long AiCoordinatorEvents,
    DateTimeOffset LastEventAt);

public interface IAuditService
{
    Task LogAsync(
        string action,
        string resourceType,
        string? resourceId = null,
        string outcome = "SUCCESS",
        object? details = null,
        string? beforeState = null,
        string? afterState = null,
        string? reason = null,
        string? actorEmail = null,
        string? actorRole = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

    Task<PagedResponse<SystemAuditLog>> QueryLogsAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default);

    Task<SystemAuditLog?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<AuditStatsResponse> GetStatsAsync(
        CancellationToken cancellationToken = default);

    Task<byte[]> ExportCsvAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default);
}
