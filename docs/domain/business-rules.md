## Medicine and Facility Inventory

### Medicine catalog

- Medicine codes are trimmed and must match `letters-or-digits-###` (for example,
  `PARA-500`). Codes must be unique.
- Names are required and limited to 200 characters. Units are required, must contain
  at least one letter, and are limited to 30 characters.
- Minimum stock levels must be non-negative whole numbers.
- Archived medicines remain in the catalog, but cannot be edited or receive stock.
  A medicine can be archived only when it has no on-hand or reserved balance and no
  batch with remaining stock. Archiving requires a reason.

### Batches and receipts

- A batch is identified by its medicine, facility, and batch number. Batch numbers
  must match `BATCH-###` (for example, `BATCH-001`).
- Received quantities must be positive. Manufacturing and expiry dates are stored in
  UTC, and expiry must be later than manufacture.
- Receiving an existing batch adds quantity only when its manufacturing and expiry
  dates match the recorded batch. A date mismatch is rejected; batch dates are not
  revised by a receipt.
- Receipt and direct batch creation both update the batch quantity and facility
  balance and append a stock transaction.

### Balances and stock movements

- A balance is scoped to one medicine and facility. Available quantity is
  `quantityOnHand - quantityReserved`.
- Reservations must have a positive quantity and a reason, and cannot exceed
  available stock. Reservations do not reduce on-hand quantity.
- Adjustments require a reason and cannot reduce on-hand quantity below reserved
  quantity. A negative adjustment is taken from batches with remaining stock in
  earliest-expiry-first order.
- Receipts, adjustments, reservations, and batch retirement append stock transaction
  records with the resulting balance. Adjustments and retirement retain their
  supplied reason.
- `isBelowMinimum` compares on-hand quantity with the medicine's minimum stock level;
  equality is not below minimum.

### Expiry and retirement

- The expiring-stock query accepts a non-negative day window. It includes active
  medicine and facility batches with positive remaining quantity whose expiry is at
  or before the current UTC time plus that window; it sorts results by expiry date.
- Batch retirement requires a reason, removes its remaining quantity from both the
  batch and facility balance, and records the removal as an adjustment transaction.
  It is rejected if the removal would leave the balance below its reserved quantity.
  The batch and its transaction history are retained.
