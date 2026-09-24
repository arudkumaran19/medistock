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
