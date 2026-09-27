import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import {
  procurementApi,
  type PurchaseOrder,
  type Delivery,
} from "../../services/procurementApi";
import { PageHeader, KPICard } from "../../components/ui";
import styles from "./ProcurementPages.module.css";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleX,
  Truck,
  PackageCheck,
  FileText,
  Activity,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
} from "lucide-react";

export function WorkflowMonitor() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await procurementApi.getPurchaseOrders();
      setOrders(data);
      if (data.length > 0 && !selectedOrder) {
        setSelectedOrder(data[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflow state.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    async function loadDelivery() {
      if (!selectedOrder) {
        setDelivery(null);
        return;
      }
      const del = await procurementApi.getDeliveryByPurchaseOrder(selectedOrder.id);
      setDelivery(del);
    }
    void loadDelivery();
  }, [selectedOrder]);

  // Determine stage progression for the selected order
  const status = selectedOrder?.status ?? "Draft";
  const isDraft = status === "Draft";
  const isPending = status === "PendingApproval";
  const isApproved = status === "Approved";
  const isRejected = status === "Rejected";
  const isRevision = status === "RevisionRequired";
  const isDelivered = delivery?.status === "Delivered";
  const isInTransit = delivery?.status === "InTransit";

  const workflowSteps = [
    {
      title: "1. Requisition Draft",
      description: "Order initiated with requested medicine quantities and catalog pricing.",
      state: isDraft ? "current" : "completed",
      icon: <FileText size={18} />,
    },
    {
      title: "2. Managerial Submission",
      description: "Requisition queued for facility management authorization and compliance check.",
      state: isDraft ? "upcoming" : isPending ? "current" : "completed",
      icon: <Clock size={18} />,
    },
    {
      title: "3. Policy & Threshold Validation",
      description: "Automated checks against institutional budget limits ($10k ceiling) and bulk quotas (1k units).",
      state: isDraft ? "upcoming" : isPending ? "current" : isRejected ? "rejected" : "completed",
      icon: <ShieldCheck size={18} />,
    },
    {
      title: "4. Human Approval Gate",
      description: isRejected
        ? `Rejected: "${selectedOrder?.rejectionReason || "Criteria not met"}"`
        : isRevision
        ? `Revision Requested: "${selectedOrder?.revisionReason || "Adjustments required"}"`
        : isApproved
        ? `Approved on ${selectedOrder?.approvedAt ? new Date(selectedOrder.approvedAt).toLocaleDateString() : "Record"}`
        : "Awaiting clinical authority authorization.",
      state: isApproved
        ? "completed"
        : isRejected
        ? "rejected"
        : isRevision
        ? "warning"
        : isPending
        ? "current"
        : "upcoming",
      icon: <CheckCircle2 size={18} />,
    },
    {
      title: "5. Vendor Logistics & Delivery",
      description: isDelivered
        ? `Delivered to warehouse (Tracking: ${delivery?.trackingNumber || "Assigned"})`
        : isInTransit
        ? "Consignment dispatched and in transit to receiving hospital facility."
        : isApproved
        ? "Purchase order confirmed with vendor; preparing fulfillment shipment."
        : "Pending approval clearance.",
      state: isDelivered ? "completed" : isInTransit ? "current" : isApproved ? "current" : "upcoming",
      icon: <Truck size={18} />,
    },
    {
      title: "6. Inventory Stock Integration",
      description: isDelivered
        ? "Stock batches ingested into central medicine balances and ready for dispension."
        : "Awaiting physical delivery verification and cold-chain inspection.",
      state: isDelivered ? "completed" : "upcoming",
      icon: <PackageCheck size={18} />,
    },
  ];

  const pendingCount = orders.filter((o) => o.status === "PendingApproval").length;
  const approvedCount = orders.filter((o) => o.status === "Approved").length;
  const receivedCount = orders.filter((o) => o.status === "Received").length;

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Real-Time Traceability"
        title="Procurement Workflow Monitor"
        subtitle="End-to-end lifecycle tracking from clinical requisition, through policy validation and approval gating, to warehouse delivery."
        actions={
          <Link to="/procurement/orders" className={styles.secondaryButton}>
            <FileText size={16} /> All Orders Directory
          </Link>
        }
      />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Workflow Summary KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Tracked Orders"
          value={isLoading ? "…" : orders.length}
          context="Total lifecycle requisitions"
          icon={<FileText size={20} />}
          accent="#0f766e"
        />
        <KPICard
          label="Pending Review"
          value={isLoading ? "…" : pendingCount}
          context="At managerial gate"
          icon={<Clock size={20} />}
          accent="#d97706"
          variant={pendingCount > 0 ? "warning" : "default"}
        />
        <KPICard
          label="Approved / In Flight"
          value={isLoading ? "…" : approvedCount}
          context="Vendor fulfillment stage"
          icon={<Truck size={20} />}
          accent="#2563eb"
        />
        <KPICard
          label="Fulfilled into Stock"
          value={isLoading ? "…" : receivedCount}
          context="Received & inspected"
          icon={<PackageCheck size={20} />}
          accent="#16a34a"
          variant="success"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 20 }}>
        {/* Left Column: PO Selector */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 18,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h3
            style={{
              margin: "0 0 14px 0",
              fontSize: "0.875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#64748b",
            }}
          >
            Select Purchase Order
          </h3>
          {isLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
              <div className="spinner mb-2" style={{ margin: "0 auto" }} />
              <p style={{ fontSize: "0.8125rem" }}>Loading orders…</p>
            </div>
          ) : orders.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "0.875rem" }}>No orders available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
              {orders.map((po) => {
                const isSelected = selectedOrder?.id === po.id;
                return (
                  <button
                    key={po.id}
                    type="button"
                    onClick={() => setSelectedOrder(po)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? "#0f766e" : "#e2e8f0"}`,
                      background: isSelected ? "#f0fdfa" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.8125rem", color: isSelected ? "#0f766e" : "#0f172a" }}>
                        PO-{po.id.slice(0, 8)}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 9999,
                          background:
                            po.status === "Approved"
                              ? "#dcfce7"
                              : po.status === "PendingApproval"
                              ? "#fef3c7"
                              : po.status === "Rejected"
                              ? "#fee2e2"
                              : "#f1f5f9",
                          color:
                            po.status === "Approved"
                              ? "#15803d"
                              : po.status === "PendingApproval"
                              ? "#b45309"
                              : po.status === "Rejected"
                              ? "#b91c1c"
                              : "#475569",
                        }}
                      >
                        {po.status}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                      {new Date(po.requestedAt).toLocaleDateString()} • {po.items?.length ?? 0} item(s)
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Visual Stage Tracker */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "28px 32px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {selectedOrder ? (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 24,
                  paddingBottom: 20,
                  borderBottom: "1px solid #f1f5f9",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.375rem", fontWeight: 700 }}>
                    Lifecycle: PO-{selectedOrder.id.slice(0, 8)}…
                  </h2>
                  <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.875rem" }}>
                    Target Facility ID: <code>{selectedOrder.facilityId}</code> • Initiated:{" "}
                    {new Date(selectedOrder.requestedAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    selectedOrder.status === "Approved"
                      ? styles.badgeSuccess
                      : selectedOrder.status === "PendingApproval"
                      ? styles.badgeWarning
                      : selectedOrder.status === "Rejected"
                      ? styles.badgeDanger
                      : styles.badgeNeutral
                  }
                  style={{ fontSize: "0.8125rem", padding: "5px 12px" }}
                >
                  Current State: {selectedOrder.status}
                </span>
              </div>

              {/* Vertical Step Sequence */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {workflowSteps.map((step, idx) => {
                  const isCompleted = step.state === "completed";
                  const isCurrent = step.state === "current";
                  const isRejectedState = step.state === "rejected";
                  const isWarningState = step.state === "warning";

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: 16,
                        padding: 16,
                        borderRadius: 10,
                        border: `1px solid ${
                          isCurrent
                            ? "#0f766e"
                            : isCompleted
                            ? "#bbf7d0"
                            : isRejectedState
                            ? "#fecaca"
                            : isWarningState
                            ? "#fde68a"
                            : "#e2e8f0"
                        }`,
                        background: isCurrent
                          ? "#f0fdfa"
                          : isCompleted
                          ? "#f0fdf4"
                          : isRejectedState
                          ? "#fef2f2"
                          : isWarningState
                          ? "#fffbeb"
                          : "#ffffff",
                        transition: "all 150ms ease",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          background: isCurrent
                            ? "#0f766e"
                            : isCompleted
                            ? "#15803d"
                            : isRejectedState
                            ? "#dc2626"
                            : isWarningState
                            ? "#d97706"
                            : "#e2e8f0",
                          color: isCurrent || isCompleted || isRejectedState || isWarningState ? "#ffffff" : "#64748b",
                        }}
                      >
                        {step.icon}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: "0.9375rem",
                              fontWeight: 700,
                              color: isRejectedState ? "#991b1b" : isCurrent ? "#0f766e" : "#0f172a",
                            }}
                          >
                            {step.title}
                          </h4>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: isCurrent
                                ? "#0f766e"
                                : isCompleted
                                ? "#15803d"
                                : isRejectedState
                                ? "#b91c1c"
                                : isWarningState
                                ? "#b45309"
                                : "#94a3b8",
                            }}
                          >
                            {step.state}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: "0.8125rem", color: "#475569", lineHeight: 1.4 }}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>Select an order from the list to inspect its workflow history.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
