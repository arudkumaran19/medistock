using System;
using System.Collections.Generic;

namespace MediStock.Api.Common;

public class ErrorResponse
{
    public bool Success { get; set; } = false;
    public string Message { get; set; } = "An error occurred";
    public string? ErrorCode { get; set; }
    public List<string> Errors { get; set; } = new();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public ErrorDetail Error { get; set; } = new();

    public ErrorResponse() { }

    public ErrorResponse(string message, string? errorCode = null, IEnumerable<string>? errors = null)
    {
        Message = message;
        ErrorCode = errorCode;
        Error = new ErrorDetail
        {
            Code = errorCode ?? string.Empty,
            Message = message
        };

        if (errors != null)
        {
            Errors.AddRange(errors);
        }
        else
        {
            Errors.Add(message);
        }
    }
}

public sealed class ErrorDetail
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string TraceId { get; set; } = string.Empty;
}
