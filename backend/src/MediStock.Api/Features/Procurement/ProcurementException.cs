namespace MediStock.Api.Features.Procurement;

public sealed class ProcurementException(
    string code,
    string message) : Exception(message)
{
    public string Code { get; } = code;
}