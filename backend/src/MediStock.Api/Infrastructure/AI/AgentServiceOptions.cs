namespace MediStock.Api.Infrastructure.AI;

/// <summary>
/// Configuration for the internal agent service.
///
/// OWNERSHIP NOTE: the blueprint's section 30 ownership table does not assign
/// <c>Infrastructure/AI/</c> to any member. Section 47 lists these files in the repository
/// structure, but no owner is named.
///
///   Not specified in the final blueprint. Do not assume or introduce a new decision
///   without team-level confirmation.
///
/// Added by the Demand vertical (Sathurstiga S., IT24103156) only so the Demand &amp;
/// Shortage Agent is reachable from ASP.NET Core. Replace with the owner's
/// implementation on integration.
/// </summary>
public class AgentServiceOptions
{
    public const string SectionName = "AgentService";

    /// <summary>Base URL of the internal agent service. Never exposed to clients.</summary>
    public string BaseUrl { get; init; } = "http://localhost:8000";

    /// <summary>
    /// Shared secret sent as X-Internal-Token. Supplied by environment, never committed.
    /// </summary>
    public string ServiceToken { get; init; } = string.Empty;

    /// <summary>Request timeout. The agent calls tools of its own, so this is generous.</summary>
    public int TimeoutSeconds { get; init; } = 30;
}
