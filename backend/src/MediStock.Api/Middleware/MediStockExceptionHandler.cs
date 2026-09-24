using System.Text.Json;
using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.Services;
using Microsoft.AspNetCore.Diagnostics;

namespace MediStock.Api.Middleware;

public sealed class MediStockExceptionHandler(ILogger<MediStockExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception is InventoryException inventoryException ? inventoryException.Code switch
        {
            "MEDICINE_NOT_FOUND" or "FACILITY_NOT_FOUND" or "INVENTORY_NOT_FOUND" or "BATCH_NOT_FOUND" => StatusCodes.Status404NotFound,
            "BATCH_EXISTS" or "BATCH_CONFLICT" => StatusCodes.Status409Conflict,
            "MEDICINE_HAS_STOCK" or "MEDICINE_INACTIVE" or "BATCH_ALREADY_RETIRED" or "BATCH_BALANCE_INCONSISTENT" => StatusCodes.Status409Conflict,
            "INSUFFICIENT_STOCK" or "NEGATIVE_AVAILABLE_STOCK" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        } : StatusCodes.Status500InternalServerError;
        if (status == StatusCodes.Status500InternalServerError) logger.LogError(exception, "Unhandled inventory request failure.");
        httpContext.Response.StatusCode = status;
        httpContext.Response.ContentType = "application/json";
        var code = exception is InventoryException known ? known.Code : "INTERNAL_ERROR";
        var message = status == StatusCodes.Status500InternalServerError ? "An unexpected error occurred." : exception.Message;
        var response = new ErrorResponse
        {
            Error = new ErrorDetail { Code = code, Message = message, TraceId = httpContext.TraceIdentifier }
        };
        await httpContext.Response.WriteAsync(JsonSerializer.Serialize(response), cancellationToken);
        return true;
    }
}
