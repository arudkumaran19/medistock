# Member 1 Inventory Test Coverage

This page records inventory tests present in the repository; it is not a statement
that every inventory behavior has a test at every layer.

## Backend service tests

`backend/tests/MediStock.Api.Tests/InventoryServiceTests.cs` exercises services with
EF Core's in-memory database. Coverage includes:

- Receipt creation and increments, persisted batch/balance values, and receipt
  transaction history.
- Positive quantity, batch-number and date validation, and rejection of conflicting
  dates for an existing batch.
- Reservation limits and the distinction between on-hand, reserved, and available
  quantities.
- Negative adjustment limits, successful balance updates, audit transactions, and
  earliest-expiry-first deduction across batches.
- Expiry-window results and minimum-stock indicators.
- Medicine/facility/batch identity, direct batch creation, archived-medicine receipt
  rejection, and medicine create/update validation.
- Medicine archiving restrictions and batch retirement effects, including
  transaction-history preservation and reason validation.
- Read-only transaction history contents and ordering.

Run from the repository root:

```bash
dotnet test backend/MediStock.sln --filter FullyQualifiedName~InventoryServiceTests
```

## Agent tests

`agent-service/tests/test_inventory_agent.py` covers agent-side scope and quantity
validation; low-stock and expiry insight generation; unavailable-backend handling;
and approval gating for direct and recognized natural-language mutations. It also
checks read-only batch and transaction-history questions, medicine/facility resolution
for transaction queries, and the inventory-agent HTTP route.

Run from `agent-service`:

```bash
python -m pytest -q tests/test_inventory_agent.py
```

## React tests

- `web/src/pages/InventoryPage.test.tsx` verifies invalid medicine-code feedback and
  that an invalid code prevents the create API call.
- `web/src/pages/ReceiveStockPage.test.tsx` verifies that invalid batch numbers block
  the API call and valid `BATCH-###` values can be submitted.

Run from `web`:

```bash
npm test -- src/pages/InventoryPage.test.tsx src/pages/ReceiveStockPage.test.tsx
```

No inventory-specific Flutter test file is present under `mobile/test`.