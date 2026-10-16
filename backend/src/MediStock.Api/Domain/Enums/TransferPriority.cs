namespace MediStock.Api.Domain.Enums;

/// <summary>How urgently the destination facility needs the stock. Redistribution vertical.</summary>
public enum TransferPriority
{
    Low,
    Medium,
    High,
    Critical,
}
