# Inventory Integration Flow

## Client requests

The React inventory service sends requests to the ASP.NET API through `apiRequest`;
successful responses are unwrapped from the API's `data` property. Its base URL uses
`VITE_API_URL`, defaulting to `http://localhost:5050`. Flutter's `InventoryService`
uses the shared `ApiClient`, which likewise unwraps `data`; its default API URL is
`http://localhost:5050` (or `http://10.0.2.2:5050` on Android).

Both clients call the shared backend rather than updating inventory locally. Inventory
balance reads and stock movements enter through `InventoryController`. Medicine
catalog and batch operations use `MedicinesController` and
`MedicineBatchesController`; active-facility reads use `FacilitiesController`.

## Backend and persistence

`InventoryController` delegates balance reads and receive, adjust, reserve, and expiry
requests to `InventoryService`. It delegates transaction-history reads to
`StockTransactionService`. `MedicineBatchesController` delegates batch creation,
lookup, retrieval, listing, and retirement to `BatchService`; `MedicinesController`
uses `MedicineService` for medicine creation, updates, and archiving.

The inventory services apply the relevant `InventoryValidator` checks and business
rules before persistence. They use EF Core through `ApplicationDbContext`:

- Receiving creates or increments the medicine/facility/batch record, increments the
  medicine/facility balance, and appends a receipt transaction.
- Adjusting changes the balance and appends an adjustment transaction. A negative
  adjustment also removes quantity from batches in earliest-expiry-first order.
- Reserving changes reserved quantity without reducing on-hand quantity and appends a
  reservation transaction.
- Creating a batch updates both the batch and balance and appends a receipt
  transaction. Retiring a batch reduces its remaining quantity and the balance and
  appends an adjustment transaction.

Stock transactions retain the movement type, quantity, reason, resulting balance, UTC
timestamp, and—when associated with a batch—the batch link. Services save the affected
records through the same `ApplicationDbContext` before returning their response DTO.

## Response path

The backend wraps successful results in `ApiResponse<T>` (`data`). React and Flutter
clients extract that value for their pages and screens. Business validation remains
backend-authoritative; client-side checks provide feedback but do not replace service
validation.

The Inventory Intelligence Agent follows a separate agent-service request path and
uses a controlled HTTP adapter to call this same backend API; it does not connect to
the database directly. Its specific inputs, reads, and approval-gated mutations are
described in [the inventory-agent guide](../agents/inventory-agent.md).