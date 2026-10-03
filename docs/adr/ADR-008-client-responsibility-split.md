# ADR-008: Client Responsibility Split (React Management vs Flutter Field App)

## Status
Accepted

## Context
MediStock serves two distinct user personas with fundamentally different operational environments:
1. **Facility Managers and Central Supply Directors:** Operating from desktop browser environments, requiring macro visibility, route comparisons, surplus analytics, multi-criteria decision making, and formal approval authority.
2. **Field Officers, Dispatch Drivers, and Pharmacy Inventory Clerks:** Operating on-site in hospital stockrooms or in transit on mobile devices, requiring rapid scanning, barcode verification, dispatch confirmations, GPS tracking, and delivery receipts.

## Decision
We enforce a strict separation of client responsibilities across two frontend platforms:

### 1. React Web Application (`web/src/features/redistribution/`)
- **Target Persona:** Supply Chain Managers, Regional Coordinators.
- **Key Modules:**
  - `TransferDashboard`: Overview of all active shortages, pending approvals, and transfer statuses.
  - `TransferDetail`: Comprehensive audit timeline and line item tracking.
  - `CandidateFacilities`: Interactive candidate source comparison with surplus breakdown.
  - `RouteComparison`: Map visualization comparing shortest path vs fastest route.
  - `TransferHistory`: Complete historical ledger and audit trail.
- **Authority:** Approves and rejects proposed transfer plans via `/api/workflow/runs/{id}/approve` and `/api/workflow/runs/{id}/reject`.

### 2. Flutter Mobile Application (`mobile/lib/features/redistribution/`)
- **Target Persona:** Field Officers (Logistics Drivers & Couriers).
- **Key Modules:**
  - `TransferListScreen`: Operational transfer list with real-time status chips and operational status filtering (`Approved`, `Reserved`, `InTransit`, `Delivered`).
  - `TransferDetailsScreen`: Operational hub with item lists, Confirm Pickup, Confirm Delivery, and route metrics.
  - `TransferTrackingScreen`: Live transit timeline with route waypoints and real-time GPS tracking.
  - `ReceiveTransferScreen`: Delivery verification, batch receipt confirmation, and discrepancy logging.
- **Authority:** Picks up consignment from depot (`Confirm Pickup`), shares live GPS location during transit, and marks delivery receipts via `/api/transfers/{id}/receive`. Shortage declaration enters upstream from external vertical.

## Consequences
- **Positive:** UI/UX is deeply tailored to each user's context of use.
- **Positive:** Shared backend REST contracts ensure both clients view identical authoritative state.
- **Positive:** Clear security boundaries: mobile users do not access managerial approval endpoints.
