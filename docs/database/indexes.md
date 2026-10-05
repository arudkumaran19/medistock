# MediStock Database Indexes

## Scope

MediStock uses one PostgreSQL database.

The architecture blueprint does not prescribe a comprehensive index strategy. The
current EF Core model configures these unique indexes for inventory:

| Entity | Indexed columns | Constraint |
| --- | --- | --- |
| `Medicine` | `Code` | Unique |
| `MedicineBatch` | `MedicineId`, `FacilityId`, `BatchNumber` | Unique |
| `InventoryBalance` | `MedicineId`, `FacilityId` | Unique |

## Database Rules Affecting Data Access

The blueprint specifies the following database rules:

- `availableAfterTransfer >= minimumStock`
- `expiryDate > currentDate`
- `requestedQuantity > 0`
- Transfer authorization must verify permission for the source facility.
- Storage compatibility must be validated.
- Every high-impact transaction creates an audit record.
- Transfer execution must be one database transaction.

## Scope

These are the inventory indexes explicitly configured in
`ApplicationDbContext.OnModelCreating`. This list does not imply that the blueprint
specifies additional indexes or a general indexing strategy for other domains.
