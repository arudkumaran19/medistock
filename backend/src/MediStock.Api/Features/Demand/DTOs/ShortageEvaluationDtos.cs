namespace MediStock.Api.Features.Demand.DTOs;

/// <summary>
/// What an automatic shortage evaluation did for one facility and medicine.
/// Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// </summary>
public static class ShortageEvaluationOutcomes
{
    /// <summary>A new OPEN alert was raised.</summary>
    public const string Created = "CREATED";

    /// <summary>The existing OPEN or ACKNOWLEDGED alert was recalculated.</summary>
    public const string Updated = "UPDATED";

    /// <summary>The existing active alert was resolved because stock now covers lead time.</summary>
    public const string Resolved = "RESOLVED";

    /// <summary>No shortage and no active alert, so nothing changed.</summary>
    public const string NoChange = "NO_CHANGE";

    /// <summary>Not evaluated: no reorder rule or no inventory balance.</summary>
    public const string Skipped = "SKIPPED";

    /// <summary>The evaluation threw. Logged; the caller's own work is unaffected.</summary>
    public const string Failed = "FAILED";
}

/// <summary>Result of evaluating one facility and medicine.</summary>
/// <param name="FacilityId">Facility evaluated.</param>
/// <param name="MedicineId">Medicine evaluated.</param>
/// <param name="Outcome">One of <see cref="ShortageEvaluationOutcomes"/>.</param>
/// <param name="Reason">Why it was skipped or failed, null otherwise.</param>
/// <param name="Alert">The alert that was created, updated or resolved, if any.</param>
public sealed record ShortageEvaluationResult(
    Guid FacilityId,
    Guid MedicineId,
    string Outcome,
    string? Reason,
    ShortageResponse? Alert);

/// <summary>Response of POST /api/shortages/scan.</summary>
public sealed record ShortageScanResponse(
    int Evaluated,
    int Created,
    int Updated,
    int Resolved,
    int Unchanged,
    int Skipped,
    int Failed,
    IReadOnlyList<ShortageEvaluationResult> Results);
