import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../features/auth/AuthContext";
import { PageHeader } from "../components/ui";
import { procurementApi, type PurchaseOrder, type SupplierItem } from "../services/procurementApi";
import { inventoryApi } from "../services/inventoryApi";
import { getShortages } from "../services/demandApi";
import type { Inventory, Batch, Medicine, Facility } from "../types/inventory";
import type { ShortageAlert } from "../types/demand";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  AlertTriangle,
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
  ShieldAlert,
  Layers,
  ArrowUpRight,
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
  shortages: ShortageAlert[];
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
  const [shortages, setShortages] = useState<ShortageAlert[]>([]);
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
        shortagesRes,
      ] = await Promise.all([
        procurementApi.getPurchaseOrders().catch(() => []),
        procurementApi.getPendingApprovals().catch(() => []),
        procurementApi.getSuppliers().catch(() => []),
        inventoryApi.list(true).catch(() => []),
        inventoryApi.batches().catch(() => []),
        inventoryApi.medicines(true).catch(() => []),
        inventoryApi.facilities().catch(() => []),
        getShortages({ pageSize: 50 }).then((r) => r.items).catch(() => []),
      ]);

      setOrders(ordersRes);
      setPendingApprovals(pendingRes);
      setSuppliers(suppliersRes);
      setInventory(inventoryRes);
      setBatches(batchesRes);
      setMedicines(medicinesRes);
      setFacilities(facilitiesRes);
      setShortages(shortagesRes);
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
    shortages,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Bento Tile Card Component
// ─────────────────────────────────────────────────────────────────────────────

interface BentoTileProps {
  children: React.ReactNode;
  colSpan?: number; // 1 to 12
  accentColor?: string;
  style?: React.CSSProperties;
  className?: string;
}

function BentoTile({ children, colSpan = 4, accentColor, style, className = "" }: BentoTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`bento-tile ${className}`}
      style={{
        gridColumn: `span ${colSpan}`,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        borderRadius: 14,
        border: "1px solid var(--border-default, #e2e8f0)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.02)",
        position: "relative",
        overflow: "hidden",
        borderTop: accentColor ? `3px solid ${accentColor}` : undefined,
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton for Bento Tiles
// ─────────────────────────────────────────────────────────────────────────────

function BentoSkeleton({ colSpan = 4, height = 240 }: { colSpan?: number; height?: number }) {
  return (
    <div
      style={{
        gridColumn: `span ${colSpan}`,
        height,
        background: "#ffffff",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ height: 14, width: "35%", background: "#f1f5f9", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
      <div style={{ height: 32, width: "25%", background: "#e2e8f0", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
      <div style={{ flex: 1, background: "#f8fafc", borderRadius: 8, animation: "pulse 1.5s infinite" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Facility Manager Bento Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function FacilityManagerDashboard({ email }: { email: string }) {
  const { orders, pendingApprovals, inventory, batches, shortages, isLoading, error, refetch } = useDashboardData();
  const now = useMemo(() => Date.now(), []);

  // Filter shortages: OPEN or ACKNOWLEDGED
  const activeShortages = useMemo(
    () => shortages.filter((s) => ["OPEN", "ACKNOWLEDGED"].includes(s.status.toUpperCase())),
    [shortages]
  );

  const lowStockCount = useMemo(
    () => inventory.filter((i) => i.isBelowMinimum).length,
    [inventory]
  );

  const expiringBatches30d = useMemo(() => {
    return batches.filter((b) => {
      const ms = new Date(b.expiryDateUtc).getTime() - now;
      return ms > 0 && ms <= 30 * 86400000;
    });
  }, [batches, now]);

  const poStatusData = useMemo(() => {
    const counts = {
      Approved: orders.filter((o) => o.status === "Approved").length,
      "Pending Review": orders.filter((o) => o.status === "PendingApproval").length,
      Received: orders.filter((o) => o.status === "Received").length,
      Draft: orders.filter((o) => o.status === "Draft").length,
    };
    return [
      { name: "Approved", count: counts.Approved, fill: "#0f766e" },
      { name: "Pending", count: counts["Pending Review"], fill: "#d97706" },
      { name: "Received", count: counts.Received, fill: "#2563eb" },
      { name: "Draft", count: counts.Draft, fill: "#94a3b8" },
    ];
  }, [orders]);

  return (
    <div className="page-container" style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 28px" }}>
      <PageHeader
        eyebrow="Clinical Operations & Safety"
        title="Facility Governance & Shortage Radar"
        subtitle={`Signed in as ${email} · Role: Facility Manager`}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(15, 118, 110, 0.08)",
                color: "#0f766e",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Activity size={13} /> Live Stream
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void refetch()}
              disabled={isLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", height: 36, padding: "0 14px", borderRadius: 8 }}
            >
              <RotateCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Data
            </button>
          </div>
        }
      />

      {error && (
        <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── BENTO GRID LAYOUT ─────────────────────────────────────────────── */}
      <div
        className="bento-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {isLoading ? (
          <>
            <BentoSkeleton colSpan={8} height={280} />
            <BentoSkeleton colSpan={4} height={280} />
            <BentoSkeleton colSpan={4} height={220} />
            <BentoSkeleton colSpan={4} height={220} />
            <BentoSkeleton colSpan={4} height={220} />
          </>
        ) : (
          <>
            {/* Tile 1: Primary Shortage & Safety Stock Radar (col-span-8) */}
            <BentoTile colSpan={8} accentColor="#dc2626">
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                      <ShieldAlert size={13} /> Priority Clinical Risk
                    </span>
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 0" }}>
                      Active Shortage & Stockout Radar
                    </h2>
                  </div>
                  <Link
                    to="/demand/shortages"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#dc2626",
                      textDecoration: "none",
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "rgba(220, 38, 38, 0.08)",
                    }}
                  >
                    View All ({activeShortages.length}) <ArrowUpRight size={13} />
                  </Link>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: "12px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fee2e2" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#991b1b" }}>Critical Shortages</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#dc2626", marginTop: 2 }}>
                      {activeShortages.filter((s) => s.riskLevel.toUpperCase() === "HIGH").length}
                    </div>
                    <span style={{ fontSize: 11, color: "#b91c1c" }}>Cover &lt; supplier lead time</span>
                  </div>

                  <div style={{ padding: "12px 14px", background: "#fffbeb", borderRadius: 10, border: "1px solid #fef3c7" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e" }}>Reserve Minimum Breaches</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#d97706", marginTop: 2 }}>
                      {lowStockCount}
                    </div>
                    <span style={{ fontSize: 11, color: "#b45309" }}>Items below safe buffer</span>
                  </div>

                  <div style={{ padding: "12px 14px", background: "#f0fdfa", borderRadius: 10, border: "1px solid #ccfbf1" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#0f766e" }}>Monitored Items</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#0f766e", marginTop: 2 }}>
                      {inventory.length}
                    </div>
                    <span style={{ fontSize: 11, color: "#115e59" }}>Facility stock balances</span>
                  </div>
                </div>

                {/* Top 3 Live Alerts */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeShortages.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "#fafafa",
                        borderRadius: 8,
                        border: "1px solid #f1f5f9",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: alert.riskLevel.toUpperCase() === "HIGH" ? "#dc2626" : "#d97706",
                          }}
                        />
                        <strong style={{ color: "#0f172a" }}>Facility Stock Alert #{alert.id.slice(0, 8)}</strong>
                        <span style={{ color: "#64748b" }}>
                          Stock: {alert.currentStock} units · Rate: {alert.averageDailyConsumption}/day
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 700, color: alert.riskLevel.toUpperCase() === "HIGH" ? "#dc2626" : "#d97706" }}>
                          {alert.daysRemaining !== null ? `${alert.daysRemaining} days left` : "0 days"}
                        </span>
                        <Link
                          to={`/demand/shortages`}
                          style={{ color: "#0f766e", fontSize: 11, fontWeight: 600, textDecoration: "none" }}
                        >
                          Resolve →
                        </Link>
                      </div>
                    </div>
                  ))}
                  {activeShortages.length === 0 && (
                    <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "0.8125rem" }}>
                      No active shortages detected. All medicine balances satisfy minimum safe buffers.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Deterministic reorder rules checked against real-time consumption velocity
                </span>
                <Link to="/demand/shortages" className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px", height: 30 }}>
                  Open Shortage Console
                </Link>
              </div>
            </BentoTile>

            {/* Tile 2: Actionable Approvals Queue (col-span-4) */}
            <BentoTile colSpan={4} accentColor="#d97706">
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={13} /> Action Queue
                    </span>
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 0" }}>
                      Pending Approvals
                    </h2>
                  </div>
                  <span
                    style={{
                      background: pendingApprovals.length > 0 ? "#fef3c7" : "#f1f5f9",
                      color: pendingApprovals.length > 0 ? "#b45309" : "#64748b",
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {pendingApprovals.length} pending
                  </span>
                </div>

                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px", lineHeight: 1.4 }}>
                  High-value purchase orders and replenishment transfers awaiting managerial sign-off.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 170, overflowY: "auto" }}>
                  {pendingApprovals.slice(0, 3).map((po) => {
                    const totalCost = (po.items || []).reduce((sum, it) => sum + it.requestedQuantity * it.unitPrice, 0);
                    return (
                      <div
                        key={po.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "#fffaf5",
                          border: "1px solid #fed7aa",
                          fontSize: "0.8125rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#0f172a" }}>PO-{po.id.slice(0, 8)}</strong>
                          <div style={{ fontSize: 11, color: "#78716c" }}>
                            {po.items?.length ?? 0} item(s) · {new Date(po.requestedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#0f766e" }}>
                            ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <Link to="/procurement/approvals" style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>
                            Review →
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {pendingApprovals.length === 0 && (
                    <div style={{ padding: "24px 12px", textAlign: "center", color: "#64748b", fontSize: 12 }}>
                      <CheckCircle2 size={24} color="#16a34a" style={{ margin: "0 auto 6px" }} />
                      No pending approval gates. All orders up to date.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                <Link
                  to="/procurement/approvals"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "#ffedd5",
                    color: "#9a3412",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                    border: "1px solid #fed7aa",
                  }}
                >
                  Manage Approval Console <ArrowRight size={13} />
                </Link>
              </div>
            </BentoTile>

            {/* Tile 3: Inventory Runway & Stock Balance (col-span-4) */}
            <BentoTile colSpan={4} accentColor="#0f766e">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Pill size={13} /> Inventory Balance
                </span>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 12px" }}>
                  Hospital Formulary Runway
                </h3>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>
                    {inventory.reduce((sum, item) => sum + item.quantityOnHand, 0).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>total units on hand</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                    <span>Active Formulary Medicines:</span>
                    <strong style={{ color: "#0f172a" }}>{inventory.length}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                    <span>Reserved for Orders:</span>
                    <strong style={{ color: "#d97706" }}>
                      {inventory.reduce((sum, item) => sum + (item.quantityReserved || 0), 0).toLocaleString()} units
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                    <span>Active Lots Tracked:</span>
                    <strong style={{ color: "#0f766e" }}>{batches.length} batches</strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                <Link to="/inventory" style={{ display: "flex", alignItems: "center", gap: 4, color: "#0f766e", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  Inspect Full Inventory Ledger <ArrowRight size={12} />
                </Link>
              </div>
            </BentoTile>

            {/* Tile 4: Procurement Pipeline Distribution (col-span-4) */}
            <BentoTile colSpan={4} accentColor="#2563eb">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Package size={13} /> Order Pipeline
                </span>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 8px" }}>
                  Purchase Order Status Distribution
                </h3>

                <div style={{ height: 110, width: "100%", marginTop: 6 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={poStatusData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {poStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                <Link to="/procurement/orders" style={{ display: "flex", alignItems: "center", gap: 4, color: "#2563eb", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  View All Orders ({orders.length}) <ArrowRight size={12} />
                </Link>
              </div>
            </BentoTile>

            {/* Tile 5: Batch Expiration Watch (col-span-4) */}
            <BentoTile colSpan={4} accentColor="#f59e0b">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Calendar size={13} /> Expiry Integrity
                </span>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 8px" }}>
                  Shelf-Life & Expiration Watch
                </h3>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: expiringBatches30d.length > 0 ? "#d97706" : "#0f766e" }}>
                    {expiringBatches30d.length}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>batches expiring &lt; 30 days</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  {expiringBatches30d.slice(0, 2).map((b) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", color: "#475569", background: "#fffbeb", padding: "4px 8px", borderRadius: 6 }}>
                      <span>Batch {b.batchNumber}</span>
                      <strong style={{ color: "#d97706" }}>
                        {Math.max(0, Math.ceil((new Date(b.expiryDateUtc).getTime() - now) / 86400000))}d remaining
                      </strong>
                    </div>
                  ))}
                  {expiringBatches30d.length === 0 && (
                    <div style={{ color: "#16a34a", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} /> No batches expiring within the next 30 days.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                <Link to="/inventory/expiry" style={{ display: "flex", alignItems: "center", gap: 4, color: "#d97706", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  Open Expiry Date Monitor <ArrowRight size={12} />
                </Link>
              </div>
            </BentoTile>

            {/* Tile 6: AI Coordinator & Operational Fast Lane (col-span-12) */}
            <BentoTile colSpan={12} style={{ background: "linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(240, 253, 250, 0.95))" }}>
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={13} /> Workflow Fast Lane
                </span>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 2px" }}>
                  Autonomous Coordinator & Routine Actions
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  Execute automated supply chain agents, request stock transfers, or audit compliance logs.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                <Link
                  to="/coordinator"
                  style={{
                    padding: "14px",
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #e0e7ff",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ padding: 8, borderRadius: 8, background: "#eef2ff", color: "#4f46e5" }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>AI Coordinator</strong>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Multi-agent shortage analysis & drafting</span>
                  </div>
                </Link>

                <Link
                  to="/redistribution/transfers"
                  style={{
                    padding: "14px",
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #ccfbf1",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ padding: 8, borderRadius: 8, background: "#f0fdfa", color: "#0f766e" }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>Inter-Hospital Transfers</strong>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Redistribute excess surplus stock</span>
                  </div>
                </Link>

                <Link
                  to="/demand/forecast"
                  style={{
                    padding: "14px",
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ padding: 8, borderRadius: 8, background: "#f1f5f9", color: "#0f172a" }}>
                    <Activity size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>Demand Forecasting</strong>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Trend & consumption run-rates</span>
                  </div>
                </Link>

                <Link
                  to="/inventory/receive"
                  style={{
                    padding: "14px",
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ padding: 8, borderRadius: 8, background: "#f0fdf4", color: "#16a34a" }}>
                    <Inbox size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>Receive Shipments</strong>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Process incoming warehouse batches</span>
                  </div>
                </Link>
              </div>
            </BentoTile>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Administrator Bento Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function AdministratorDashboard({ email }: { email: string }) {
  const { orders, facilities, suppliers, medicines, pendingApprovals, shortages, isLoading, error, refetch } = useDashboardData();

  return (
    <div className="page-container" style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 28px" }}>
      <PageHeader
        eyebrow="System Administration"
        title="Executive Administrator Console"
        subtitle={`Signed in as ${email} · Role: Administrator`}
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
        <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── BENTO GRID LAYOUT ─────────────────────────────────────────────── */}
      <div
        className="bento-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {isLoading ? (
          <>
            <BentoSkeleton colSpan={8} height={260} />
            <BentoSkeleton colSpan={4} height={260} />
            <BentoSkeleton colSpan={4} height={200} />
            <BentoSkeleton colSpan={4} height={200} />
            <BentoSkeleton colSpan={4} height={200} />
          </>
        ) : (
          <>
            {/* Tile 1: System-wide Hospital Network Overview (col-span-8) */}
            <BentoTile colSpan={8} accentColor="#0f172a">
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                      <Building2 size={13} /> Enterprise Network
                    </span>
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 0" }}>
                      Healthcare Facility Infrastructure & Capacity
                    </h2>
                  </div>
                  <Link
                    to="/admin/users"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#0f172a",
                      textDecoration: "none",
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "#f1f5f9",
                    }}
                  >
                    User Management <ArrowUpRight size={13} />
                  </Link>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Hospital Sites</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{facilities.length}</div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>Connected facilities</span>
                  </div>

                  <div style={{ padding: "12px 14px", background: "#eff6ff", borderRadius: 10, border: "1px solid #dbeafe" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8" }}>Purchase Orders</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>{orders.length}</div>
                    <span style={{ fontSize: 11, color: "#3b82f6" }}>All-time orders</span>
                  </div>

                  <div style={{ padding: "12px 14px", background: "#f5f3ff", borderRadius: 10, border: "1px solid #ede9fe" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#6d28d9" }}>Active Suppliers</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#7c3aed", marginTop: 2 }}>
                      {suppliers.filter((s) => s.isActive).length}
                    </div>
                    <span style={{ fontSize: 11, color: "#8b5cf6" }}>Accredited partners</span>
                  </div>

                  <div style={{ padding: "12px 14px", background: "#f0fdfa", borderRadius: 10, border: "1px solid #ccfbf1" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#0f766e" }}>Catalog Medicines</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#0f766e", marginTop: 2 }}>{medicines.length}</div>
                    <span style={{ fontSize: 11, color: "#14b8a6" }}>Tracked formulary</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ShieldCheck size={16} color="#0f766e" />
                    <span><strong>System Audit Log Integrity:</strong> Active recording with immutable trace hashes</span>
                  </div>
                  <Link to="/admin/audit-logs" style={{ color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>
                    Open Audit Console →
                  </Link>
                </div>
              </div>
            </BentoTile>

            {/* Tile 2: Administrative Governance (col-span-4) */}
            <BentoTile colSpan={4} accentColor="#7c3aed">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Users size={13} /> Governance & Access
                </span>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 10px" }}>
                  Administrative Management
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
                  System-level governance over authentication, RBAC authorization, and user directory.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link
                    to="/admin/users"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#f5f3ff",
                      border: "1px solid #ede9fe",
                      textDecoration: "none",
                      color: "#6d28d9",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users size={14} /> User Management
                    </span>
                    <ArrowRight size={13} />
                  </Link>

                  <Link
                    to="/admin/audit-logs"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      textDecoration: "none",
                      color: "#0f172a",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <ShieldCheck size={14} /> Enterprise Audit Console
                    </span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Administrator policy clearance verified</span>
              </div>
            </BentoTile>

            {/* Tile 3: Procurement & Approvals Pipeline (col-span-6) */}
            <BentoTile colSpan={6} accentColor="#2563eb">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Package size={13} /> Procurement Pipeline
                </span>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 10px" }}>
                  Requisition & Delivery Overview
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Pending Review</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#d97706" }}>{pendingApprovals.length}</div>
                  </div>
                  <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Approved</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f766e" }}>
                      {orders.filter((o) => o.status === "Approved").length}
                    </div>
                  </div>
                  <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Received</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#2563eb" }}>
                      {orders.filter((o) => o.status === "Received").length}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                <Link to="/procurement/orders" style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textDecoration: "none" }}>
                  View All Procurement Orders →
                </Link>
              </div>
            </BentoTile>

            {/* Tile 4: System Shortages & Alerts (col-span-6) */}
            <BentoTile colSpan={6} accentColor="#dc2626">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertTriangle size={13} /> Shortage Management
                </span>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 10px" }}>
                  Network-Wide Shortage Tracking
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: "8px 10px", background: "#fef2f2", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#991b1b" }}>Open Alerts</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>
                      {(shortages || []).filter((s) => s.status === "OPEN").length}
                    </div>
                  </div>
                  <div style={{ padding: "8px 10px", background: "#fffbeb", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#92400e" }}>Acknowledged</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#d97706" }}>
                      {(shortages || []).filter((s) => s.status === "ACKNOWLEDGED").length}
                    </div>
                  </div>
                  <div style={{ padding: "8px 10px", background: "#f0fdf4", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#166534" }}>Resolved</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>
                      {(shortages || []).filter((s) => s.status === "RESOLVED").length}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                <Link to="/demand/shortages" style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", textDecoration: "none" }}>
                  Open Shortage Console →
                </Link>
              </div>
            </BentoTile>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Procurement Officer Bento Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function ProcurementOfficerDashboard({ email }: { email: string }) {
  const { orders, suppliers, isLoading, error, refetch } = useDashboardData();

  return (
    <div className="page-container" style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 28px" }}>
      <PageHeader
        eyebrow="Supply Chain & Procurement"
        title="Procurement Officer Command Console"
        subtitle={`Signed in as ${email} · Role: Supplier Officer`}
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
        <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div
        className="bento-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <BentoTile colSpan={6} accentColor="#2563eb">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Procurement Orders</span>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 10px" }}>Total Purchase Orders</h3>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>{orders.length}</div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
            <Link to="/procurement/orders" style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textDecoration: "none" }}>
              View Orders Directory →
            </Link>
          </div>
        </BentoTile>

        <BentoTile colSpan={6} accentColor="#7c3aed">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase" }}>Suppliers</span>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: "4px 0 10px" }}>Active Supplier Directory</h3>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>{suppliers.filter((s) => s.isActive).length}</div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
            <Link to="/procurement/suppliers" style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", textDecoration: "none" }}>
              Manage Suppliers →
            </Link>
          </div>
        </BentoTile>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Operational Staff Bento Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function OperationalStaffDashboard({ email }: { email: string }) {
  const { orders, inventory, batches, medicines, isLoading, error, refetch } = useDashboardData();
  const now = useMemo(() => Date.now(), []);

  const expiringSoonCount = useMemo(() => {
    return batches.filter((b) => {
      const ms = new Date(b.expiryDateUtc).getTime() - now;
      return ms > 0 && ms <= 30 * 86400000;
    }).length;
  }, [batches, now]);

  const lowStockCount = inventory.filter((i) => i.isBelowMinimum).length;
  const receivedCount = orders.filter((o) => o.status === "Received").length;

  return (
    <div className="page-container" style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 28px" }}>
      <PageHeader
        eyebrow="Pharmacy & Storage"
        title="Staff Inventory Dashboard"
        subtitle={`Signed in as ${email} · Role: Operational Staff`}
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
        <div className="alert alert-danger mb-4" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div
        className="bento-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <BentoTile colSpan={3} accentColor="#0f766e">
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0f766e" }}>Catalog Medicines</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
            {medicines.filter((m) => m.isActive).length}
          </div>
          <Link to="/inventory" style={{ fontSize: 11, color: "#0f766e", marginTop: 8, textDecoration: "none" }}>
            View Catalog →
          </Link>
        </BentoTile>

        <BentoTile colSpan={3} accentColor="#d97706">
          <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706" }}>Expiring Soon</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: expiringSoonCount > 0 ? "#d97706" : "#0f172a", marginTop: 4 }}>
            {expiringSoonCount}
          </div>
          <Link to="/inventory/expiry" style={{ fontSize: 11, color: "#d97706", marginTop: 8, textDecoration: "none" }}>
            Monitor Expiries →
          </Link>
        </BentoTile>

        <BentoTile colSpan={3} accentColor="#dc2626">
          <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Low Stock Alerts</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: lowStockCount > 0 ? "#dc2626" : "#0f172a", marginTop: 4 }}>
            {lowStockCount}
          </div>
          <Link to="/inventory" style={{ fontSize: 11, color: "#dc2626", marginTop: 8, textDecoration: "none" }}>
            Audit Ledger →
          </Link>
        </BentoTile>

        <BentoTile colSpan={3} accentColor="#16a34a">
          <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>Stock Receipts</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>{receivedCount}</div>
          <Link to="/inventory/receive" style={{ fontSize: 11, color: "#16a34a", marginTop: 8, textDecoration: "none" }}>
            Receive Intake →
          </Link>
        </BentoTile>
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

export default DashboardPage;
