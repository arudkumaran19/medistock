# Member 1: Medicine and Facility Inventory

## Architecture

The slice uses the shared ASP.NET Core API and one PostgreSQL database. EF Core/Npgsql owns persistence. The React and Flutter clients call the API; the Inventory Intelligence Agent calls the API through a controlled HTTP adapter. The agent never connects to PostgreSQL.

## APIs

- `GET /api/inventory` and `GET /api/inventory/{id}` retrieve facility balances.
- `POST /api/inventory/receive`, `/adjust`, and `/reserve` mutate stock through deterministic backend services.
- `GET /api/inventory/expiring?days=90` returns batches with stock inside the expiry window.
- `GET /api/medicines` and `GET /api/medicines/{id}` retrieve medicine master data.
- `POST /api/medicine-batches` creates a batch; `GET /api/medicine-batches/{id}` retrieves it.

Responses use `{ "data": ... }`; business failures return a stable `code` and message without raw exceptions.

## Database

`Medicine` stores master data and the minimum stock level. `Facility` scopes stock. `MedicineBatch` belongs to a medicine and facility and is uniquely identified by `(MedicineId, FacilityId, BatchNumber)`. `InventoryBalance` is uniquely identified by `(MedicineId, FacilityId)`. `StockTransaction` records receipts, adjustments, and reservations with UTC timestamps and resulting balance.

## Business Rules

- Receipt quantities must be positive and update both the batch and balance.
- A batch's expiry and manufacturing dates are immutable after creation.
- Available stock is on-hand minus reserved and cannot become negative.
- Reservations cannot exceed available stock.
- Adjustments require a reason and cannot reduce stock below reservations.
- Expiry queries only return batches with remaining stock.
- Minimum stock is exposed as `isBelowMinimum`; the backend remains authoritative.

## React Flow

`InventoryPage` loads real balances. `InventoryDetailPage` shows a balance. `ReceiveStockPage` posts a receipt. `ExpiryPage` lists the 90-day risk window and links to `BatchDetailPage`. The API base URL is configured with `VITE_API_URL` and defaults to local API port 5000.

## Flutter Flow and DataMatrix Demo

`StockLookupScreen` loads balances and links to receive, scan, and adjustment workflows. `ReceiveStockScreen` posts real receipts. `ScanBatchScreen` is the DataMatrix entry point and provides manual batch-number input when scanner hardware is unavailable. The batch value is sent to `BatchDetailScreen`, which retrieves matching stock through the API. `StockAdjustmentScreen` posts the mutation and displays the backend minimum-stock result.

## Inventory Intelligence Agent

The agent workflow is: plan/delegate, run Inventory specialist analysis, apply deterministic validation, request approval for mutations, and execute only through controlled backend endpoints. It supports low-stock and expiring-stock insights and can prepare receipt, adjustment, or reservation actions. The `approved` flag is required before a mutation is forwarded.

## Tests and Demo

The backend tests cover receipt persistence/audit, negative inventory prevention, adjustment validation, reservation limits, expiry, minimum stock, and composite batch identity. Agent tests cover deterministic validation, insight generation, and approval gating. The individual demo is: receive a batch, scan or enter its batch number, retrieve stock, adjust stock, and observe minimum-stock validation.