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
| GET | `/api/inventory` |
| GET | `/api/inventory/{id}` |
| POST | `/api/inventory/receive` |
| POST | `/api/inventory/adjust` |
| POST | `/api/inventory/reserve` |
| GET | `/api/inventory/expiring` |
| GET | `/api/medicines` |
| GET | `/api/medicines/{id}` |
| POST | `/api/medicine-batches` |
| GET | `/api/medicine-batches/{id}` |

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
