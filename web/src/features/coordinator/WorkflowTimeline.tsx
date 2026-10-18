import React, { useState } from "react";
import type { WorkflowRun, WorkflowStep } from "@/types/workflow";
import {
  BrainCircuit,
  PackageSearch,
  TrendingUp,
  Truck,
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Wrench,
  CircleDashed,
  Layers,
  X,
  History,
  type LucideProps,
} from "lucide-react";
import "./coordinator.css";

interface WorkflowTimelineResultPayload {
  final_recommendation?: string;
  inventory_data?: Record<string, unknown>;
  shortage_analysis?: Record<string, unknown>;
  redistribution_proposal?: Record<string, unknown>;
  procurement_proposal?: Record<string, unknown>;
  policy_validation?: Record<string, unknown>;
  [key: string]: unknown;
}

const C = {
  brand:     "#0f766e",
  brandBg:   "#f0fdfa",
  brandDark: "#115e59",
  slate50:   "#f8fafc",
  slate100:  "#f1f5f9",
  slate200:  "#e2e8f0",
  slate300:  "#cbd5e1",
  slate400:  "#94a3b8",
  slate500:  "#64748b",
  slate600:  "#475569",
  slate700:  "#334155",
  slate800:  "#1e293b",
  slate900:  "#0f172a",
  white:     "#ffffff",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface WorkflowTimelineProps {
  /** Full list of workflows for the active session (chronological). */
  workflows?: WorkflowRun[];
  /** Single workflow (legacy / message-card usage). Ignored when workflows[] is provided. */
  workflow?: WorkflowRun | null;
  isRunning: boolean;
  elapsedSeconds: number;
  currentPhase?: string;
  defaultExpanded?: boolean;
  onClose?: () => void;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function WorkflowTimeline({
  workflows,
  workflow,
  isRunning,
  elapsedSeconds,
  currentPhase = "Ready",
  defaultExpanded = true,
  onClose,
}: WorkflowTimelineProps) {
  // Normalise: use workflows[] if provided, otherwise wrap single workflow
  const allWorkflows: WorkflowRun[] = workflows && workflows.length > 0
    ? workflows
    : workflow
    ? [workflow]
    : [];

  // Individual expand/collapse state per workflow card (keyed by workflow.id)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (defaultExpanded === false) return new Set<string>();
    // Default-expand the last/most-recent workflow
    const lastId = allWorkflows[allWorkflows.length - 1]?.id;
    return lastId ? new Set([lastId]) : new Set();
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Idle state
  if (allWorkflows.length === 0 && !isRunning) {
    return (
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.slate200}`,
          borderRadius: 8,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            background: C.slate100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <BrainCircuit size={16} strokeWidth={1.75} color={C.slate400} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: C.slate700, margin: "0 0 2px 0" }}>
            Workflow Activity · Idle
          </p>
          <p style={{ fontSize: "0.6875rem", color: C.slate400, margin: 0 }}>
            Awaiting operational prompt or scenario dispatch
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close timeline"
            title="Close timeline"
            style={{ background: "none", border: "none", color: C.slate400, cursor: "pointer", padding: 4 }}
          >
            <X size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Session history header */}
      {allWorkflows.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: C.slate50,
            border: `1px solid ${C.slate200}`,
            borderRadius: 6,
            fontSize: "0.6875rem",
            color: C.slate500,
            fontWeight: 600,
          }}
        >
          <History size={12} color={C.brand} />
          <span>Session Workflow History — {allWorkflows.length} execution{allWorkflows.length > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Render each workflow card */}
      {allWorkflows.map((wf, index) => (
        <WorkflowCard
          key={wf.id}
          workflow={wf}
          index={index}
          total={allWorkflows.length}
          isExpanded={expandedIds.has(wf.id)}
          onToggleExpand={() => toggleExpand(wf.id)}
          isRunning={isRunning && index === allWorkflows.length - 1}
          elapsedSeconds={elapsedSeconds}
          currentPhase={currentPhase}
          onClose={index === allWorkflows.length - 1 ? onClose : undefined}
        />
      ))}

      {/* In-progress placeholder when no workflow returned yet */}
      {isRunning && allWorkflows.length === 0 && (
        <WorkflowRunningPlaceholder currentPhase={currentPhase} elapsedSeconds={elapsedSeconds} />
      )}
    </div>
  );
}

// ── Workflow Card ────────────────────────────────────────────────────────────

interface WorkflowCardProps {
  workflow: WorkflowRun;
  index: number;
  total: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isRunning: boolean;
  elapsedSeconds: number;
  currentPhase: string;
  onClose?: () => void;
}

function WorkflowCard({
  workflow,
  index,
  total,
  isExpanded,
  onToggleExpand,
  isRunning,
  elapsedSeconds,
  currentPhase,
  onClose,
}: WorkflowCardProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [showFullObjective, setShowFullObjective] = useState(false);

  let parsedResult: WorkflowTimelineResultPayload | null = null;
  if (workflow.resultJson) {
    try {
      parsedResult = JSON.parse(workflow.resultJson);
    } catch {
      parsedResult = null;
    }
  }

  let totalDurationText = isRunning ? `${elapsedSeconds}s` : "";
  if (workflow.createdAt && workflow.completedAt) {
    const ms = Math.max(0, new Date(workflow.completedAt).getTime() - new Date(workflow.createdAt).getTime());
    totalDurationText = ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
  } else if (isRunning) {
    totalDurationText = `${elapsedSeconds}s`;
  }

  const steps: WorkflowStep[] = workflow.steps || [];
  const completedCount = steps.filter((s) => s.status === "Completed").length;
  const totalCount = steps.length || (isRunning ? "…" : 0);

  const statusLabel = isRunning
    ? "Processing"
    : workflow.status === "WaitingForApproval"
    ? "Awaiting Approval"
    : workflow.status === "Completed"
    ? "Completed"
    : workflow.status === "Failed"
    ? "Failed"
    : "Active";

  const statusBadge = isRunning
    ? { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", dot: "#0d9488" }
    : workflow.status === "WaitingForApproval"
    ? { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#d97706" }
    : workflow.status === "Completed"
    ? { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", dot: "#16a34a" }
    : workflow.status === "Failed"
    ? { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", dot: "#dc2626" }
    : { bg: C.slate100, text: C.slate600, border: C.slate200, dot: C.slate400 };

  const objectiveText = workflow.objective || (isRunning ? currentPhase : "Autonomous multi-agent execution");
  const isObjectiveLong = objectiveText.length > 80;

  const isLatest = index === total - 1;

  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${isLatest ? C.brand + "40" : C.slate200}`,
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: isLatest ? "0 1px 4px rgba(15,118,110,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Card Header */}
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.slate200}`, background: C.white }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                flexShrink: 0,
                background: isRunning ? C.brandBg : C.slate100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isRunning ? (
                <LoaderCircle size={15} strokeWidth={2} color={C.brand} className="coord-spin" />
              ) : (
                <BrainCircuit size={15} strokeWidth={1.75} color={C.slate500} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: C.slate900 }}>
                  {total > 1 ? `Workflow #${index + 1}` : "Workflow Activity"}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "1px 7px",
                    borderRadius: 999,
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    background: statusBadge.bg,
                    color: statusBadge.text,
                    border: `1px solid ${statusBadge.border}`,
                  }}
                >
                  <span
                    className={isRunning ? "coord-pulse" : ""}
                    style={{ width: 5, height: 5, borderRadius: "50%", background: statusBadge.dot, display: "inline-block" }}
                  />
                  {statusLabel}
                </span>
                {isLatest && total > 1 && (
                  <span
                    style={{
                      fontSize: "0.5625rem",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 999,
                      background: C.brandBg,
                      color: C.brand,
                      border: `1px solid ${C.brand}30`,
                    }}
                  >
                    Latest
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Steps & Duration Badge */}
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 600,
                color: C.slate600,
                background: C.slate100,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {completedCount}/{totalCount} Steps
            </span>
            {totalDurationText && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  color: C.slate600,
                  background: C.slate100,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                <Clock3 size={10} />
                {totalDurationText}
              </span>
            )}

            {/* Expand / Collapse */}
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse workflow" : "Expand workflow"}
              title={isExpanded ? "Collapse" : "Expand"}
              style={{
                background: "none",
                border: "none",
                color: C.slate500,
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close timeline"
                title="Close timeline"
                style={{
                  background: "none",
                  border: "none",
                  color: C.slate400,
                  cursor: "pointer",
                  padding: 4,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Truncated objective summary */}
        <div style={{ marginTop: 6, fontSize: "0.6875rem", color: C.slate500, lineHeight: 1.4 }}>
          <span>
            {showFullObjective || !isObjectiveLong ? objectiveText : `${objectiveText.substring(0, 80)}…`}
          </span>
          {isObjectiveLong && (
            <button
              type="button"
              onClick={() => setShowFullObjective(!showFullObjective)}
              style={{
                background: "none",
                border: "none",
                color: C.brand,
                cursor: "pointer",
                padding: "0 4px",
                fontSize: "0.6875rem",
                fontWeight: 600,
              }}
            >
              {showFullObjective ? "Less" : "More"}
            </button>
          )}
        </div>

        {/* Stage breadcrumb */}
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.slate100}`, overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.625rem", whiteSpace: "nowrap" }}>
            {[
              { label: "Analyze Request",   active: true },
              { label: "Audit Stock",       active: steps.length > 0 },
              { label: "Forecast Demand",   active: steps.length > 1 },
              { label: "Route / Procure",   active: steps.length > 2 },
              { label: "Policy Governance", active: !!workflow.requiresApproval },
            ].map((stage, idx, arr) => (
              <React.Fragment key={stage.label}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontWeight: stage.active ? 700 : 500,
                    color: stage.active ? C.brandDark : C.slate400,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      display: "inline-block",
                      background: stage.active ? "#0d9488" : C.slate300,
                    }}
                  />
                  {stage.label}
                </span>
                {idx < arr.length - 1 && <span style={{ color: C.slate300, userSelect: "none" }}>›</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Expandable Steps Section */}
      {isExpanded && (
        <div style={{ background: C.slate50, padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: C.slate500,
              }}
            >
              <Layers size={11} strokeWidth={1.75} color={C.brand} />
              Chronological Orchestration Sequence
            </span>

            {steps.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowAllDetails(!showAllDetails);
                  setExpandedStepId(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: C.brand,
                  cursor: "pointer",
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  padding: "2px 4px",
                }}
              >
                {showAllDetails ? "Collapse all" : "Show all details"}
              </button>
            )}
          </div>

          {/* Stepper list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {steps.map((step, idx) => {
              const { Icon: AgentIcon, badge } = getAgentMeta(step.agentName);
              const duration = calcDuration(step.startedAt, step.completedAt);
              const stepKey = step.id || `idx-${idx}`;
              const isStepOpen = showAllDetails || expandedStepId === stepKey;
              const isCompleted = step.status === "Completed";
              const isFailed = step.status === "Failed";

              return (
                <div
                  key={stepKey}
                  style={{
                    background: C.white,
                    border: `1px solid ${isStepOpen ? C.brand : C.slate200}`,
                    borderRadius: 6,
                    overflow: "hidden",
                    transition: "border-color 150ms",
                  }}
                >
                  <div
                    onClick={() => {
                      if (showAllDetails) {
                        setShowAllDetails(false);
                        setExpandedStepId(null);
                      } else {
                        setExpandedStepId(isStepOpen ? null : stepKey);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isStepOpen}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedStepId(isStepOpen ? null : stepKey);
                      }
                    }}
                    style={{
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      gap: 8,
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                        {isCompleted ? (
                          <CheckCircle2 size={13} strokeWidth={2.5} color="#16a34a" />
                        ) : isFailed ? (
                          <AlertTriangle size={13} strokeWidth={2.5} color="#dc2626" />
                        ) : (
                          <CircleDashed size={13} strokeWidth={2} color="#94a3b8" />
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 0,
                          flexWrap: "wrap",
                          lineHeight: 1.3,
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: C.slate800 }}>
                          {step.action}
                        </span>
                        <span style={{ color: C.slate300, fontSize: "0.625rem" }}>·</span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "1px 5px",
                            borderRadius: 4,
                            fontSize: "0.5625rem",
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.text,
                          }}
                        >
                          <AgentIcon size={9} strokeWidth={2} />
                          {step.agentName || "Specialist Agent"}
                        </span>
                        {duration && (
                          <>
                            <span style={{ color: C.slate300, fontSize: "0.625rem" }}>·</span>
                            <span
                              style={{
                                fontSize: "0.625rem",
                                fontFamily: "monospace",
                                fontWeight: 600,
                                color: C.slate600,
                              }}
                            >
                              {duration}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: "0.5625rem",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 999,
                          background: isCompleted ? "#f0fdf4" : isFailed ? "#fef2f2" : C.slate100,
                          color: isCompleted ? "#166534" : isFailed ? "#991b1b" : C.slate600,
                        }}
                      >
                        {step.status}
                      </span>
                      {isStepOpen ? (
                        <ChevronUp size={12} color={C.slate500} />
                      ) : (
                        <ChevronDown size={12} color={C.slate500} />
                      )}
                    </div>
                  </div>

                  {/* Expandable Step Details */}
                  {isStepOpen && (
                    <div
                      style={{
                        padding: "8px 10px 10px 10px",
                        borderTop: `1px solid ${C.slate100}`,
                        background: "#fafafa",
                        fontSize: "0.6875rem",
                      }}
                    >
                      {step.outputSummary && step.outputSummary !== step.action && (
                        <p style={{ margin: "0 0 6px 0", color: C.slate600, lineHeight: 1.45 }}>
                          {step.outputSummary}
                        </p>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.slate500, fontSize: "0.625rem" }}>
                          <Wrench size={10} />
                          <span>Tool:</span>
                          <code
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.5625rem",
                              padding: "1px 4px",
                              borderRadius: 3,
                              background: C.slate100,
                              color: C.slate700,
                            }}
                          >
                            {getInferredTool(step.action, step.agentName)}
                          </code>
                        </div>
                        {step.completedAt && (
                          <span style={{ fontSize: "0.5625rem", color: C.slate400, fontFamily: "monospace" }}>
                            Completed: {new Date(step.completedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>

                      {/* Telemetry json inspector */}
                      <div
                        style={{
                          background: C.slate900,
                          borderRadius: 4,
                          padding: "6px 8px",
                          border: "1px solid #1e293b",
                        }}
                      >
                        <pre
                          style={{
                            fontSize: "0.5625rem",
                            fontFamily: "monospace",
                            color: "#34d399",
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            maxHeight: 140,
                            overflowY: "auto",
                          }}
                        >
                          {JSON.stringify(getStepPayload(step, parsedResult), null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* In-progress step indicator */}
            {isRunning && (
              <div
                style={{
                  background: C.brandBg,
                  border: `1px solid rgba(13,148,136,0.3)`,
                  borderRadius: 6,
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <LoaderCircle size={13} strokeWidth={2.5} color={C.brand} className="coord-spin" />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.brandDark }} className="coord-pulse">
                  {currentPhase}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Running Placeholder (no workflow yet returned) ───────────────────────────

function WorkflowRunningPlaceholder({
  currentPhase,
  elapsedSeconds,
}: {
  currentPhase: string;
  elapsedSeconds: number;
}) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.brand}40`,
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <LoaderCircle size={18} strokeWidth={2} color={C.brand} className="coord-spin" />
      <div>
        <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: C.brandDark, margin: "0 0 2px 0" }} className="coord-pulse">
          {currentPhase}
        </p>
        <p style={{ fontSize: "0.6875rem", color: C.slate400, margin: 0, fontFamily: "monospace" }}>
          {elapsedSeconds}s elapsed
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAgentMeta(name: string): { Icon: React.ComponentType<LucideProps>; badge: { bg: string; text: string } } {
  const lower = (name || "").toLowerCase();
  if (lower.includes("inventory")) return { Icon: PackageSearch, badge: { bg: "#dcfce7", text: "#166534" } };
  if (lower.includes("demand") || lower.includes("forecast")) return { Icon: TrendingUp, badge: { bg: "#dbeafe", text: "#1d4ed8" } };
  if (lower.includes("redistrib") || lower.includes("transfer")) return { Icon: Truck, badge: { bg: "#fef3c7", text: "#92400e" } };
  if (lower.includes("procure") || lower.includes("supplier")) return { Icon: ShoppingCart, badge: { bg: "#f3e8ff", text: "#7c3aed" } };
  if (lower.includes("policy") || lower.includes("safety")) return { Icon: ShieldCheck, badge: { bg: "#fee2e2", text: "#991b1b" } };
  return { Icon: BrainCircuit, badge: { bg: "#f0fdfa", text: "#115e59" } };
}

function calcDuration(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt || !completedAt) return null;
  const diff = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
  return diff >= 1000 ? `${(diff / 1000).toFixed(2)}s` : `${diff}ms`;
}

function getInferredTool(action: string, agent: string): string {
  const s = (action + " " + agent).toLowerCase();
  if (s.includes("inventory") || s.includes("stock")) return "db_query_batch_stock";
  if (s.includes("demand") || s.includes("burn")) return "calc_burn_rate_deficit";
  if (s.includes("redistrib") || s.includes("transit")) return "geo_route_candidates";
  if (s.includes("procure") || s.includes("supplier")) return "score_verified_suppliers";
  if (s.includes("policy") || s.includes("approval")) return "eval_governance_rules";
  return "coordinator_orchestration";
}

function getStepPayload(step: WorkflowStep, parsed: WorkflowTimelineResultPayload | null) {
  const s = (step.action + " " + step.agentName).toLowerCase();
  if (s.includes("inventory") && parsed?.inventory_data) return parsed.inventory_data;
  if (s.includes("demand") && parsed?.shortage_analysis) return parsed.shortage_analysis;
  if ((s.includes("redistrib") || s.includes("transfer")) && parsed?.redistribution_proposal) return parsed.redistribution_proposal;
  if (s.includes("procure") && parsed?.procurement_proposal) return parsed.procurement_proposal;
  if (s.includes("policy") && parsed?.policy_validation) return parsed.policy_validation;
  return {
    step_key: step.stepKey,
    agent: step.agentName,
    action: step.action,
    status: step.status,
    result: step.outputSummary || "Executed",
  };
}
