namespace MediStock.Api.Domain.Enums;

/// <summary>
/// Lifecycle of a redistribution transfer.
/// Supports both naming conventions (Dispatched / InTransit, Received / Delivered) for compatibility.
/// </summary>
public enum TransferStatus
{
    Draft = 0,
    Proposed = 1,
    Requested = 2,
    Approved = 3,
    Reserved = 4,
    Dispatched = 5,
    Received = 6,
    Cancelled = 7,
    Rejected = 8,

    // Status aliases for clients using InTransit and Delivered
    InTransit = 5,
    Delivered = 6
}
