# API Error Contract

## Standard Error Response

All API errors use the following structure:

```json
{
  "success": false,
  "error": {
    "code": "MINIMUM_STOCK_VIOLATION",
    "message": "Transfer would reduce source stock below its minimum level.",
    "traceId": "..."
  }
}
```

## Fields

| Field | Type | Description |
|---|---|---|
| success | boolean | Indicates that the operation failed |
| error.code | string | Machine-readable error code |
| error.message | string | Human-readable error message |
| error.traceId | string | Correlation/trace identifier for the request |

## Rules

- Error responses must use the standard structure.
- Error codes must be machine-readable.
- Messages must explain the failure.
- A trace identifier must be included.

## Inventory endpoint exceptions

Inventory service exceptions handled by `MediStockExceptionHandler` use the standard
`success` / `error` response above, including a trace ID. However, resource-not-found
results returned directly by the inventory controllers do not use that handler. The
following lookups return HTTP 404 with a `{ "code": "...", "message": "..." }` body,
without `success`, `error`, or `traceId` fields:

| Endpoint | Code |
| --- | --- |
| `GET /api/inventory/{id}` | `INVENTORY_NOT_FOUND` |
| `GET /api/medicines/{id}` | `MEDICINE_NOT_FOUND` |
| `GET /api/medicine-batches/{id}` | `BATCH_NOT_FOUND` |
| `GET /api/medicine-batches/lookup?batchNumber=...` | `BATCH_NOT_FOUND` |

Inventory controller model-binding failures are handled separately and return the
standard error shape with code `INVALID_REQUEST`. Clients calling these inventory
routes should account for the direct 404 body as well as the standard error response.
