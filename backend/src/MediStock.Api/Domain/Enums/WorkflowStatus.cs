namespace MediStock.Api.Domain.Enums;

public enum WorkflowStatus
{
    Pending = 0,
    Running = 1,
    WaitingForApproval = 2,
    Completed = 3,
    Failed = 4,
    Rejected = 5,
    Cancelled = 6
}
