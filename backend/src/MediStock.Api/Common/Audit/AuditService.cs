using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MediStock.Api.Common;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Common.Audit;

public sealed class AuditService : IAuditService
{
    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditService> _logger;

    private static readonly Regex SensitiveKeyPattern = new(
        @"(password|token|secret|access_token|refresh_token|authorization|bearer|signingkey|connectionstring)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public AuditService(
        ApplicationDbContext db,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AuditService> logger)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(
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
        CancellationToken cancellationToken = default)
    {
        try
        {
            var httpContext = _httpContextAccessor.HttpContext;
            var user = httpContext?.User;

            var resolvedActorId = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                  ?? user?.FindFirst("sub")?.Value;
            var resolvedActorEmail = actorEmail
                                     ?? user?.FindFirst(ClaimTypes.Email)?.Value
                                     ?? user?.FindFirst("email")?.Value
                                     ?? user?.Identity?.Name
                                     ?? (resolvedActorId is null ? "Anonymous" : "System");
            var resolvedActorRole = actorRole
                                    ?? user?.FindFirst(ClaimTypes.Role)?.Value
                                    ?? user?.FindFirst("role")?.Value
                                    ?? "System";

            var resolvedCorrelationId = correlationId
                                        ?? httpContext?.Request?.Headers["X-Correlation-ID"].FirstOrDefault()
                                        ?? httpContext?.TraceIdentifier;

            var ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString();

            string? serializedDetails = null;
            if (details is string strDetails)
            {
                serializedDetails = Sanitize(strDetails);
            }
            else if (details is not null)
            {
                serializedDetails = Sanitize(JsonSerializer.Serialize(details));
            }

            var auditEntry = new SystemAuditLog
            {
                Id = Guid.NewGuid(),
                CorrelationId = resolvedCorrelationId,
                ActorId = resolvedActorId,
                ActorEmail = resolvedActorEmail,
                ActorRole = resolvedActorRole,
                Action = action,
                ResourceType = resourceType,
                ResourceId = resourceId,
                Outcome = outcome,
                Reason = reason,
                DetailsJson = serializedDetails,
                BeforeStateJson = Sanitize(beforeState),
                AfterStateJson = Sanitize(afterState),
                IpAddress = ipAddress,
                Timestamp = DateTimeOffset.UtcNow,
            };

            _db.SystemAuditLogs.Add(auditEntry);
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Audit: {Action} on {ResourceType}:{ResourceId} by {Actor} Outcome={Outcome}",
                action,
                resourceType,
                resourceId ?? "N/A",
                resolvedActorEmail,
                outcome);
        }
        catch (Exception ex)
        {
            // Do not fail the main user workflow if audit log persistence fails, but log fatal
            _logger.LogError(ex, "Failed to persist audit log entry for action {Action}", action);
        }
    }

    public async Task<PagedResponse<SystemAuditLog>> QueryLogsAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default)
    {
        var logs = _db.SystemAuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            logs = logs.Where(x => x.Action.ToLower() == query.Action.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query.ResourceType))
        {
            logs = logs.Where(x => x.ResourceType.ToLower() == query.ResourceType.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query.ResourceId))
        {
            logs = logs.Where(x => x.ResourceId == query.ResourceId);
        }

        if (!string.IsNullOrWhiteSpace(query.Actor))
        {
            var actor = query.Actor.Trim().ToLowerInvariant();
            logs = logs.Where(x =>
                (x.ActorEmail != null && x.ActorEmail.ToLower().Contains(actor)) ||
                (x.ActorId != null && x.ActorId.ToLower().Contains(actor)));
        }

        if (!string.IsNullOrWhiteSpace(query.Outcome))
        {
            logs = logs.Where(x => x.Outcome.ToLower() == query.Outcome.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query.CorrelationId))
        {
            logs = logs.Where(x => x.CorrelationId != null && x.CorrelationId.Contains(query.CorrelationId));
        }

        if (query.FromUtc.HasValue)
        {
            logs = logs.Where(x => x.Timestamp >= query.FromUtc.Value);
        }

        if (query.ToUtc.HasValue)
        {
            logs = logs.Where(x => x.Timestamp <= query.ToUtc.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            logs = logs.Where(x =>
                x.Action.ToLower().Contains(term) ||
                x.ResourceType.ToLower().Contains(term) ||
                (x.ActorEmail != null && x.ActorEmail.ToLower().Contains(term)) ||
                (x.Reason != null && x.Reason.ToLower().Contains(term)) ||
                (x.DetailsJson != null && x.DetailsJson.ToLower().Contains(term)));
        }

        var total = await logs.CountAsync(cancellationToken);

        // Sorting
        var sortOrder = query.SortOrder?.ToLowerInvariant() == "asc";
        logs = query.SortBy?.ToLowerInvariant() switch
        {
            "action" => sortOrder ? logs.OrderBy(x => x.Action) : logs.OrderByDescending(x => x.Action),
            "resourcetype" => sortOrder ? logs.OrderBy(x => x.ResourceType) : logs.OrderByDescending(x => x.ResourceType),
            "actor" or "actoremail" => sortOrder ? logs.OrderBy(x => x.ActorEmail) : logs.OrderByDescending(x => x.ActorEmail),
            "outcome" => sortOrder ? logs.OrderBy(x => x.Outcome) : logs.OrderByDescending(x => x.Outcome),
            _ => sortOrder ? logs.OrderBy(x => x.Timestamp) : logs.OrderByDescending(x => x.Timestamp),
        };

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var items = await logs
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResponse<SystemAuditLog>(items, total, page, pageSize);
    }

    public async Task<SystemAuditLog?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _db.SystemAuditLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public async Task<AuditStatsResponse> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var total = await _db.SystemAuditLogs.LongCountAsync(cancellationToken);
        var denials = await _db.SystemAuditLogs.LongCountAsync(x => x.Outcome == "Denied" || x.Action.Contains("DENIED"), cancellationToken);
        var mutations = await _db.SystemAuditLogs.LongCountAsync(x =>
            x.Action.Contains("CREATE") || x.Action.Contains("UPDATE") || x.Action.Contains("DELETE") || x.Action.Contains("ADJUST"),
            cancellationToken);
        var shortageEvents = await _db.SystemAuditLogs.LongCountAsync(x =>
            x.ResourceType == "ShortageAlert" || x.Action.StartsWith("SHORTAGE"),
            cancellationToken);
        var aiEvents = await _db.SystemAuditLogs.LongCountAsync(x =>
            x.ResourceType == "AI_COORDINATOR" || x.Action.StartsWith("AI_") || x.Action.StartsWith("AGENT_"),
            cancellationToken);

        var lastEvent = await _db.SystemAuditLogs
            .OrderByDescending(x => x.Timestamp)
            .Select(x => x.Timestamp)
            .FirstOrDefaultAsync(cancellationToken);

        return new AuditStatsResponse(
            total,
            denials,
            mutations,
            shortageEvents,
            aiEvents,
            lastEvent == default ? DateTimeOffset.UtcNow : lastEvent);
    }

    public async Task<byte[]> ExportCsvAsync(AuditLogQuery query, CancellationToken cancellationToken = default)
    {
        // Fetch up to 5,000 logs for export
        var exportQuery = query with { Page = 1, PageSize = 5000 };
        var paged = await QueryLogsAsync(exportQuery, cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("TimestampUtc,CorrelationId,ActorEmail,ActorRole,Action,ResourceType,ResourceId,Outcome,Reason,IpAddress");

        foreach (var log in paged.Items)
        {
            sb.AppendLine($"\"{log.Timestamp:O}\",\"{Escape(log.CorrelationId)}\",\"{Escape(log.ActorEmail)}\",\"{Escape(log.ActorRole)}\",\"{Escape(log.Action)}\",\"{Escape(log.ResourceType)}\",\"{Escape(log.ResourceId)}\",\"{Escape(log.Outcome)}\",\"{Escape(log.Reason)}\",\"{Escape(log.IpAddress)}\"");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string? Sanitize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;

        try
        {
            // If it's valid JSON, redact sensitive fields
            using var doc = JsonDocument.Parse(json);
            var sanitizedDict = new Dictionary<string, object?>();

            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (SensitiveKeyPattern.IsMatch(prop.Name))
                    {
                        sanitizedDict[prop.Name] = "[REDACTED]";
                    }
                    else
                    {
                        sanitizedDict[prop.Name] = prop.Value.Clone();
                    }
                }
                return JsonSerializer.Serialize(sanitizedDict);
            }

            return json;
        }
        catch
        {
            // If plain text, regex replace password=... or token=...
            return SensitiveKeyPattern.Replace(json, "[REDACTED]");
        }
    }

    private static string Escape(string? s) => s?.Replace("\"", "\"\"") ?? "";
}
