using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace MediStock.Api.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var requestId = Guid.NewGuid().ToString("N");
        context.Response.Headers["X-Request-ID"] = requestId;

        var method = context.Request.Method;
        var path = context.Request.Path;
        var queryString = context.Request.QueryString.ToString();

        _logger.LogInformation("[HTTP IN] [{RequestId}] {Method} {Path}{QueryString}", 
            requestId, method, path, queryString);

        try
        {
            await _next(context);
            stopwatch.Stop();

            _logger.LogInformation("[HTTP OUT] [{RequestId}] {StatusCode} in {ElapsedMs}ms",
                requestId, context.Response.StatusCode, stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "[HTTP ERROR] [{RequestId}] Unhandled exception processing {Method} {Path} in {ElapsedMs}ms",
                requestId, method, path, stopwatch.ElapsedMilliseconds);
            throw;
        }
    }
}
