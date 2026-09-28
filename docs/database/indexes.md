# MediStock Database Indexes

## Scope

MediStock uses one PostgreSQL database.

The final architecture blueprint does not specify concrete database indexes, index names, indexed columns, or index strategies.

Therefore, no specific database indexes are defined in this contract.

## Database Rules Affecting Data Access

The blueprint specifies the following database rules:

- `availableAfterTransfer >= minimumStock`
- `expiryDate > currentDate`
- `requestedQuantity > 0`
- Transfer authorization must verify permission for the source facility.
- Storage compatibility must be validated.
- Every high-impact transaction creates an audit record.
- Transfer execution must be one database transaction.

## Index Decision

Concrete PostgreSQL indexes are not specified in the final blueprint.

Any index definitions must be decided and documented by the team before implementation.