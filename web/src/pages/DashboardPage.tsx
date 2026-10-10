import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { PageHeader, KPICard, QuickAction } from "../components/ui";
import { procurementApi, type PurchaseOrder, type SupplierItem } from "../services/procurementApi";
import { inventoryApi } from "../services/inventoryApi";
import type { Inventory, Batch, Medicine, Facility } from "../types/inventory";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  FileCheck2,
  FileText,
  AlertTriangle,
  TrendingDown,
  Building2,
  Package,
  Calendar,
  Sparkles,
  Activity,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Pill,
  Inbox,
  RotateCw,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Dashboard Metrics Hook (Traced to Real Backend Endpoints)
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardData {
  orders: PurchaseOrder[];
  pendingApprovals: PurchaseOrder[];
  suppliers: SupplierItem[];
  inventory: Inventory[];
  batches: Batch[];
  medicines: Medicine[];
  facilities: Facility[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useDashboardData(): DashboardData {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        ordersRes,
        pendingRes,
        suppliersRes,
        inventoryRes,
        batchesRes,
        medicinesRes,
        facilitiesRes,
      ] = await Promise.all([
        procurementApi.getPurchaseOrders().catch(() => []),
        procurementApi.getPendingApprovals().catch(() => []),
        procurementApi.getSuppliers().catch(() => []),
        inventoryApi.list(true).catch(() => []),
        inventoryApi.batches().catch(() => []),
        inventoryApi.medicines(true).catch(() => []),
        inventoryApi.facilities().catch(() => []),
      ]);

      setOrders(ordersRes);
      setPendingApprovals(pendingRes);
      setSuppliers(suppliersRes);
      setInventory(inventoryRes);
      setBatches(batchesRes);
      setMedicines(medicinesRes);
      setFacilities(facilitiesRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  return {
    orders,
    pendingApprovals,
    suppliers,
    inventory,
    batches,
    medicines,
    facilities,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Visualizations Row
// ─────────────────────────────────────────────────────────────────────────────

interface AnalyticsRowProps {
  orders: PurchaseOrder[];
  batches: Batch[];
  inventory: Inventory[];
  isLoading: boolean;
}

function AnalyticsRow({ orders, batches, inventory, isLoading }: AnalyticsRowProps) {
  const now = useMemo(() => Date.now(), []);

  const poStatusData = useMemo(() => {
    const counts = {
      Approved: orders.filter((o) => o.status === "Approved").length,
      "Pending Review": orders.filter((o) => o.status === "PendingApproval").length,
      Received: orders.filter((o) => o.status === "Received").length,
      "Revision Req.": orders.filter((o) => o.status === "RevisionRequired").length,
      Rejected: orders.filter((o) => o.status === "Rejected").length,
      Draft: orders.filter((o) => o.status === "Draft").length,
    };

    const colors: Record<string, string> = {
      Approved: "#0f766e",
      "Pending Review": "#d97706",
      Received: "#2563eb",
      "Revision Req.": "#f59e0b",
      Rejected: "#dc2626",
      Draft: "#94a3b8",
    };

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: colors[name] }))
      .filter((d) => d.value > 0);
  }, [orders]);

  const expiryRiskData = useMemo(() => {
    let withinWindow = 0;
    let expiringSoon = 0;
    let expired = 0;

    for (const b of batches) {
      const ms = new Date(b.expiryDateUtc).getTime() - now;
      if (ms <= 0) expired++;
      else if (ms <= 30 * 86400000) expiringSoon++;
      else withinWindow++;
    }

    const lowStockCount = inventory.filter((i) => i.isBelowMinimum).length;

    return [
      { category: "Within Range", count: withinWindow, fill: "#10b981" },
      { category: "Expiring (30d)", count: expiringSoon, fill: "#f59e0b" },
      { category: "Expired", count: expired, fill: "#ef4444" },
      { category: "Low Stock Alert", count: lowStockCount, fill: "#8b5cf6" },
    ];
  }, [batches, inventory, now]);

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 32, textAlign: "center", color: "#64748b" }}>
          <div className="spinner mb-2" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: "0.8125rem", margin: 0 }}>Compiling procurement status charts…</p>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 32, textAlign: "center", color: "#64748b" }}>
          <div className="spinner mb-2" style={{ margin: "0 auto" }} />
          <p style={{ fontSize: "0.8125rem", margin: 0 }}>Compiling inventory risk profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 24 }}>
      {/* Chart 1: Procurement Lifecycle Distribution */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "18px 20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>
            Procurement Lifecycle Distribution
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
            Operational balance across {orders.length} total purchase requisitions
          </p>
        </div>

        {poStatusData.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: "0.8125rem" }}>
            No purchase order records available.
          </div>
        ) : (
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height={210} minWidth={100}>
              <PieChart>
                <Pie
                  data={poStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {poStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown) => [`${value} Orders`, "Volume"]}
                  contentStyle={{ borderRadius: 8, fontSize: "12px", border: "1px solid #e2e8f0" }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  formatter={(val) => <span style={{ fontSize: "11px", color: "#475569" }}>{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Chart 2: Expiry & Inventory Risk Profile */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "18px 20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>
            Inventory Expiration & Buffer Risks
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
            Active batch tracking across {batches.length} lots and catalog medicines
          </p>
        </div>

        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height={210} minWidth={100}>
            <BarChart data={expiryRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                formatter={(value: unknown) => [`${value} Items / Batches`, "Count"]}
                contentStyle={{ borderRadius: 8, fontSize: "12px", border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {expiryRiskData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role-Specific Dashboards
// ─────────────────────────────────────────────────────────────────────────────

function FacilityManagerDashboard({ email }: { email: string }) {
  const { orders, pendingApprovals, inventory, batches, isLoading, error, refetch } = useDashboardData();

  const activeOrdersCount = orders.filter(
    (o) => !["Delivered", "Received", "Cancelled", "Rejected"].includes(o.status)
  ).length;

  const policyExceptionsCount = orders.filter(
    (o) => o.status === "RevisionRequired" || o.status === "Rejected"
  ).length;

  const stockAlertsCount = inventory.filter((i) => i.isBelowMinimum).length;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Facility Operations"
        title="Facility Dashboard"
          subtitle={`Signed in as ${email} · Facility Manager`}
          actions={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void refetch()}
              disabled={isLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", height: 36, padding: "0 14px", borderRadius: 8 }}
            >
              <RotateCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Data
            </button>
          }
        />

        {error && (
          <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Operational Overview KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Pending Approvals"
            value={isLoading ? "…" : pendingApprovals.length}
            context="Orders awaiting review"
            icon={<FileCheck2 size={20} />}
            accent="#d97706"
            variant={pendingApprovals.length > 0 ? "warning" : "default"}
          />
          <KPICard
            label="Active Purchase Orders"
            value={isLoading ? "…" : activeOrdersCount}
            context="Orders in progress"
            icon={<FileText size={20} />}
            accent="#0f766e"
          />
          <KPICard
            label="Policy Exceptions"
            value={isLoading ? "…" : policyExceptionsCount}
            context="Flagged for revision/reject"
            icon={<AlertTriangle size={20} />}
            accent="#dc2626"
            variant={policyExceptionsCount > 0 ? "danger" : "default"}
          />
          <KPICard
            label="Stock Balance Alerts"
            value={isLoading ? "…" : stockAlertsCount}
            context="Below minimum threshold"
            icon={<TrendingDown size={20} />}
            accent="#7c3aed"
            variant={stockAlertsCount > 0 ? "warning" : "default"}
          />
        </div>

        {/* Real Analytics Section */}
        <AnalyticsRow orders={orders} batches={batches} inventory={inventory} isLoading={isLoading} />

        {/* Priority Action Queue: Pending Authorizations */}
        {pendingApprovals.length > 0 && (
          <div className="card mb-6" style={{ background: "#ffffff", border: "1px solid #fed7aa", borderRadius: 12, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={18} style={{ color: "#d97706" }} />
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#9a3412" }}>
                    Urgent: Orders Awaiting Managerial Sign-Off ({pendingApprovals.length})
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#b45309" }}>
                    High-value or bulk procurement requisitions held by compliance policy gates
                  </p>
                </div>
              </div>
              <Link
                to="/procurement/approvals"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#9a3412",
                  background: "#ffedd5",
                  border: "1px solid #fed7aa",
                  padding: "5px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Open Approval Console <ArrowRight size={13} />
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingApprovals.slice(0, 3).map((po) => {
                const totalCost = (po.items || []).reduce(
                  (sum, it) => sum + it.requestedQuantity * it.unitPrice,
                  0
                );
                return (
                  <div
                    key={po.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#fffaf5",
                      border: "1px solid #fed7aa",
                      borderRadius: 8,
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#0f172a" }}>PO-{po.id.slice(0, 8)}</strong>
                      <span style={{ color: "#64748b", marginLeft: 10 }}>
                        {po.items?.length ?? 0} item(s) • Submitted {new Date(po.requestedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <strong style={{ color: "#0f766e" }}>
                        ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                      <Link
                        to="/procurement/approvals"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#d97706",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          textDecoration: "none",
                        }}
                      >
                        Review Decision <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions Panel */}
        <div className="card mb-6" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Operational Quick Actions</h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0" }}>Immediate actions for facility management and governance</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <QuickAction
              to="/procurement/approvals"
              label="Review Pending Approvals"
              description="Evaluate and sign off or reject submitted purchase orders"
              icon={<FileCheck2 size={18} />}
              accent="#d97706"
            />
            <QuickAction
              to="/procurement/workflow"
              label="Procurement Workflow Monitor"
              description="Live multi-stage tracking of all facility orders"
              icon={<Activity size={18} />}
              accent="#0f766e"
            />
            <QuickAction
              to="/procurement/orders"
              label="Purchase Orders Console"
              description="Browse, filter, and inspect purchase order records"
              icon={<FileText size={18} />}
              accent="#2563eb"
            />
            <QuickAction
              to="/procurement/priorities"
              label="Replenishment Priorities"
              description="AI-driven procurement recommendation analysis"
              icon={<Sparkles size={18} />}
              accent="#4f46e5"
            />
          </div>
        </div>

        {/* Operational Notice */}
        <div
          style={{
            background: "var(--color-primary-50)",
            border: "1px solid var(--color-primary-200)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            color: "var(--color-primary-900)",
            fontSize: "var(--text-sm)",
          }}
        >
          <ShieldCheck size={18} style={{ color: "var(--color-primary-700)", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Operations Tip:</strong> Use the <strong>Approval Console</strong> to authorize or revise high-value purchase orders. Automated policy evaluations execute inline upon submission.
        </div>
      </div>
    </div>
  );
}

function ProcurementOfficerDashboard({ email }: { email: string }) {
  const { orders, suppliers, inventory, batches, isLoading, error, refetch } = useDashboardData();

  const activeSuppliersCount = suppliers.filter((s) => s.isActive).length;
  const draftOrdersCount = orders.filter((o) => o.status === "Draft").length;
  const pendingCount = orders.filter((o) => o.status === "PendingApproval").length;
  const deliveredCount = orders.filter((o) => ["Delivered", "Received"].includes(o.status)).length;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Supplier & Procurement"
        title="Procurement Dashboard"
          subtitle={`Signed in as ${email} · Supplier Officer`}
          actions={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void refetch()}
              disabled={isLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", height: 36, padding: "0 14px", borderRadius: 8 }}
            >
              <RotateCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Data
            </button>
          }
        />

        {error && (
          <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Active Suppliers"
            value={isLoading ? "…" : activeSuppliersCount}
            context="Approved vendors"
            icon={<Building2 size={20} />}
            accent="#0f766e"
            variant="success"
          />
          <KPICard
            label="Draft Orders"
            value={isLoading ? "…" : draftOrdersCount}
            context="POs awaiting submit"
            icon={<FileText size={20} />}
            accent="#d97706"
          />
          <KPICard
            label="Pending Approval"
            value={isLoading ? "…" : pendingCount}
            context="Submitted to manager"
            icon={<Clock size={20} />}
            accent="#7c3aed"
            variant={pendingCount > 0 ? "warning" : "default"}
          />
          <KPICard
            label="Delivered / Received"
            value={isLoading ? "…" : deliveredCount}
            context="Completed fulfillment"
            icon={<CheckCircle2 size={20} />}
            accent="#16a34a"
            variant="success"
          />
        </div>

        {/* Real Analytics Section */}
        <AnalyticsRow orders={orders} batches={batches} inventory={inventory} isLoading={isLoading} />

        {/* Action Queue: Requisitions Requiring Attention */}
        {orders.filter((o) => ["Draft", "RevisionRequired"].includes(o.status)).length > 0 && (
          <div className="card mb-6" style={{ background: "#ffffff", border: "1px solid #fed7aa", borderRadius: 12, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={18} style={{ color: "#d97706" }} />
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#9a3412" }}>
                    Action Needed: Orders in Draft or Returned for Revision ({orders.filter((o) => ["Draft", "RevisionRequired"].includes(o.status)).length})
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#b45309" }}>
                    Requisitions that require finalizing, policy validation pre-check, or amendment
                  </p>
                </div>
              </div>
              <Link
                to="/procurement/orders"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#9a3412",
                  background: "#ffedd5",
                  border: "1px solid #fed7aa",
                  padding: "5px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Open Orders Console <ArrowRight size={13} />
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {orders.filter((o) => ["Draft", "RevisionRequired"].includes(o.status)).slice(0, 3).map((po) => {
                const totalCost = (po.items || []).reduce(
                  (sum, it) => sum + it.requestedQuantity * it.unitPrice,
                  0
                );
                return (
                  <div
                    key={po.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#fffaf5",
                      border: "1px solid #fed7aa",
                      borderRadius: 8,
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#0f172a" }}>PO-{po.id.slice(0, 8)}</strong>
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: po.status === "RevisionRequired" ? "#fee2e2" : "#f1f5f9",
                          color: po.status === "RevisionRequired" ? "#b91c1c" : "#475569",
                        }}
                      >
                        {po.status}
                      </span>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>
                        {po.items?.length ?? 0} item(s) • Created {new Date(po.requestedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <strong style={{ color: "#0f766e" }}>
                        ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                      <Link
                        to="/procurement/orders"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#0f766e",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          textDecoration: "none",
                        }}
                      >
                        Edit Order <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card mb-6" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Procurement Actions</h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0" }}>Manage suppliers, purchase orders, and replenishment plans</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <QuickAction
              to="/procurement/suppliers"
              label="Supplier Directory"
              description="Browse, verify compliance, and manage supplier agreements"
              icon={<Building2 size={18} />}
              accent="#0f766e"
            />
            <QuickAction
              to="/procurement/orders"
              label="Purchase Orders"
              description="Draft, submit, and inspect lifecycle orders"
              icon={<FileText size={18} />}
              accent="#2563eb"
            />
            <QuickAction
              to="/procurement/priorities"
              label="AI Replenishment Assistant"
              description="Smart replenishment recommendations from the LangGraph agent"
              icon={<Sparkles size={18} />}
              accent="#4f46e5"
            />
            <QuickAction
              to="/procurement/workflow"
              label="Workflow Lifecycle Monitor"
              description="Track orders through approval, dispatch, and delivery"
              icon={<Activity size={18} />}
              accent="#0891b2"
            />
          </div>
        </div>
      </div>
  );
}

function OperationalStaffDashboard({ email }: { email: string }) {
  const { orders, inventory, batches, medicines, isLoading, error, refetch } = useDashboardData();

  const expiringSoonCount = useMemo(() => {
    const now = Date.now();
    return batches.filter((b) => {
      const ms = new Date(b.expiryDateUtc).getTime() - now;
      return ms > 0 && ms <= 30 * 86400000;
    }).length;
  }, [batches]);

  const lowStockCount = inventory.filter((i) => i.isBelowMinimum).length;
  const receivedCount = orders.filter((o) => o.status === "Received").length;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Pharmacy & Storage"
        title="Staff Inventory Dashboard"
          subtitle={`Signed in as ${email} · Operational Staff`}
          actions={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void refetch()}
              disabled={isLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", height: 36, padding: "0 14px", borderRadius: 8 }}
            >
              <RotateCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Data
            </button>
          }
        />

        {error && (
          <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Catalog Medicines"
            value={isLoading ? "…" : medicines.filter((m) => m.isActive).length}
            context="Active formulary items"
            icon={<Pill size={20} />}
            accent="#0f766e"
          />
          <KPICard
            label="Expiring Soon"
            value={isLoading ? "…" : expiringSoonCount}
            context="Next 30 days"
            icon={<Calendar size={20} />}
            accent="#d97706"
            variant={expiringSoonCount > 0 ? "warning" : "default"}
          />
          <KPICard
            label="Low Stock Alert"
            value={isLoading ? "…" : lowStockCount}
            context="Below buffer threshold"
            icon={<TrendingDown size={20} />}
            accent="#dc2626"
            variant={lowStockCount > 0 ? "danger" : "default"}
          />
          <KPICard
            label="Stock Receipts"
            value={isLoading ? "…" : receivedCount}
            context="Received into warehouse"
            icon={<Inbox size={20} />}
            accent="#16a34a"
            variant="success"
          />
        </div>

        {/* Real Analytics Section */}
        <AnalyticsRow orders={orders} batches={batches} inventory={inventory} isLoading={isLoading} />

        {/* Priority Action Queue: Low Stock Alerts */}
        {lowStockCount > 0 && (
          <div className="card mb-6" style={{ background: "#ffffff", border: "1px solid #fecaca", borderRadius: 12, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingDown size={18} style={{ color: "#dc2626" }} />
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#991b1b" }}>
                    Stock Depletion Alert ({lowStockCount} items below safety threshold)
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#b91c1c" }}>
                    Items running below reserve minimums; prepare intake for arriving shipments
                  </p>
                </div>
              </div>
              <Link
                to="/inventory/receive"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "#dc2626",
                  border: "1px solid #b91c1c",
                  padding: "5px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Receive Stock Shipment <ArrowRight size={13} />
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {inventory.filter((i) => i.isBelowMinimum).slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "#fef2f2",
                    border: "1px solid #fee2e2",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                  }}
                >
                  <div>
                    <strong style={{ color: "#0f172a" }}>{item.medicineName}</strong>
                    <span style={{ color: "#64748b", marginLeft: 10 }}>
                      Facility: {item.facilityName}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ color: "#dc2626", fontWeight: 700 }}>
                      Available: {item.quantityOnHand} units (Min: {item.minimumStockLevel})
                    </span>
                    <Link
                      to={`/inventory/${item.medicineId}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "#0f766e",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        textDecoration: "none",
                      }}
                    >
                      Audit Ledger <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card mb-6" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Inventory Routine Actions</h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0" }}>Daily stock receiving, catalog checks, and shelf audits</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <QuickAction
              to="/inventory"
              label="Medicine Inventory"
              description="Real-time stock balance, facilities, and batch records"
              icon={<Pill size={18} />}
              accent="#0f766e"
            />
            <QuickAction
              to="/inventory/receive"
              label="Receive Stock Shipment"
              description="Process and record incoming manufacturer batches"
              icon={<Inbox size={18} />}
              accent="#16a34a"
            />
            <QuickAction
              to="/inventory/expiry"
              label="Expiry Date Monitor"
              description="Monitor critical lots and mitigate expiration wastage"
              icon={<Calendar size={18} />}
              accent="#d97706"
            />
            <QuickAction
              to="/procurement/orders"
              label="Purchase Orders Directory"
              description="Check status of expected inbound warehouse deliveries"
              icon={<Package size={18} />}
              accent="#2563eb"
            />
          </div>
        </div>
      </div>
  );
}

function AdministratorDashboard({ email }: { email: string }) {
  const { orders, facilities, suppliers, inventory, batches, medicines, isLoading, error, refetch } = useDashboardData();

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="System Administration"
        title="Executive Administrator Console"
          subtitle={`Signed in as ${email} · Administrator`}
          actions={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void refetch()}
              disabled={isLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", height: 36, padding: "0 14px", borderRadius: 8 }}
            >
              <RotateCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Data
            </button>
          }
        />

        {error && (
          <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Hospital Facilities"
            value={isLoading ? "…" : facilities.length}
            context="Connected sites"
            icon={<Building2 size={20} />}
            accent="#0f766e"
          />
          <KPICard
            label="Total Purchase Orders"
            value={isLoading ? "…" : orders.length}
            context="System-wide orders"
            icon={<FileText size={20} />}
            accent="#2563eb"
          />
          <KPICard
            label="Active Suppliers"
            value={isLoading ? "…" : suppliers.filter((s) => s.isActive).length}
            context="Approved vendor partners"
            icon={<Users size={20} />}
            accent="#7c3aed"
          />
          <KPICard
            label="Catalog Medicines"
            value={isLoading ? "…" : medicines.length}
            context="Tracked medications"
            icon={<Pill size={20} />}
            accent="#16a34a"
            variant="success"
          />
        </div>

        {/* Real Analytics Section */}
        <AnalyticsRow orders={orders} batches={batches} inventory={inventory} isLoading={isLoading} />

        <div className="card mb-6" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px" }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>Administrative Management</h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0" }}>System-level management across procurement, users, and audit records</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <QuickAction
              to="/procurement/orders"
              label="Purchase Orders Directory"
              description="System-wide procurement records and order status"
              icon={<FileText size={18} />}
              accent="#2563eb"
            />
            <QuickAction
              to="/procurement/approvals"
              label="Managerial Approvals"
              description="Audit and review high-value orders and compliance exceptions"
              icon={<FileCheck2 size={18} />}
              accent="#d97706"
            />
            <QuickAction
              to="/procurement/suppliers"
              label="Supplier Directory"
              description="Audit accredited pharmaceutical suppliers"
              icon={<Building2 size={18} />}
              accent="#0f766e"
            />
            <QuickAction
              to="/inventory"
              label="Stock Balances"
              description="Monitor hospital network inventory and batch compliance"
              icon={<Pill size={18} />}
              accent="#16a34a"
            />
            <QuickAction
              to="/admin/users"
              label="User Management"
              description="Manage administrator access, roles, and active account status"
              icon={<Users size={18} />}
              accent="#7c3aed"
            />
          </div>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DashboardPage — Role Router
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner mb-3" style={{ margin: "0 auto" }} />
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Loading MediStock workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--color-danger-600)", fontWeight: 600 }}>Unauthorized — please sign in.</p>
      </div>
    );
  }

  const roles = user.roles ?? [];
  const email = user.email ?? "";

  const isAdmin = roles.some((r) => ["Administrator", "ADMIN"].includes(r));
  const isManager = roles.some((r) => ["FacilityManager", "FACILITY_MANAGER"].includes(r));
  const isSupplierOfficer = roles.some((r) => ["SupplierOfficer", "SUPPLIER_OFFICER"].includes(r));

  if (isAdmin) return <AdministratorDashboard email={email} />;
  if (isManager) return <FacilityManagerDashboard email={email} />;
  if (isSupplierOfficer) return <ProcurementOfficerDashboard email={email} />;

  return <OperationalStaffDashboard email={email} />;
}
