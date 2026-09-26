# MediStock API Contract: Redistribution Management & Workflow

**Version:** 1.0.0  
**Authoritative Backend:** ASP.NET Core Web API (.NET 8)  
**Base URL:** `/api`  
**Data Formats:** JSON (camelCase, ISO 8601 dates, Guid identifiers)  
**Standard Response Envelope:** `ApiResponse<T>`, `PagedResponse<T>`, `ErrorResponse`  

---

## 1. Redistribution Endpoints (Authoritative Blueprint - Strictly 8 Routes)

### 1.1 List Transfers
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

### 1.2 Get Transfer by ID
- **Route:** `GET /api/transfers/{id}`
- **Description:** Retrieve comprehensive details of a single transfer including items, status history ledger, and routing metrics.
- **Response (200 OK):** `ApiResponse<TransferResponse>`
- **Response (404 Not Found):** `ErrorResponse`

### 1.3 Create Draft Transfer Request
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

### 1.4 Submit Transfer Request
- **Route:** `POST /api/transfers/{id}/request`
- **Description:** Formally submit draft transfer for review and approval (`Draft`/`Proposed` → `Requested`).
- **Request Body (optional):**
  ```json
  {
    "notes": "Urgent redistribution requested for clinical ward"
  }
  ```
- **Response (200 OK):** `ApiResponse<TransferResponse>`

### 1.5 Reserve Inventory at Source
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

### 1.6 Receive & Verify Delivery
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

### 1.7 Find Candidate Facilities
- **Route:** `GET /api/transfers/{id}/candidates`
- **Description:** Query facilities with positive surplus (`StockOnHand - SafetyThreshold - ReservedStock > 0`), ranked by surplus coverage and proximity.
- **Response (200 OK):** `ApiResponse<List<CandidateFacilityResponse>>`

### 1.8 Calculate Route
- **Route:** `GET /api/transfers/{id}/route`
- **Description:** Call OpenRouteService (or deterministic Haversine fallback) to compute road distance, duration, and waypoints.
- **Response (200 OK):** `ApiResponse<RouteResponse>`

---

## 2. Workflow & Approval Endpoints

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
