/**
 * Procurement feature — unified barrel export.
 *
 * All procurement domain logic, API clients, context, agent panel, and
 * page-level route components live in this directory, following the same
 * vertical-slice convention as features/demand/ and features/redistribution/.
 *
 * Directory contents:
 *   ProcurementAgentContext.tsx  — React context + useProcurementAgent hook
 *   ProcurementAgentPanel.tsx    — AI agent side-panel component
 *   ApprovalConsole.tsx          — Manager approval queue page
 *   ProcurementPriority.tsx      — AI-ranked procurement priority page
 *   PurchaseOrders.tsx           — Purchase order CRUD page
 *   SupplierDashboard.tsx        — Supplier listing page
 *   SupplierDetail.tsx           — Single-supplier detail page
 *   WorkflowMonitor.tsx          — Delivery/order workflow tracker page
 *   ProcurementPages.module.css  — Shared CSS module for above pages
 *
 * Consumers import from this barrel:
 *   import { procurementApi, useProcurementAgent } from '@/features/procurement';
 */

// ── API client & types (services layer) ──────────────────────────────────────
export { procurementApi } from '../../services/procurementApi';
export type {
  SupplierItem,
  SupplierRequest,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderRequest,
  PolicyRule,
  ValidateProcurementRequest,
  ValidateProcurementResponse,
  DeliveryItem,
  Delivery,
} from '../../services/procurementApi';

// ── Agent API & types ─────────────────────────────────────────────────────────
export { procurementAgentApi } from '../../services/procurementAgentApi';
export type {
  ProcurementActionType,
  ProcurementAgentRequest,
  ProcurementAgentResponse,
  ProcurementInsight,
  CoordinatorTaskRequest,
  CoordinatorTaskResponse,
} from '../../services/procurementAgentApi';

// ── Agent context & hook (co-located) ────────────────────────────────────────
export {
  ProcurementAgentProvider,
  useProcurementAgent,
} from './ProcurementAgentContext';
export type { AgentPhase, AgentStage } from './ProcurementAgentContext';

// ── Page-level route components ───────────────────────────────────────────────
export { SupplierDashboard } from './SupplierDashboard';
export { SupplierDetail } from './SupplierDetail';
export { PurchaseOrders } from './PurchaseOrders';
export { ProcurementPriority } from './ProcurementPriority';
export { ApprovalConsole } from './ApprovalConsole';
export { WorkflowMonitor } from './WorkflowMonitor';

// ── Shared UI component ───────────────────────────────────────────────────────
export { ProcurementAgentPanel } from './ProcurementAgentPanel';
