/**
 * Inventory feature — unified barrel export.
 *
 * All inventory domain logic, API clients, agent panel, and page-level route
 * components live in this directory, following the same vertical-slice
 * convention as features/demand/, features/redistribution/, and
 * features/procurement/.
 *
 * Directory contents:
 *   InventoryAgentPanel.tsx      — AI agent side-panel component
 *   InventoryAgentPanel.module.css
 *   InventoryPage.tsx            — Inventory listing + medicine management
 *   InventoryPage.module.css
 *   InventoryDetailPage.tsx      — Single inventory item detail view
 *   BatchDetailPage.tsx          — Individual batch detail view
 *   ReceiveStockPage.tsx         — Receive stock / create batch workflow
 *   ExpiryPage.tsx               — Expiry monitor page
 *   ExpiryPage.module.css
 *
 * API client and types remain in services/inventoryApi.ts and types/inventory.ts
 * (shared across verticals that need inventory data, e.g. redistribution).
 */

// ── Page-level route components ───────────────────────────────────────────────
export { InventoryPage } from './InventoryPage';
export { InventoryDetailPage } from './InventoryDetailPage';
export { BatchDetailPage } from './BatchDetailPage';
export { ReceiveStockPage } from './ReceiveStockPage';
export { ExpiryPage } from './ExpiryPage';

// ── Shared agent UI component ─────────────────────────────────────────────────
export { InventoryAgentPanel } from './InventoryAgentPanel';
