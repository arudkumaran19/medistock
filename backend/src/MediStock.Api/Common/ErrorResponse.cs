namespace MediStock.Api.Common;

public sealed class ErrorResponse
{
    public bool Success { get; init; } = false;
    public ErrorDetail Error { get; init; } = new();
}

public sealed class ErrorDetail
{
    public string Code { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string TraceId { get; init; } = string.Empty;
}
