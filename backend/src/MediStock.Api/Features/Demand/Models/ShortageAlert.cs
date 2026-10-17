namespace MediStock.Api.Features.Demand.Models;

/// <summary>
/// ShortageAlerts table. Demand &amp; Shortage vertical - Sathurstiga S. (IT24103156).
/// The final output of the demonstration chain:
/// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
/// </summary>
public class ShortageAlert
{
    public Guid Id { get; set; }

    public Guid FacilityId { get; set; }

    public Guid MedicineId { get; set; }

    /// <summary>
    /// Forecast this alert was derived from, when the alert came from the forecast chain.
    /// </summary>
    public Guid? DemandForecastId { get; set; }

    public decimal CurrentStock { get; set; }

    public decimal AverageDailyConsumption { get; set; }

    /// <summary>
    /// Whole days of stock remaining: floor(currentStock / averageDailyConsumption).
    ///
    /// Null when average daily consumption is zero: nothing is being consumed, so no
    /// stockout is projected. Zero would instead mean stock runs out today.
    ///
    /// Not specified in the final blueprint: the behaviour when average daily
    /// consumption is zero. Do not assume or introduce a new decision without
    /// team-level confirmation.
    /// </summary>
    public int? DaysRemaining { get; set; }

    /// <summary>
    /// Date stock is projected to reach zero.
    /// </summary>
    public DateTime? ProjectedStockoutDate { get; set; }

    /// <summary>
    /// Supplier lead time compared against <see cref="DaysRemaining"/> to decide risk.
    /// </summary>
    public int LeadTimeDays { get; set; }

    /// <summary>
    /// HIGH when days remaining is below lead time, otherwise MEDIUM.
    /// See <see cref="ShortageRiskLevels"/>.
    /// </summary>
    public string RiskLevel { get; set; } = ShortageRiskLevels.Medium;

    public bool RequiresTransfer { get; set; }

    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    public string Status { get; set; } = ShortageAlertStatuses.Open;

    /// <summary>
    /// Last time the figures were refreshed, for example when an existing open alert is
    /// recalculated instead of a duplicate being raised. Null until first refreshed.
    /// </summary>
    public DateTime? UpdatedAt { get; set; }

    /// <summary>When the alert moved to RESOLVED. Null while it is still active.</summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>
    /// Why the alert was resolved automatically, for example "Stock now covers lead time".
    /// Null for a manual resolve and for an active alert.
    /// </summary>
    public string? ResolutionReason { get; set; }

    /// <summary>Linked Inter-Hospital Transfer initiated to address this shortage.</summary>
    public Guid? TransferId { get; set; }

    public Guid? RelatedTransferId { get => TransferId; set => TransferId = value; }

    /// <summary>When the alert was dismissed (e.g. as a false positive). Null while active.</summary>
    public DateTime? DismissedAt { get; set; }

    /// <summary>User ID of the staff member who dismissed the alert.</summary>
    public Guid? DismissedByUserId { get; set; }

    /// <summary>User-provided or default explanation for dismissal.</summary>
    public string? DismissReason { get; set; }

    /// <summary>Linked Purchase Order initiated to replenish this shortage.</summary>
    public Guid? PurchaseOrderId { get; set; }

    /// <summary>Whether resolution was formally verified by inventory balance re-audit or delivery confirmation.</summary>
    public bool ResolutionVerified { get; set; }

    /// <summary>User or system authority that verified the shortage resolution.</summary>
    public string? VerifiedBy { get; set; }

    /// <summary>Clinical notes or physical count rationale supplied upon resolution verification.</summary>
    public string? VerificationNotes { get; set; }

    /// <summary>Method of verification: AUTO_SCAN, STOCK_AUDIT, TRANSFER_RECEIPT, or PROCUREMENT_RECEIPT.</summary>
    public string? VerificationMethod { get; set; }

    /// <summary>Audit trail of status transitions for this alert.</summary>
    public ICollection<ShortageStatusHistory> StatusHistory { get; set; } = new List<ShortageStatusHistory>();
}

/// <summary>
/// Risk levels produced by the blueprint rule: daysRemaining &lt; leadTimeDays =&gt; SHORTAGE RISK.
///
/// Not specified in the final blueprint: a finer-grained risk scale (for example LOW or
/// CRITICAL). Do not assume or introduce a new decision without team-level confirmation.
/// </summary>
public static class ShortageRiskLevels
{
    public const string High = "HIGH";
    public const string Medium = "MEDIUM";
}

/// <summary>
/// Shortage alert lifecycle.
///
/// OPEN                   - raised, nobody has looked at it yet.
/// ACKNOWLEDGED           - a user/manager has confirmed the shortage.
/// DEMAND_RAISED          - a demand transfer request was created for this shortage.
/// REDISTRIBUTION_REQUESTED- forwarded to redistribution candidate search.
/// RESOLVED               - the shortage no longer applies; stock arrived or was transferred.
/// DISMISSED              - dismissed as false positive by facility staff or management.
/// </summary>
public static class ShortageAlertStatuses
{
    public const string Open = "OPEN";
    public const string Acknowledged = "ACKNOWLEDGED";
    public const string DemandRaised = "DEMAND_RAISED";
    public const string RedistributionRequested = "REDISTRIBUTION_REQUESTED";
    public const string Resolved = "RESOLVED";
    public const string Dismissed = "DISMISSED";

    public static readonly string[] All = [Open, Acknowledged, DemandRaised, RedistributionRequested, Resolved, Dismissed];

    /// <summary>
    /// Statuses that still need attention. Only one alert in these statuses is kept per
    /// facility and medicine; raising it again refreshes the existing one.
    /// </summary>
    public static readonly string[] Active = [Open, Acknowledged];

    /// <summary>Reason recorded when re-evaluation finds the shortage has cleared.</summary>
    public const string StockCoversLeadTimeReason = "Stock now covers lead time";

    public static bool IsSupported(string? status) =>
        status is not null && All.Contains(status, StringComparer.OrdinalIgnoreCase);
}
