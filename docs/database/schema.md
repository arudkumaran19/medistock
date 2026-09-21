# MediStock Database Schema

## Database

MediStock uses one PostgreSQL database.

## Identity

### Users

Application users.

### Roles

System roles.

### UserRoles

Associates users with roles.

### Facilities

Represents facilities participating in the MediStock system.

## Inventory

### Medicines

Medicine master records.

### MedicineBatches

Batch-level medicine records.

### InventoryBalances

Current inventory balances.

### StockTransactions

Records stock movements.

### StorageRequirements

Defines required storage conditions.

## Demand

### ConsumptionRecords

Records medicine consumption.

### DemandForecasts

Stores demand forecasting results.

### ShortageAlerts

Records detected shortage conditions.

### ReorderRules

Defines replenishment rules.

## Redistribution

### TransferRequests

Represents requests to transfer medicine between facilities.

### TransferItems

Represents medicines included in transfer requests.

### TransferStatusHistory

Records transfer status changes.

## Procurement

### Suppliers

Supplier records.

### PurchaseOrders

Purchase orders created for procurement.

### PurchaseOrderItems

Medicine items included in purchase orders.

### Deliveries

Delivery records associated with procurement.

### SupplierPerformance

Supplier performance information.

## Agentic AI and Workflow

### WorkflowRuns

Stores workflow execution records.

### WorkflowPlanSteps

Stores individual workflow steps.

### AgentExecutions

Stores agent execution records.

### ToolExecutions

Stores tool execution records.

### ValidationResults

Stores validation results.

### Approvals

Stores approval decisions.

### AuditLogs

Stores audit records for auditable system activity.

## Conceptual Relationships

```text
User
 ├── Role
 └── Facility

Facility
 ├── Inventory
 ├── ConsumptionRecord
 ├── ShortageAlert
 ├── TransferRequest
 └── PurchaseOrder

Medicine
 └── MedicineBatch

MedicineBatch
 └── StockTransaction

Supplier
 └── PurchaseOrder
      └── PurchaseOrderItem
           └── Delivery

TransferRequest
 └── TransferItem

WorkflowRun
 ├── WorkflowPlanStep
 ├── AgentExecution
 ├── ToolExecution
 ├── ValidationResult
 └── Approval