import React, { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  procurementApi,
  type PurchaseOrder,
  type PolicyRule,
} from "../../services/procurementApi";
import { PageHeader, KPICard } from "../../components/ui";
import styles from "./ProcurementPages.module.css";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  X,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Check,
} from "lucide-react";

export function ApprovalConsole() {
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<"all" | "high-value" | "bulk" | "standard">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Workflow Reason Modal state
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | "revision" | null>(null);
  const [targetOrder, setTargetOrder] = useState<PurchaseOrder | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TanStack Query for authoritative pending approvals
  const {
    data: pendingOrders = [],
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<PurchaseOrder[]>({
    queryKey: ["approvals", "pending"],
    queryFn: () => procurementApi.getPendingApprovals(),
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Query authorization rules
  const { data: authRules = [] } = useQuery<PolicyRule[]>({
    queryKey: ["procurement", "auth-rules"],
    queryFn: () => procurementApi.getAuthorizationRules().catch(() => []),
    staleTime: 1000 * 60 * 10,
  });

  // Listen to cross-system approval updates (e.g. from Coordinator inline chat)
  useEffect(() => {
    const handleApprovalEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ workflowId?: string; decision?: string }>;
      void queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      void refetch();
      if (customEvent.detail?.decision) {
        setSuccessMessage(
          `Reconciled authoritative approval state: ${customEvent.detail.decision} recorded via Coordinator.`
        );
      }
    };

    window.addEventListener("medistock:approval-updated", handleApprovalEvent);
    window.addEventListener("medistock:workflow-approved", handleApprovalEvent);

    return () => {
      window.removeEventListener("medistock:approval-updated", handleApprovalEvent);
      window.removeEventListener("medistock:workflow-approved", handleApprovalEvent);
    };
  }, [queryClient, refetch]);

  async function handleApproveDirect(order: PurchaseOrder) {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await procurementApi.approvePurchaseOrder(order.id);
      setSuccessMessage(`Purchase order PO-${order.id.slice(0, 8)} approved and committed to dispatch.`);
      await queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      void refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to approve purchase order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWorkflowAction(e: FormEvent) {
    e.preventDefault();
    if (!targetOrder || !activeAction) return;

    if ((activeAction === "reject" || activeAction === "revision") && !actionReason.trim()) {
      setActionError("A documented justification reason is mandatory for rejection or revision requests.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      if (activeAction === "reject") {
        await procurementApi.rejectPurchaseOrder(targetOrder.id, actionReason.trim());
        setSuccessMessage(`Order PO-${targetOrder.id.slice(0, 8)} rejected. Audit rationale archived.`);
      } else if (activeAction === "revision") {
        await procurementApi.requestRevision(targetOrder.id, actionReason.trim());
        setSuccessMessage(`Revision requested for order PO-${targetOrder.id.slice(0, 8)}.`);
      }

      await queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      void refetch();

      // Broadcast update event so Coordinator chat / other components sync
      window.dispatchEvent(
        new CustomEvent("medistock:approval-updated", {
          detail: { decision: activeAction === "reject" ? "Rejected" : "Revision", comments: actionReason.trim() },
        })
      );

      setActiveAction(null);
      setTargetOrder(null);
      setActionReason("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Failed to process ${activeAction}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter and search
  const filteredOrders = pendingOrders.filter((order) => {
    const totalCost = (order.items || []).reduce((sum, it) => sum + it.requestedQuantity * it.unitPrice, 0);
    const totalQty = (order.items || []).reduce((sum, it) => sum + it.requestedQuantity, 0);
    const isHighValue = totalCost >= 10000;
    const isBulk = totalQty >= 1000;

    if (activeFilter === "high-value" && !isHighValue) return false;
    if (activeFilter === "bulk" && !isBulk) return false;
    if (activeFilter === "standard" && (isHighValue || isBulk)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = order.id.toLowerCase().includes(q);
      const matchItem = order.items?.some((i) => i.medicineId?.toLowerCase().includes(q));
      if (!matchId && !matchItem) return false;
    }

    return true;
  });

  const displayError = actionError || (queryError instanceof Error ? queryError.message : null);

  return (
    <div className="page-container" style={{ padding: "24px 32px" }}>
      <PageHeader
        eyebrow="Governance & Clinical Compliance"
        title="Managerial Approvals Console"
        subtitle="Human-in-the-loop authorization gate for high-value procurement, critical threshold deficits, and regulated storage compliance."
        actions={
          <Link to="/procurement/orders" className={styles.secondaryButton}>
            <FileText size={16} /> All Orders Directory →
          </Link>
        }
      />

      {displayError && (
        <div className={styles.errorBanner} role="alert" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{displayError}</span>
        </div>
      )}
      {successMessage && (
        <div className={styles.successBanner} role="status" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Bento Metric Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
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

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: activeFilter === "all" ? "#0f766e" : "#cbd5e1",
              background: activeFilter === "all" ? "#0f766e" : "#fff",
              color: activeFilter === "all" ? "#fff" : "#475569",
              transition: "all 120ms ease",
            }}
          >
            All ({pendingOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("high-value")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: activeFilter === "high-value" ? "#b45309" : "#cbd5e1",
              background: activeFilter === "high-value" ? "#fffbeb" : "#fff",
              color: activeFilter === "high-value" ? "#b45309" : "#475569",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <AlertTriangle size={13} /> High Value ($10k+)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("bulk")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: activeFilter === "bulk" ? "#0284c7" : "#cbd5e1",
              background: activeFilter === "bulk" ? "#f0f9ff" : "#fff",
              color: activeFilter === "bulk" ? "#0284c7" : "#475569",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Clock size={13} /> Bulk Volume (1k+)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("standard")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: activeFilter === "standard" ? "#16a34a" : "#cbd5e1",
              background: activeFilter === "standard" ? "#f0fdf4" : "#fff",
              color: activeFilter === "standard" ? "#16a34a" : "#475569",
            }}
          >
            Standard
          </button>
        </div>

        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Filter by PO ID or medicine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 12px 7px 32px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "0.8125rem",
              outline: "none",
              background: "#fff",
            }}
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className="spinner mb-2" style={{ margin: "0 auto" }} />
            <p>Loading authoritative pending authorizations…</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={styles.emptyState}>
            <div style={{ color: "#166534", marginBottom: 8 }}>
              <CheckCircle2 size={32} style={{ margin: "0 auto" }} />
            </div>
            <strong>No Pending Orders Awaiting Review</strong>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              {pendingOrders.length === 0
                ? "All submitted purchase requisitions have been evaluated and authorized across all facilities."
                : "No pending purchase orders match the selected category filter."}
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
              {filteredOrders.map((order) => {
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
                          title="Authorize purchase order"
                        >
                          <Check size={13} /> Approve
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
                  PO Reference: <code>PO-{targetOrder.id.slice(0, 8)}</code>
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
                        ? "State the reason for rejection (e.g. Budget exhaustion, discontinued protocol, local alternative)..."
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
    </div>
  );
}
