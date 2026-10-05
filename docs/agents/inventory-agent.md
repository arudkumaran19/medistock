# Inventory Intelligence Agent

## Responsibility and boundary

The Inventory Intelligence Agent answers inventory questions, reports low-stock and
expiring-stock insights, and can forward supported stock mutations after approval. It
does not access PostgreSQL. Its `InventoryBackend` adapter communicates with the
MediStock API, which remains authoritative for inventory validation and persistence.

## Request and data flow

The agent service exposes `POST /api/inventory-agent/run`. A request contains
`action_type`, an optional `payload` object, and an `approved` flag (default `false`).
Supported action types are `analyze`, `ask`, `receive`, `adjust`, and `reserve`.

`InventoryAgent` uses the adapter to read balances, expiring batches, medicines,
facilities, batches, or stock transaction history as required by the request. The
adapter uses the corresponding MediStock endpoints, including `/api/inventory`,
`/api/inventory/expiring`, `/api/medicine-batches`, and
`/api/inventory/transactions`. It also reads the medicine and facility catalogs to
resolve names or codes in questions.

Analysis produces low-stock insights from `isBelowMinimum` balances and expiry
insights from the backend's expiring-batch results. Ask requests can summarize stock,
answer supported low-stock or expiry questions, look up batch details, and report
transaction history or stock decreases. A recognized natural-language stock-change
request is converted to an adjustment proposal; it is not executed as a read-only
answer.

## Validation and mutation approval

Before forwarding a direct mutation, the agent checks that medicine and facility IDs
are present. For receipt and reservation actions it attempts to convert quantity to
an integer and rejects values that fail conversion or convert to zero or less.
Adjustments require a non-empty reason. For a natural-language adjustment it resolves
the medicine and facility, requires a non-zero quantity, and checks the proposed
change against the current reserved quantity when a balance is available.

These checks are an agent-side first pass, not a replacement for backend validation.
The controlled adapter only forwards `receive`, `adjust`, and `reserve` to their
matching API endpoints. Every mutation requires `approved=true`; without it the
result remains unexecuted and reports `approval_required`. The backend then applies
its own stock rules and records the movement.

## Result

The response contains the plan, insights, validation errors, approval requirement,
execution status, optional backend result, and optional answer. Backend connectivity
errors are returned as validation errors rather than a successful execution result.