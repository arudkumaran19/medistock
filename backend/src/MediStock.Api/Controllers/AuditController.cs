using MediStock.Api.Common;
using MediStock.Api.Common.Audit;
using MediStock.Api.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediStock.Api.Controllers;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = Constants.Roles.Admin)]
[Produces("application/json")]
public class AuditController : ControllerBase
{
    private readonly IAuditService _auditService;

    public AuditController(IAuditService auditService)
    {
        _auditService = auditService;
    }

    /// <summary>
    /// Paged, filterable, searchable system audit logs. Administrator access only.
    /// Audits access to the audit log itself.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<SystemAuditLog>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] string? resourceId,
        [FromQuery] string? actor,
        [FromQuery] string? outcome,
        [FromQuery] string? correlationId,
        [FromQuery] string? search,
        [FromQuery] DateTimeOffset? fromUtc,
        [FromQuery] DateTimeOffset? toUtc,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortOrder,
        [FromQuery] int page = Constants.DefaultPage,
        [FromQuery] int pageSize = Constants.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var query = new AuditLogQuery(
            action,
            resourceType,
            resourceId,
            actor,
            outcome,
            correlationId,
            search,
            fromUtc,
            toUtc,
            sortBy ?? "Timestamp",
            sortOrder ?? "desc",
            page,
            pageSize);

        var result = await _auditService.QueryLogsAsync(query, cancellationToken);

        // Audit the inspection of audit logs
        await _auditService.LogAsync(
            action: "AUDIT_LOG_VIEWED",
            resourceType: "SystemAuditLog",
            resourceId: null,
            outcome: "Success",
            details: $"{{\"Page\":{page},\"PageSize\":{pageSize},\"FilterSearch\":\"{search}\"}}",
            cancellationToken: cancellationToken);

        return Ok(new ApiResponse<PagedResponse<SystemAuditLog>>(result));
    }

    /// <summary>
    /// Audit log statistics summary for operational and security dashboards.
    /// </summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(ApiResponse<AuditStatsResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken = default)
    {
        var stats = await _auditService.GetStatsAsync(cancellationToken);
        return Ok(new ApiResponse<AuditStatsResponse>(stats));
    }

    /// <summary>
    /// Single audit event detail with full state snapshot.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<SystemAuditLog>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken = default)
    {
        var log = await _auditService.GetByIdAsync(id, cancellationToken);
        if (log is null)
        {
            return NotFound(new ErrorResponse
            {
                Error = new ErrorDetail
                {
                    Code = "AUDIT_LOG_NOT_FOUND",
                    Message = $"Audit log entry {id} was not found.",
                    TraceId = HttpContext.TraceIdentifier,
                }
            });
        }

        return Ok(new ApiResponse<SystemAuditLog>(log));
    }

    /// <summary>
    /// Export audit logs as CSV. Administrator access only.
    /// Audits the export action for non-repudiation.
    /// </summary>
    [HttpGet("export")]
    [Produces("text/csv")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportLogs(
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] string? actor,
        [FromQuery] string? outcome,
        [FromQuery] string? search,
        [FromQuery] DateTimeOffset? fromUtc,
        [FromQuery] DateTimeOffset? toUtc,
        CancellationToken cancellationToken = default)
    {
        var query = new AuditLogQuery(
            action,
            resourceType,
            null,
            actor,
            outcome,
            null,
            search,
            fromUtc,
            toUtc);

        var bytes = await _auditService.ExportCsvAsync(query, cancellationToken);

        await _auditService.LogAsync(
            action: "AUDIT_LOG_EXPORTED",
            resourceType: "SystemAuditLog",
            resourceId: null,
            outcome: "Success",
            details: "{\"Format\":\"CSV\"}",
            cancellationToken: cancellationToken);

        var filename = $"medistock-audit-export-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
        return File(bytes, "text/csv", filename);
    }
}
