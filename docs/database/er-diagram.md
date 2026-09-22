# MediStock Entity Relationship Diagram

## Database

MediStock uses one PostgreSQL database.

## Conceptual Entity Relationships

```text
User
  -> Role
  -> Facility

Facility
  -> Inventory
  -> ConsumptionRecord
  -> ShortageAlert
  -> TransferRequest
  -> PurchaseOrder

Medicine
  -> MedicineBatch

MedicineBatch
  -> StockTransaction

Supplier
  -> PurchaseOrder
       -> PurchaseOrderItem
            -> Delivery

TransferRequest
  -> TransferItem

WorkflowRun
  -> WorkflowPlanStep
  -> AgentExecution
  -> ToolExecution
  -> ValidationResult
  -> Approval