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
    Rejected = 8
}
