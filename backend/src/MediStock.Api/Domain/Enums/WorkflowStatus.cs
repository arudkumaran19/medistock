namespace MediStock.Api.Domain.Enums;

public enum WorkflowStatus
{
    Pending = 0,
    Running = 1,
    WaitingForApproval = 2,
    Approved = 3,
    Completed = 4,
    Rejected = 5,
    Failed = 6,
    Cancelled = 7
}
