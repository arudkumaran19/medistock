# MediStock API Contract

## API Conventions

- Base route pattern: `/api/{resource}`
- Resource identifiers use GUIDs.
- Dates use ISO 8601 format.
- JSON property names use camelCase.
- Standard response envelopes: `ApiResponse<T>`, `PagedResponse<T>`, `ErrorResponse`.

## Query Conventions

The following are examples of query parameters used by endpoints that explicitly
support them; they are not universal parameters available on every resource. Consult
each endpoint's contract below or in its owning feature documentation.

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

### 1. Detailed Redistribution Endpoints

#### 1.1 List Transfers
- **Route:** `GET /api/transfers`
- **Description:** Retrieve paginated list of redistribution transfers with filtering, search, and sorting.
- **Query Parameters:**
  - `page` (int, default: 1)
  - `pageSize` (int, default: 20, max: 100)
  - `search` (string, optional): Search by transfer number, facility name, notes
  - `sortBy` (string, default: "createdAt"): "createdAt", "transferNumber", "status", "priority", "distance"
  - `sortOrder` (string, default: "desc"): "asc" | "desc"
  - `facilityId` (Guid, optional): Filter by source or destination facility
  - `status` (string, optional): Filter by TransferStatus enum
- **Response (200 OK):** `PagedResponse<TransferResponse>`

#### 1.2 Get Transfer by ID
- **Route:** `GET /api/transfers/{id}`
- **Description:** Retrieve comprehensive details of a single transfer including items, status history ledger, and routing metrics.
- **Response (200 OK):** `ApiResponse<TransferResponse>`
- **Response (404 Not Found):** `ErrorResponse`

#### 1.3 Create Draft Transfer Request
- **Route:** `POST /api/transfers`
- **Description:** Initialize a new redistribution transfer in `Draft` status.
- **Request Body:**
  ```json
  {
    "destinationFacilityId": "a0000000-0000-0000-0000-000000000002",
    "sourceFacilityId": "a0000000-0000-0000-0000-000000000001",
    "priority": "High",
    "notes": "Emergency shortage of Amoxicillin",
    "items": [
      {
        "medicineId": "b0000000-0000-0000-0000-000000000001",
        "medicineName": "Amoxicillin 500mg",
        "requestedQuantity": 400,
        "unitOfMeasure": "capsules"
      }
    ]
  }
  ```
- **Response (201 Created):** `ApiResponse<TransferResponse>`
- **Response (400 Bad Request):** `ErrorResponse`

#### 1.4 Submit Transfer Request
- **Route:** `POST /api/transfers/{id}/request`
- **Description:** Formally submit draft transfer for review and approval (`Draft`/`Proposed` → `Requested`).
- **Request Body (optional):**
  ```json
  {
    "notes": "Urgent redistribution requested for clinical ward"
  }
  ```
- **Response (200 OK):** `ApiResponse<TransferResponse>`

#### 1.5 Reserve Inventory at Source
- **Route:** `POST /api/transfers/{id}/reserve`
- **Description:** Lock available surplus inventory at source facility (`Approved` → `Reserved`).
- **Request Body:**
  ```json
  {
    "userId": "22222222-2222-2222-2222-222222222222",
    "notes": "Batch allocated from main depot",
    "itemAllocations": [
      {
        "transferItemId": "f0000000-0000-0000-0000-000000000001",
        "allocatedQuantity": 400,
        "batchNumber": "BAT-AMX-2026A",
        "expiryDate": "2027-12-31T00:00:00Z"
      }
    ]
  }
  ```
- **Response (200 OK):** `ApiResponse<TransferResponse>`

#### 1.6 Receive & Verify Delivery
- **Route:** `POST /api/transfers/{id}/receive`
- **Description:** Acknowledge arrival at destination facility, update inventories, and record discrepancies (`Dispatched` → `Received`).
- **Request Body:**
  ```json
  {
    "receivedByUserId": "22222222-2222-2222-2222-222222222222",
    "notes": "Received in good order",
    "verifiedItems": [
      {
        "transferItemId": "f0000000-0000-0000-0000-000000000001",
        "receivedQuantity": 400,
        "batchNumber": "BAT-AMX-2026A"
      }
    ]
  }
  ```
- **Response (200 OK):** `ApiResponse<TransferResponse>`

#### 1.7 Find Candidate Facilities
- **Route:** `GET /api/transfers/{id}/candidates`
- **Description:** Query facilities with positive surplus (`StockOnHand - SafetyThreshold - ReservedStock > 0`), ranked by surplus coverage and proximity.
- **Response (200 OK):** `ApiResponse<List<CandidateFacilityResponse>>`

#### 1.8 Calculate Route
- **Route:** `GET /api/transfers/{id}/route`
- **Description:** Call OpenRouteService (or deterministic Haversine fallback) to compute road distance, duration, and waypoints.
- **Response (200 OK):** `ApiResponse<RouteResponse>`

---

## Workflow & Approval Endpoints

### 2.1 Start Planning Workflow
- **Route:** `POST /api/workflow/runs`
- **Description:** Trigger redistribution planning agent execution.
- **Response (200 OK):** `ApiResponse<WorkflowResponse>`

### 2.2 Get Workflow Run Details
- **Route:** `GET /api/workflow/runs/{id}`
- **Description:** Inspect workflow steps, agent execution logs, and rule validations.
- **Response (200 OK):** `ApiResponse<WorkflowResponse>`

### 2.3 Approve Workflow Proposal
- **Route:** `POST /api/workflow/runs/{id}/approve`
- **Description:** Record human management approval; automatically triggers internal `Requested` → `Approved` transition on linked transfer request.
- **Response (200 OK):** `ApiResponse<WorkflowResponse>`

### 2.4 Reject Workflow Proposal
- **Route:** `POST /api/workflow/runs/{id}/reject`
- **Description:** Record human management rejection; triggers internal `Requested` → `Rejected` transition on linked transfer request.
- **Response (200 OK):** `ApiResponse<WorkflowResponse>`

### 2.5 Workflow Audit Trail
- **Route:** `GET /api/workflow/runs/{id}/audit`
- **Description:** Immutable audit ledger entries.
- **Response (200 OK):** `ApiResponse<List<AuditLog>>`
