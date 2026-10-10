namespace MediStock.Api.Domain.Enums;

public enum TransferPriority
{
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,

    // Clinical priority aliases matching web and mobile clients
    Routine = 1,
    Urgent = 2,
    Emergency = 3
}
