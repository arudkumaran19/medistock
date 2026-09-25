using System.Text.Json;
using MediStock.Api.Common;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Procurement;
using Microsoft.AspNetCore.Diagnostics;

namespace MediStock.Api.Middleware;

public sealed class MediStockExceptionHandler(
    ILogger<MediStockExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, code, message) = exception switch
        {
            InventoryException inventoryException =>
                MapInventoryException(inventoryException),

            ProcurementException procurementException =>
                MapProcurementException(procurementException),

            _ =>
                (
                    StatusCodes.Status500InternalServerError,
                    "INTERNAL_ERROR",
                    "An unexpected error occurred."
                )
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(
                exception,
                "Unhandled application request failure.");
        }

        httpContext.Response.StatusCode = status;
        httpContext.Response.ContentType = "application/json";

        var response = new ErrorResponse
        {
            Error = new ErrorDetail
            {
                Code = code,
                Message = message,
                TraceId = httpContext.TraceIdentifier
            }
        };

        await httpContext.Response.WriteAsync(
            JsonSerializer.Serialize(response),
            cancellationToken);

        return true;
    }

    private static (
        int Status,
        string Code,
        string Message) MapInventoryException(
        InventoryException exception)
    {
        var status = exception.Code switch
        {
            "MEDICINE_NOT_FOUND"
                or "FACILITY_NOT_FOUND"
                or "INVENTORY_NOT_FOUND"
                or "BATCH_NOT_FOUND"
                => StatusCodes.Status404NotFound,

            "BATCH_EXISTS"
                or "BATCH_CONFLICT"
                or "MEDICINE_HAS_STOCK"
                or "MEDICINE_INACTIVE"
                or "BATCH_ALREADY_RETIRED"
                or "BATCH_BALANCE_INCONSISTENT"
                => StatusCodes.Status409Conflict,

            "INSUFFICIENT_STOCK"
                or "NEGATIVE_AVAILABLE_STOCK"
                => StatusCodes.Status422UnprocessableEntity,

            _ => StatusCodes.Status400BadRequest
        };

        return (status, exception.Code, exception.Message);
    }

    private static (
        int Status,
        string Code,
        string Message) MapProcurementException(
        ProcurementException exception)
    {
        var status = exception.Code switch
        {
            "SUPPLIER_NOT_FOUND"
                or "FACILITY_NOT_FOUND"
                or "MEDICINE_NOT_FOUND"
                or "PURCHASE_ORDER_NOT_FOUND"
                or "DELIVERY_NOT_FOUND"
                => StatusCodes.Status404NotFound,

            "DELIVERY_ALREADY_EXISTS"
                or "PURCHASE_ORDER_NOT_APPROVED"
                or "INVALID_PURCHASE_ORDER_STATE"
                or "DELIVERY_ALREADY_COMPLETED"
                or "DELIVERY_CANCELLED"
                => StatusCodes.Status409Conflict,

            "SUPPLIER_REQUIRED"
                or "FACILITY_REQUIRED"
                or "ITEMS_REQUIRED"
                or "MEDICINE_REQUIRED"
                or "PURCHASE_ORDER_REQUIRED"
                or "DUPLICATE_MEDICINE"
                or "INVALID_QUANTITY"
                or "INVALID_UNIT_PRICE"
                or "REASON_REQUIRED"
                => StatusCodes.Status400BadRequest,

            "PURCHASE_ORDER_CREATE_FAILED"
                => StatusCodes.Status500InternalServerError,

            _ => StatusCodes.Status400BadRequest
        };

        return (status, exception.Code, exception.Message);
    }
}
