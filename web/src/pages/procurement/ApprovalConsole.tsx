import React, { useState, useEffect, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import {
  procurementApi,
  type PurchaseOrder,
  type PolicyRule,
} from "../../services/procurementApi";
import { PageHeader, KPICard } from "../../components/ui";
import styles from "./ProcurementPages.module.css";
import {
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
  CircleX,
  FileCheck2,
  ShieldCheck,
  Clock,
  ArrowRight,
  X,
  AlertCircle,
  FileText,
} from "lucide-react";

export function ApprovalConsole() {
  const [pendingOrders, setPendingOrders] = useState<PurchaseOrder[]>([]);
  const [authRules, setAuthRules] = useState<PolicyRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Workflow Reason Modal state
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | "revision" | null>(null);
  const [targetOrder, setTargetOrder] = useState<PurchaseOrder | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pending, rules] = await Promise.all([
        procurementApi.getPendingApprovals(),
        procurementApi.getAuthorizationRules().catch(() => []),
      ]);
      setPendingOrders(pending);
      setAuthRules(rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pending approvals.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleApproveDirect(order: PurchaseOrder) {
    setIsSubmitting(true);
    setError(null);
    try {
      await procurementApi.approvePurchaseOrder(order.id);
      setSuccessMessage(`Purchase order ${order.id.slice(0, 8)}… approved successfully.`);
      void loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve purchase order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWorkflowAction(e: FormEvent) {
    e.preventDefault();
    if (!targetOrder || !activeAction) return;

    if ((activeAction === "reject" || activeAction === "revision") && !actionReason.trim()) {
      setError("A documented justification reason is mandatory for rejection or revision requests.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (activeAction === "reject") {
        await procurementApi.rejectPurchaseOrder(targetOrder.id, actionReason.trim());
        setSuccessMessage(`Order ${targetOrder.id.slice(0, 8)}… rejected. Reason recorded for audit.`);
      } else if (activeAction === "revision") {
        await procurementApi.requestRevision(targetOrder.id, actionReason.trim());
        setSuccessMessage(`Revision requested for order ${targetOrder.id.slice(0, 8)}…`);
      }
      setActiveAction(null);
      setTargetOrder(null);
      setActionReason("");
      void loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to process ${activeAction}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Governance & Compliance"
        title="Managerial Approval Console"
        subtitle="Human-in-the-loop authorization gate for high-value procurement, quantity thresholds, and storage compliance."
        actions={
          <Link to="/procurement/orders" className={styles.secondaryButton}>
            <FileText size={16} /> All Orders Directory →
          </Link>
        }
      />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className={styles.successBanner} role="status">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <KPICard
          label="Pending Authorization"
          value={pendingOrders.length}
          context="Requisitions awaiting sign-off"
          icon={<Clock size={20} />}
          accent="#d97706"
          variant={pendingOrders.length > 0 ? "warning" : "default"}
        />
        <KPICard
          label="Active Governance Rules"
          value={authRules.length || 4}
          context="Institutional procurement thresholds"
          icon={<ShieldCheck size={20} />}
          accent="#0f766e"
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>
          Orders Awaiting Managerial Review ({pendingOrders.length})
        </h2>
      </div>

      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className="spinner mb-2" style={{ margin: "0 auto" }} />
            <p>Loading pending authorizations…</p>
          </div>
        ) : pendingOrders.length === 0 ? (
          <div className={styles.emptyState}>
            <div style={{ color: "#166534", marginBottom: 8 }}>
              <CheckCircle2 size={32} style={{ margin: "0 auto" }} />
            </div>
            <strong>No Pending Orders Awaiting Review</strong>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              All submitted purchase requisitions have been evaluated and authorized.
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>PO Reference</th>
                <th className={styles.th}>Items & Qty</th>
                <th className={styles.th}>Estimated Total</th>
                <th className={styles.th}>Date Submitted</th>
                <th className={styles.th}>Policy Flags</th>
                <th className={styles.th} style={{ minWidth: 260 }}>Decision Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order) => {
                const totalCost = (order.items || []).reduce(
                  (sum, it) => sum + it.requestedQuantity * it.unitPrice,
                  0
                );
                const totalQuantity = (order.items || []).reduce(
                  (sum, it) => sum + it.requestedQuantity,
                  0
                );
                const isHighValue = totalCost >= 10000;
                const isBulk = totalQuantity >= 1000;

                return (
                  <tr key={order.id} className={styles.tr}>
                    <td className={styles.td}>
                      <code>PO-{order.id.slice(0, 8)}</code>
                    </td>
                    <td className={styles.td} style={{ whiteSpace: "nowrap" }}>
                      <strong>{order.items?.length ?? 0} item(s)</strong> • {totalQuantity} units
                    </td>
                    <td className={styles.td} style={{ whiteSpace: "nowrap" }}>
                      <strong style={{ color: "#0f172a" }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </td>
                    <td className={styles.td} style={{ whiteSpace: "nowrap" }}>{new Date(order.requestedAt).toLocaleDateString()}</td>
                    <td className={styles.td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {isHighValue && (
                          <span className={styles.badgeWarning}>
                            <AlertTriangle size={12} /> High Value ($10k+)
                          </span>
                        )}
                        {isBulk && (
                          <span className={styles.badgeInfo}>
                            <Clock size={12} /> Bulk Volume (1k+ units)
                          </span>
                        )}
                        {!isHighValue && !isBulk && (
                          <span className={styles.badgeSuccess}>
                            <CheckCircle2 size={12} /> Standard Threshold
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.actionBtnPrimary}
                          onClick={() => void handleApproveDirect(order)}
                          disabled={isSubmitting}
                          title="Approve purchase order"
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtnWarning}
                          onClick={() => {
                            setTargetOrder(order);
                            setActiveAction("revision");
                            setActionReason("");
                          }}
                          disabled={isSubmitting}
                          title="Request requisition revision"
                        >
                          Revise…
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtnDanger}
                          onClick={() => {
                            setTargetOrder(order);
                            setActiveAction("reject");
                            setActionReason("");
                          }}
                          disabled={isSubmitting}
                          title="Reject purchase order"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Rejection / Revision Reason Modal */}
      {activeAction && targetOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>
                {activeAction === "reject" ? "Reject Purchase Order" : "Request Requisition Revision"}
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onClick={() => {
                  setActiveAction(null);
                  setTargetOrder(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleWorkflowAction}>
              <div className={styles.modalBody}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#334155" }}>
                  PO Reference: <code>{targetOrder.id}</code>
                </p>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                  {activeAction === "reject"
                    ? "Rejecting this purchase order terminates the procurement lifecycle and logs the audit rationale."
                    : "Requesting revision returns this purchase order to Draft status for amendments by the Procurement Officer."}
                </p>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Documented Audit Justification *</label>
                  <textarea
                    required
                    rows={4}
                    className={styles.formTextarea}
                    placeholder={
                      activeAction === "reject"
                        ? "State the reason for rejection (e.g. Budget exhaustion, discontinued protocol)..."
                        : "Describe required modifications (e.g. Reduce quantity to 500 units to fit quarterly allocation)..."
                    }
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setActiveAction(null);
                    setTargetOrder(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={activeAction === "reject" ? styles.dangerButton : styles.warningButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Recording Decision…"
                    : activeAction === "reject"
                    ? "Confirm Rejection"
                    : "Submit Revision Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
