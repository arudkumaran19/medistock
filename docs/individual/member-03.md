# Member 3 Individual Documentation: Redistribution Management Slice

- **Student Name:** ILHAM MM
- **Student ID:** IT24103530
- **Feature Area:** Medicine Redistribution & Autonomous Workflow Planning
- **Branch:** `feature/ilham-redistribution`

---

## 1. Executive Summary & Responsibility Scope

MediStock Redistribution serves central directors and hospital field staff in balancing medicine supply across provincial hospital networks. The redistribution slice delivers an end-to-end architecture adhering to the project blueprints and architectural decisions:

1. **Backend Core & REST Endpoints (ASP.NET Core 8 Web API):** 8 authoritative transfer endpoints and managerial workflow endpoints with PostgreSQL persistence, EF Core audit logs, and OpenRouteService GIS routing with deterministic Haversine fallback.
2. **Autonomous Agentic AI Service (Python 3.11 + LangGraph + FastAPI):** Internal AI orchestration agent executing a 5-tool sequence to evaluate shortages, rank candidate facilities, compute routing logistics, and formulate validated transfer plans.
3. **Management Web Application (React 18 + TypeScript + Vite):** Desktop portal for Supply Chain Directors and Regional Coordinators to analyze shortages, inspect candidate source surplus, compare transit routes, and formally approve/reject transfer plans ([ADR-008](file:///d:/Desktop/medistock/docs/adr/ADR-008-client-responsibility-split.md)).
4. **Field Mobile Application (Flutter 3.41 + Dart 3.11):** Mobile application for Pharmacy Technicians and Storekeepers to declare field shortages, inspect operational line items, track transit corridors, and verify delivery receipts with discrepancy logging ([ADR-008](file:///d:/Desktop/medistock/docs/adr/ADR-008-client-responsibility-split.md)).

---

## 2. Implementation Breakdown by Step

### Step 1 & Step 2: Backend Architecture & Authoritative Endpoints
- **Domain Models & Entities:** `TransferRequest`, `TransferItem`, `TransferStatusHistory`, `Facility`, `MedicineInventory`, `WorkflowRun`, `WorkflowPlanStep`, `AgentExecution`, `Approval`.
- **Validation Pipeline:** Strict FluentValidation rules for transfer declarations, quantities, status transitions, and managerial notes.
- **Routing Engine:** `RoutingService` integrating OpenRouteService with resilient fallback to deterministic Haversine calculation when offline or rate-limited.
- **REST Endpoints (`TransferController` - exactly 8 endpoints):**
  - `GET /api/transfers` - Paginated transfer list with search and filtering
  - `GET /api/transfers/{id}` - Detailed transfer by ID
  - `POST /api/transfers` - Create draft transfer request
  - `POST /api/transfers/{id}/request` - Submit transfer for approval
  - `POST /api/transfers/{id}/reserve` - Lock stock at source facility
  - `POST /api/transfers/{id}/receive` - Verify delivery receipt with discrepancy logging
  - `GET /api/transfers/{id}/candidates` - Ranked candidate facilities
  - `GET /api/transfers/{id}/route` - Road distance, duration, and geometry
- **Workflow Endpoints (`WorkflowController`):**
  - `POST /api/workflow/runs` - Initiate autonomous redistribution workflow
  - `GET /api/workflow/runs/{id}` - Workflow run status, step execution, and agent traces
  - `POST /api/workflow/runs/{id}/approve` - Managerial human approval
  - `POST /api/workflow/runs/{id}/reject` - Managerial human rejection
  - `GET /api/workflow/runs/{id}/audit` - Authoritative audit trail

### Step 3: Agentic AI Service (Python + LangGraph)
- **Framework:** Python 3.11, FastAPI, LangGraph state machine, Pydantic v2.
- **Required 5 Tools:**
  1. `getCandidateFacilities` - Filters facilities with surplus stock above safety threshold
  2. `getFacilityInventory` - Retrieves batch-level stock on hand and expiry dates
  3. `getFacilityLocation` - Retrieves geographical coordinates
  4. `calculateDistance` - Computes road transit distance and duration
  5. `calculateTransferQuantity` - Calculates optimal allocation without inducing recipient deficits
- **Security Boundary:** Bound to internal Docker network, reachable exclusively via `AgentGateway` in ASP.NET Core backend.

### Step 4: React Management / Approval Application
- **Path:** `web/src/features/redistribution/`
- **Modules Built:**
  - `TransferDashboard` - Real-time KPI summary, status filter tabs, search filter, and transfer table.
  - `TransferDetail` - 6-stage lifecycle progression pipeline, medicine specs, hospital facilities, status audit log, and managerial Approve/Reject actions via `workflowApi`.
  - `CandidateFacilities` - Multi-criteria ranked candidate source facilities with surplus stock analysis, distance, and quick-allocate.
  - `RouteComparison` - Fastest highway vs shortest distance route comparisons with transit time metrics.
  - `TransferHistory` - Historical ledger with aggregate KPIs, CSV export, and filtering.

### Step 5: Flutter Field / Operational Mobile Application
- **Path:** `mobile/lib/features/redistribution/`
- **Modules Built:**
  - `TransferListScreen` - Operational list with real-time status chips and operational status filtering (`Approved`, `Reserved`, `InTransit`, `Delivered`).
  - `TransferDetailsScreen` - Operational line items breakdown, batch lot details, lifecycle tracking, Confirm Pickup, and Confirm Delivery actions.
  - `TransferTrackingScreen` - Road transit duration, distance in km, waypoint milestones, and real-time GPS streaming.
  - `ReceiveTransferScreen` - Physical receipt verification, batch barcode validation, and automated discrepancy logging.

---

## 3. Test & Verification Summary

| Component | Framework / Runner | Tests Executed | Result |
| :--- | :--- | :---: | :---: |
| **Backend Core** | xUnit / .NET 8 | 30 | **30 Passed (0 Failed)** |
| **Agent Service** | Pytest / Python 3.11 | 16 | **16 Passed (0 Failed)** |
| **React Web App** | Vitest / Testing Library | 3 | **3 Passed (0 Failed)** |
| **Web Typecheck & Bundle** | TypeScript (`tsc`) & Vite | Build Verification | **0 Errors, Built Cleanly** |
| **Flutter Mobile App** | Flutter Test / Widget Suite | 6 | **6 Passed (0 Failed)** |
| **Flutter Static Analysis** | `flutter analyze` | Linter / Compiler | **0 Issues Found** |

---

## 4. Architectural Decision Compliance

- **ADR-004 (Agent Framework):** Agent service executes via LangGraph state graph and communicates solely through internal API gateway.
- **ADR-008 (Client Responsibility Split):**
  - React application retains exclusive authority over managerial approval/rejection endpoints (`/api/workflow/runs/{id}/approve`, `/api/workflow/runs/{id}/reject`).
  - Flutter mobile app is tailored for pharmacy technicians and drivers, retaining authority over shortage declarations and delivery receipts (`/api/transfers/{id}/receive`).
