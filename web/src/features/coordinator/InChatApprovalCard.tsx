import React, { useState } from "react";
import type { WorkflowRun } from "@/types/workflow";
import type { ChatMessage } from "./types";
import { useAuth } from "@/features/auth/AuthContext";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Truck,
  ShoppingCart,
  Clock,
  Lock,
  FileCheck,
} from "lucide-react";

interface InChatApprovalCardProps {
  message: ChatMessage;
  workflow: WorkflowRun;
  onSubmitApproval: (decision: "Approved" | "Rejected", comments?: string) => Promise<void>;
  compact?: boolean;
}

interface InChatProposalResult {
  approval_type?: string;
  approval_reason?: string;
  inventory_data?: {
    medicine?: string;
    facility?: string;
    [key: string]: unknown;
  };
  redistribution_proposal?: {
    feasible?: boolean;
    donor_facility?: string;
    quantity?: number | string;
    estimated_transit_hours?: number | string;
    distance_km?: number | string;
    [key: string]: unknown;
  };
  procurement_proposal?: {
    needed?: boolean;
    recommended_supplier?: string;
    order_quantity?: number | string;
    estimated_cost_lkr?: number | string;
    unit_price?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function InChatApprovalCard({
  message,
  workflow,
  onSubmitApproval,
  compact = false,
}: InChatApprovalCardProps) {
  const { hasRole } = useAuth();
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Parse resultJson from workflow
  let result: InChatProposalResult | null = null;
  if (workflow?.resultJson) {
    try {
      result = JSON.parse(workflow.resultJson);
    } catch {
      result = null;
    }
  }

  // Authorization check: FacilityManager or Administrator
  const canAuthorize =
    hasRole("FacilityManager") ||
    hasRole("FACILITY_MANAGER") ||
    hasRole("Administrator") ||
    hasRole("ADMIN");

  const pendingApproval = workflow?.approvals?.find((a) => a.decision === "Pending");
  const approvedItem = workflow?.approvals?.find((a) => a.decision === "Approved");
  const rejectedItem = workflow?.approvals?.find((a) => a.decision === "Rejected");

  // Determine effective approval status
  const currentStatus: "Pending" | "Approved" | "Rejected" =
    message.approvalStatus ||
    (approvedItem
      ? "Approved"
      : rejectedItem
      ? "Rejected"
      : pendingApproval
      ? "Pending"
      : workflow?.status === "WaitingForApproval"
      ? "Pending"
      : workflow?.status === "Completed"
      ? "Approved"
      : workflow?.status === "Failed" || workflow?.status === "Rejected"
      ? "Rejected"
      : "Pending");

  // Proposal data
  const isRedistrib = !!result?.redistribution_proposal?.feasible || !!result?.redistribution_proposal?.donor_facility;
  const isProcure = !!result?.procurement_proposal?.needed || !!result?.procurement_proposal?.recommended_supplier;
  const actionTitle = isRedistrib && isProcure
    ? "Dual Supply Chain Action (Redistribute + Procure)"
    : isRedistrib
    ? "Inter-Facility Stock Redistribution"
    : isProcure
    ? "Autonomous Purchase Order Dispatch"
    : "Clinical Stock Governance Checkpoint";

  const approvalTier = result?.approval_type || pendingApproval?.approvalType || "Tier 1: Facility Authorization";
  const approvalReason = result?.approval_reason || "Mandatory healthcare human-in-the-loop authorization before state resource commitment.";

  async function handleDecision(decision: "Approved" | "Rejected") {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitApproval(decision, comments.trim() || undefined);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to record approval decision.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 12,
        border: `1px solid ${
          currentStatus === "Approved"
            ? "#bbf7d0"
            : currentStatus === "Rejected"
            ? "#fecaca"
            : "#fde68a"
        }`,
        background:
          currentStatus === "Approved"
            ? "#f0fdf4"
            : currentStatus === "Rejected"
            ? "#fef2f2"
            : "#fffbeb",
        overflow: "hidden",
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* ── Card Header ── */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          borderBottom: `1px solid ${
            currentStatus === "Approved"
              ? "#dcfce7"
              : currentStatus === "Rejected"
              ? "#fee2e2"
              : "#fef3c7"
          }`,
          background:
            currentStatus === "Approved"
              ? "#dcfce7"
              : currentStatus === "Rejected"
              ? "#fee2e2"
              : "#fef3c7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {isRedistrib ? (
            <Truck size={15} color="#b45309" strokeWidth={2} />
          ) : isProcure ? (
            <ShoppingCart size={15} color="#b45309" strokeWidth={2} />
          ) : (
            <ShieldAlert size={15} color="#b45309" strokeWidth={2} />
          )}
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#78350f" }}>
            {actionTitle}
          </span>
          <span
            style={{
              fontSize: "0.5625rem",
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 999,
              background: "#fde68a",
              color: "#92400e",
            }}
          >
            {approvalTier}
          </span>
        </div>

        {/* Current status badge */}
        <span
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background:
              currentStatus === "Approved"
                ? "#16a34a"
                : currentStatus === "Rejected"
                ? "#dc2626"
                : "#d97706",
            color: "#ffffff",
          }}
        >
          {currentStatus === "Approved" ? (
            <CheckCircle2 size={11} strokeWidth={2} />
          ) : currentStatus === "Rejected" ? (
            <XCircle size={11} strokeWidth={2} />
          ) : (
            <Clock size={11} strokeWidth={2} />
          )}
          {currentStatus === "Pending" ? "Awaiting Decision" : currentStatus}
        </span>
      </div>

      {/* ── Card Body ── */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Rationale */}
        <p style={{ fontSize: "0.75rem", color: "#451a03", margin: 0, lineHeight: 1.45, overflowWrap: "anywhere" }}>
          {approvalReason}
        </p>

        {/* ── Proposal Data Summary Grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 8,
            padding: "8px 10px",
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid rgba(245,158,11,0.2)",
            fontSize: "0.6875rem",
            overflowWrap: "anywhere",
          }}
        >
          {/* Medicine & Facility */}
          {result?.inventory_data && (
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.625rem" }}>
                Target Medicine / Facility
              </span>
              <span style={{ fontWeight: 700, color: "#1e293b", display: "block" }}>
                {result.inventory_data.medicine || "Pharmaceutical Stock"}
              </span>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.625rem" }}>
                {result.inventory_data.facility || "Central Medical Store"}
              </span>
            </div>
          )}

          {/* Redistribution Details */}
          {result?.redistribution_proposal?.donor_facility && (
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.625rem" }}>
                Donor Facility Transfer
              </span>
              <span style={{ fontWeight: 700, color: "#0f766e", display: "block" }}>
                {result.redistribution_proposal.donor_facility} &rarr; {result.redistribution_proposal.quantity || 200} units
              </span>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.625rem" }}>
                Transit: ~{result.redistribution_proposal.estimated_transit_hours || 3.5}h ({result.redistribution_proposal.distance_km || 115} km)
              </span>
            </div>
          )}

          {/* Procurement Details */}
          {result?.procurement_proposal?.recommended_supplier && (
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.625rem" }}>
                Draft Purchase Order
              </span>
              <span style={{ fontWeight: 700, color: "#1e293b", display: "block" }}>
                {result.procurement_proposal.recommended_supplier}
              </span>
              <span style={{ color: "#059669", fontWeight: 700, display: "block", fontSize: "0.625rem" }}>
                PO #{result.procurement_proposal.draft_po_number || "PO-AUTO-01"} · Est: ${result.procurement_proposal.total_estimated_cost ? Number(result.procurement_proposal.total_estimated_cost).toLocaleString() : "7,250"}
              </span>
            </div>
          )}

          {/* Shortage Metrics */}
          {result?.shortage_analysis && (
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.625rem" }}>
                Cover / Deficit Impact
              </span>
              <span style={{ fontWeight: 700, color: "#b91c1c", display: "block" }}>
                {result.shortage_analysis.days_of_supply_remaining || 1.8} days supply remaining
              </span>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.625rem" }}>
                Burn: {result.shortage_analysis.daily_consumption_rate || 25} units/day
              </span>
            </div>
          )}
        </div>

        {/* ── Policy Checks Verified ── */}
        {result?.policy_validation?.rules_checked && result.policy_validation.rules_checked.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {result.policy_validation.rules_checked.map((rule: string, idx: number) => (
              <span
                key={idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.5625rem",
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "#f1f5f9",
                  color: "#334155",
                }}
              >
                <FileCheck size={9} color="#059669" />
                {rule}
              </span>
            ))}
          </div>
        )}

        {/* ── Decision Result or Action Controls ── */}
        {currentStatus === "Pending" ? (
          canAuthorize ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <input
                type="text"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Reviewer notes (e.g. Authorized under emergency replenishment protocol)..."
                disabled={isSubmitting}
                aria-label="Reviewer notes and comments"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: "0.75rem",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  outline: "none",
                }}
              />
              {/* Responsive wrapping action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("Approved")}
                  aria-label="Authorize and dispatch proposal"
                  style={{
                    flex: "1 1 140px",
                    minHeight: 38,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: "#059669",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: "background 0.15s ease",
                  }}
                >
                  <CheckCircle2 size={14} strokeWidth={2} />
                  Authorize & Dispatch
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("Rejected")}
                  aria-label="Reject proposal"
                  style={{
                    flex: "1 1 140px",
                    minHeight: 38,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: "background 0.15s ease",
                  }}
                >
                  <XCircle size={14} strokeWidth={2} />
                  Reject Proposal
                </button>
              </div>
              {submitError && (
                <div style={{ fontSize: "0.6875rem", color: "#dc2626", marginTop: 2 }}>
                  {submitError}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "8px 10px",
                background: "#fef3c7",
                borderRadius: 6,
                border: "1px solid #fde68a",
              }}
            >
              <Lock size={13} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: "0.6875rem", color: "#92400e" }}>
                <strong>Role Authorization Required:</strong> Only users with{" "}
                <strong>Facility Manager</strong> or <strong>Administrator</strong> credentials can
                approve or reject physical stock actions.
              </div>
            </div>
          )
        ) : (
          <div
            style={{
              padding: "8px 12px",
              background: currentStatus === "Approved" ? "#f0fdf4" : "#fef2f2",
              borderRadius: 6,
              border: `1px solid ${currentStatus === "Approved" ? "#bbf7d0" : "#fecaca"}`,
              fontSize: "0.6875rem",
              color: currentStatus === "Approved" ? "#166534" : "#991b1b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <span>
              <strong>Decision Recorded:</strong> {currentStatus} in authoritative state.
            </span>
            <span style={{ fontSize: "0.625rem", color: "#64748b" }}>
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
