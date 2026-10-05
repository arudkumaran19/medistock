namespace MediStock.Api.Domain.Enums;

public enum PurchaseOrderStatus
{
    Draft,
    PendingApproval,
    Approved,
    Rejected,
    RevisionRequired,
    Received
}