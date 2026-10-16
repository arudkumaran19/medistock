namespace MediStock.Api.Domain.Enums;

/// <summary>
/// Lifecycle of a redistribution transfer. Redistribution vertical (Member 3).
///
/// Follows the state machine in the redistribution feature branch: a destination
/// facility requests stock, a source is proposed, a manager approves, the source
/// reserves it, it is dispatched and finally delivered. Each value has exactly one
/// name - the earlier aliases (InTransit = Dispatched, Delivered = Received) made the
/// numeric values ambiguous, so the status is stored as text.
/// </summary>
public enum TransferStatus
{
    Draft,
    Requested,
    Proposed,
    Approved,
    Reserved,
    InTransit,
    Delivered,
    Rejected,
    Cancelled,
}
