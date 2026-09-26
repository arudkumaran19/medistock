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

    public ErrorResponse() { }

    public ErrorResponse(string message, string? errorCode = null, IEnumerable<string>? errors = null)
    {
        Message = message;
        ErrorCode = errorCode;
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
