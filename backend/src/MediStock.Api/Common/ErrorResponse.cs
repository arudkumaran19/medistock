namespace MediStock.Api.Common;

/// <summary>
/// SHARED CONTRACT - primary owner: Arudkumaran V. (IT24103011).
/// Placeholder created by the Demand vertical only so this slice returns the agreed
/// error contract. Replace with the owner's implementation on integration.
/// </summary>
public class ErrorResponse
{
    public bool Success => false;

    public ErrorBody Error { get; init; } = new();

    public static ErrorResponse Create(string code, string message, string traceId) =>
        new() { Error = new ErrorBody { Code = code, Message = message, TraceId = traceId } };
}

/// <summary>
/// SHARED CONTRACT - primary owner: Arudkumaran V. (IT24103011).
/// </summary>
public class ErrorBody
{
    public string Code { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;

    public string TraceId { get; init; } = string.Empty;
}
