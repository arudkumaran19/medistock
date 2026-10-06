namespace MediStock.Api.Domain.Enums;

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
    Assigned = 9,
    PendingReassignment = 10,

    // Status aliases for clients using InTransit and Delivered
    InTransit = 5,
    Delivered = 6
}
