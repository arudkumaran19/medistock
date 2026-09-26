namespace MediStock.Api.Domain.Enums;

public enum WorkflowStatus
{
    Pending = 0,
    Running = 1,
    WaitingForApproval = 2,
    Approved = 3,
    Rejected = 4,
    Completed = 5,
    Failed = 6
}
