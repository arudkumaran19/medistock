using System.Net;
using System.Text.Json;
using MediStock.Api.Common;

namespace MediStock.Api.Middleware;

public sealed class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred during request execution: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        context.Response.ContentType = "application/json";
        var statusCode = ex switch
        {
            ArgumentException or InvalidOperationException => (int)HttpStatusCode.BadRequest,
            KeyNotFoundException => (int)HttpStatusCode.NotFound,
            UnauthorizedAccessException => (int)HttpStatusCode.Forbidden,
            _ => (int)HttpStatusCode.InternalServerError
        };

        context.Response.StatusCode = statusCode;

        var traceId = context.TraceIdentifier;
        var response = new ErrorResponse
        {
            Error = new ErrorDetail
            {
                Code = ex switch
                {
                    KeyNotFoundException => "RESOURCE_NOT_FOUND",
                    ArgumentException => "INVALID_ARGUMENT",
                    InvalidOperationException => "INVALID_OPERATION",
                    _ => "INTERNAL_SERVER_ERROR"
                },
                Message = ex.Message,
                TraceId = traceId
            }
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
