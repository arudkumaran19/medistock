# MediStock Controller Architecture & Routing Reference

**Last Updated:** 2026-10-14  
**Architecture Convention:** **Feature-Based Controllers** (`backend/src/MediStock.Api/Features/<FeatureName>/...`) are the standard architectural pattern for all new and modernized modules.

---

## 1. Active Controllers Directory

The table below catalogs every active controller in `MediStock.Api`, its base route, core responsibility, owning feature module, and operational status:

| Controller | Base Route | Purpose | Location / Owner | Status |
|---|---|---|---|---|
| **TransferController** | `/api/transfers` | Transfer requisition lifecycle (Draft $\rightarrow$ Requested $\rightarrow$ Proposed $\rightarrow$ Assigned $\rightarrow$ Reserved $\rightarrow$ Dispatched $\rightarrow$ Received), candidate selection, GPS tracking, and officer task management | `Features/Redistribution` | **Active (Primary)** |
| **NotificationController** | `/api/notifications` | Redistribution alert and status change notifications (SignalR & persistent notifications) | `Features/Redistribution` | **Active (Primary)** |
| **WorkflowController** | `/api/workflow/runs` | Human-in-the-loop workflow execution, multi-agent redistribution planning runs, approval/rejection decisions, and audit logging | `Features/Workflow` | **Active (Primary)** |
| **InventoryController** | `/api/inventory` | Inventory balances, stock on hand, safety stock levels, and facility batch tracking | `Controllers/` | Active (Legacy Domain) |
| **AuthController** | `/api/auth` | User login, JWT token issuance, role-based claims generation | `Controllers/` | Active |
| **DevAuthController** | `/api/dev` | Development login bypass and instant test token generator | `Controllers/` | Active (Dev Only) |
| **DemandController** | `/api` | Demand forecasting, consumption logs, and shortage evaluation endpoints | `Controllers/` | Active |
| **ShortageController** | `/api/shortages` | Shortage risk alerts, facility shortage tracking, and stockout signals | `Controllers/` | Active |
| **FacilitiesController** | `/api/facilities` | Healthcare facility locations, facility types, GPS geocoding coordinates | `Controllers/` | Active |
| **MedicinesController** | `/api/medicines` | Medicine catalog, drug classifications, dosage forms, base units | `Controllers/` | Active |
| **MedicineBatchesController** | `/api/medicine-batches` | Medicine batch numbers, manufacturing dates, and expiration dates | `Controllers/` | Active |
| **ReplenishmentRequestController** | `/api/procurement/replenishment-requests` | Procurement replenishment requests and PO generation triggers | `Controllers/` | Active |
| **PurchaseOrderController** | `/api/purchase-orders` | Supplier purchase orders, order status, and item fulfillment | `Controllers/` | Active |
| **SupplierController** | `/api/suppliers` | Pharmaceutical supplier directory, contact info, lead times | `Controllers/` | Active |
| **UsersController** | `/api/users` | User management, profile data, facility affiliations, role assignments | `Controllers/` | Active |
| **DeliveryController** | `/api/deliveries` | Legacy delivery task dispatch and delivery tracking | `Controllers/` | Active |
| **ApprovalController** | `/api/approvals` | Legacy approval requests and decision histories | `Controllers/` | Active |
| **ValidationController** | `/api/validation` | Prescription and requisition validation rules | `Controllers/` | Active |
| **InternalToolsController** | `/internal/tools` | Internal agent diagnostic and database inspection tools | `Controllers/` | Active (Internal) |

---

## 2. Minimal API Endpoints (in `Program.cs`)

In addition to controller routes, lightweight operational routes are registered directly on the `WebApplication` pipeline in `Program.cs`:

| Endpoint | Method | Purpose | Response |
|---|---|---|---|
| `/api/health` | `GET` | Container & orchestrator health checks | `{"status":"ok"}` (200 OK) |
| `/health` | `GET` | Docker compose and internal liveness probes | `{"status":"ok"}` (200 OK) |
| `/` | `GET` | Root redirect to Swagger UI documentation | 302 Redirect to `/swagger` |
| `/hubs/transfers` | WebSocket / SSE / LongPolling | SignalR real-time transfer tracking hub | SignalR Connection (`TransferHub`) |

---

## 3. Duplicate & Empty Controller Audit

During the Phase 2 cleanup, the following 0-byte duplicate/placeholder files in `Controllers/` and `Features/` were audited and removed:

1. **`backend/src/MediStock.Api/Controllers/TransferController.cs`**
   - *Status:* **Deleted** (0-byte duplicate).
   - *Active Replacement:* [Features/Redistribution/TransferController.cs](file:///d:/Desktop/medistock/backend/src/MediStock.Api/Features/Redistribution/TransferController.cs).
2. **`backend/src/MediStock.Api/Controllers/WorkflowController.cs`**
   - *Status:* **Deleted** (0-byte duplicate).
   - *Active Replacement:* [Features/Workflow/WorkflowController.cs](file:///d:/Desktop/medistock/backend/src/MediStock.Api/Features/Workflow/WorkflowController.cs).
3. **`backend/src/MediStock.Api/Controllers/HealthController.cs`**
   - *Status:* **Deleted** (0-byte placeholder).
   - *Active Replacement:* Direct Minimal API route `app.MapGet("/api/health", ...)` in [Program.cs](file:///d:/Desktop/medistock/backend/src/MediStock.Api/Program.cs).
4. **`backend/src/MediStock.Api/Features/Auth/Validators/RegisterValidator.cs`**
   - *Status:* **Deleted** (0-byte placeholder).

### Result:
- **Zero route conflicts** exist in the assembly.
- Root `Controllers/` folder no longer contains any ghost or duplicate files.
- The standard for all new endpoints is feature-folder encapsulation under `Features/<FeatureName>/`.
