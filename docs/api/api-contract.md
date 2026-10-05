# MediStock API Contract

## API Conventions

- Base route pattern: `/api/{resource}`
- Resource identifiers use GUIDs.
- Dates use ISO 8601 format.
- JSON property names use camelCase.

## Query Conventions

### Pagination

`?page=1&pageSize=20`

### Search

`?search=amoxicillin`

### Sorting

`?sortBy=expiryDate&sortOrder=asc`

### Filtering

`?facilityId=...&status=...`

## Authentication

| Method | Endpoint |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/refresh` |
| POST | `/api/auth/logout` |
| GET | `/api/auth/me` |

## Inventory

| Method | Endpoint |
|---|---|
| GET | `/api/inventory?facilityId={guid}&includeArchived={bool}` |
| GET | `/api/inventory/{id}` |
| POST | `/api/inventory/receive` |
| POST | `/api/inventory/adjust` |
| POST | `/api/inventory/reserve` |
| GET | `/api/inventory/expiring?days={int}` |
| GET | `/api/inventory/transactions?medicineId={guid}&facilityId={guid}` |
| POST | `/api/medicines` |
| GET | `/api/medicines` |
| GET | `/api/medicines/{id}` |
| PUT | `/api/medicines/{id}` |
| POST | `/api/medicines/{id}/archive` |
| GET | `/api/facilities` |
| GET | `/api/medicine-batches?facilityId={guid}` |
| POST | `/api/medicine-batches` |
| GET | `/api/medicine-batches/lookup?batchNumber={batchNumber}` |
| GET | `/api/medicine-batches/{id}` |
| POST | `/api/medicine-batches/{id}/retire` |

### Inventory requests and responses

Successful endpoint responses wrap their result in a `data` property. Collection
endpoints return an array in `data`; individual-resource endpoints return one object.
Request and response JSON uses camelCase.

#### Inventory balances

- `GET /api/inventory` accepts optional `facilityId` and `includeArchived` query
  parameters. `includeArchived` defaults to `false`; inactive facilities are excluded
  either way. Results are ordered by medicine name.
- `GET /api/inventory/{id}` addresses a balance by its GUID.
- Balance results contain `id`, `medicineId`, `medicineName`, `facilityId`,
  `facilityName`, `quantityOnHand`, `quantityReserved`, `availableQuantity`,
  `minimumStockLevel`, `isBelowMinimum`, and `isMedicineActive`.
- A missing balance returns 404 with code `INVENTORY_NOT_FOUND`.

#### Stock mutations

The request fields defined by each endpoint DTO are:

| Endpoint | Request JSON fields | Successful result |
|---|---|---|
| `POST /api/inventory/receive` | `medicineId`, `facilityId`, `batchNumber`, `quantity`, `expiryDateUtc`, `manufacturingDateUtc` | 201 Created with an inventory balance |
| `POST /api/inventory/adjust` | `medicineId`, `facilityId`, `quantityDelta`, `reason` | 200 OK with an inventory balance |
| `POST /api/inventory/reserve` | `medicineId`, `facilityId`, `quantity`, `reason` | 200 OK with an inventory balance |

`quantity` for receipt and reservation must be positive. Batch number must match
`BATCH-###`, and expiry must be later than manufacture. An existing batch can receive
more stock only when its recorded dates match. Reservations cannot exceed available
stock; adjustments require a reason and cannot reduce available stock below zero.
Successful stock movements update the relevant balance and record a stock transaction.

#### Medicines and facilities

- `POST /api/medicines` accepts `code`, `name`, `unit`, and `minimumStockLevel`.
- `PUT /api/medicines/{id}` accepts `name`, `unit`, and `minimumStockLevel`; the code
  is not updated by this request.
- `POST /api/medicines/{id}/archive` accepts `reason`. Archiving is rejected while
  the medicine has on-hand or reserved balance or a batch with remaining stock.
- Medicine results contain `id`, `code`, `name`, `unit`, `minimumStockLevel`, and
  `isActive`. The medicine list is ordered by name and excludes archived medicines
  unless `includeArchived=true` is supplied.
- `GET /api/facilities` returns active facilities ordered by name. Facility results
  contain `id`, `code`, `name`, `address`, and `isActive`.

#### Batches, expiry, and transaction history

- `GET /api/medicine-batches` accepts optional `facilityId` and returns batches with
  positive quantity for active medicines and facilities, ordered by expiry date.
- `POST /api/medicine-batches` accepts the same fields as a stock receipt and returns
  201 Created with a batch result. The medicine/facility/batch number combination
  must not already exist.
- `GET /api/medicine-batches/lookup` requires the `batchNumber` query parameter.
  `GET /api/medicine-batches/{id}` retrieves by batch GUID. Both return 404 with code
  `BATCH_NOT_FOUND` when no matching batch is found.
- Batch lookup filters on `batchNumber` alone. Because batch identity is scoped by
  medicine and facility, the same batch number may exist in more than one scope; this
  endpoint has no medicine or facility parameter to disambiguate such matches.
- Batch results contain `id`, `medicineId`, `medicineName`, `facilityId`,
  `batchNumber`, `quantityOnHand`, `expiryDateUtc`, and `manufacturingDateUtc`.
- `GET /api/inventory/expiring` accepts `days` (default `90`; negative values are
  rejected). It returns active medicine/facility batches with positive quantity and
  expiry at or before the current UTC time plus that number of days, ordered by
  expiry.
- `GET /api/inventory/transactions` requires `medicineId` and `facilityId`, and
  returns up to the 100 most recent transactions for that pair. Each result contains
  `id`, `createdAtUtc`, `type`, `quantity`, `reason`, `balanceAfter`, and nullable
  `batchNumber`.
- `POST /api/medicine-batches/{id}/retire` accepts a `reason` and returns the batch
  result. Retirement sets its remaining quantity to zero, reduces the facility
  balance, and records an adjustment transaction.

## Demand

| Method | Endpoint |
|---|---|
| GET | `/api/consumption` |
| POST | `/api/consumption` |
| GET | `/api/demand/forecasts` |
| POST | `/api/demand/forecast` |
| GET | `/api/shortages` |
| GET | `/api/shortages/{id}` |
| POST | `/api/shortages/recalculate` |

## Redistribution

| Method | Endpoint |
|---|---|
| GET | `/api/transfers` |
| GET | `/api/transfers/{id}` |
| POST | `/api/transfers` |
| POST | `/api/transfers/{id}/request` |
| POST | `/api/transfers/{id}/reserve` |
| POST | `/api/transfers/{id}/receive` |
| GET | `/api/transfers/{id}/candidates` |
| GET | `/api/transfers/{id}/route` |

## Procurement

| Method | Endpoint |
|---|---|
| GET | `/api/suppliers` |
| POST | `/api/suppliers` |
| GET | `/api/suppliers/{id}` |
| PUT | `/api/suppliers/{id}` |
| GET | `/api/purchase-orders` |
| POST | `/api/purchase-orders` |
| GET | `/api/purchase-orders/{id}` |
| POST | `/api/purchase-orders/{id}/approve` |
| POST | `/api/purchase-orders/{id}/receive` |
