import React, { useState } from "react";
import type { WorkflowRun } from "@/types/workflow";
import { useAuth } from "@/features/auth/AuthContext";
import { UserCheck, Check, X, Lock } from "lucide-react";

interface GovernanceApprovalCardProps {
  workflow: WorkflowRun;
  onSubmitApproval: (decision: "Approved" | "Rejected", comments?: string) => Promise<void>;
}

export function GovernanceApprovalCard({
  workflow,
  onSubmitApproval,
}: GovernanceApprovalCardProps) {
  const { hasRole } = useAuth();
  const [approvalNote, setApprovalNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if current user has authorization permission
  const canApprove =
    hasRole("FacilityManager") ||
    hasRole("FACILITY_MANAGER") ||
    hasRole("Administrator") ||
    hasRole("ADMIN");

  const pendingApproval = workflow.approvals.find((a) => a.decision === "Pending");
  const isAwaitingApproval = workflow.status === "WaitingForApproval" || !!pendingApproval;

  if (!isAwaitingApproval && workflow.status !== "Completed" && workflow.status !== "Rejected") {
    return null;
  }

  // Parse resultJson if available
  let parsedResult: Record<string, any> | null = null;
  if (workflow.resultJson) {
    try {
      parsedResult = JSON.parse(workflow.resultJson);
    } catch {
      parsedResult = null;
    }
  }

  const approvalReason =
    parsedResult?.approval_reason ||
    "Mandatory governance checkpoint required prior to executing inter-facility stock movements or supplier PO dispatch.";

  const approvalTier = parsedResult?.approval_type || pendingApproval?.approvalType || "ManagerApproval";

  async function handleDecision(decision: "Approved" | "Rejected") {
    setIsSubmitting(true);
    try {
      await onSubmitApproval(decision, approvalNote);
      setApprovalNote("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-amber-200/80">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-800">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-950">
                Human-in-the-Loop Governance Checkpoint
              </h3>
              <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Tier: {approvalTier}
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-0.5">{approvalReason}</p>
          </div>
        </div>

        <span
          className={`self-start sm:self-auto rounded-full px-2.5 py-1 text-xs font-bold ${
            workflow.status === "WaitingForApproval"
              ? "bg-amber-200 text-amber-900 animate-pulse"
              : workflow.status === "Completed"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {workflow.status}
        </span>
      </div>

      {isAwaitingApproval ? (
        <div className="mt-4 pt-1 space-y-3">
          {canApprove ? (
            <>
              <label className="block text-xs font-semibold text-slate-700">
                Reviewer Evaluation & Approval Comments (Optional)
              </label>
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="e.g. Authorized stock reallocation under clinical emergency protocol..."
                disabled={isSubmitting}
                className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
              />

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("Approved")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Authorize & Dispatch</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDecision("Rejected")}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Reject Proposal</span>
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-amber-300/70 bg-white/80 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
              <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Role Authorization Required:</span>
                <p className="mt-0.5 text-slate-600">
                  You are currently logged in with operational observation rights. Only users with the{" "}
                  <strong>Facility Manager</strong> or <strong>Administrator</strong> role can
                  authorize or reject this governance action.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-600">
          Governance decision recorded. The authoritative state has been persisted.
        </div>
      )}
    </div>
  );
}
