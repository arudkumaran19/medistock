import React, { useState } from "react";
import type { WorkflowRun, WorkflowStep } from "@/types/workflow";
import {
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  PackageSearch,
  TrendingUp,
  Truck,
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileCode,
  Layers,
} from "lucide-react";

interface ExecutionDetailsProps {
  workflow?: WorkflowRun | null;
  compact?: boolean;
}

function getAgentInfo(name: string, action?: string) {
  const lower = `${name} ${action || ""}`.toLowerCase();
  if (lower.includes("inventory")) {
    return {
      icon: <PackageSearch size={13} color="#059669" />,
      title: "Inventory Audit",
      shortSummary: "Inventory checked",
      defaultDesc: "Verified stock levels, batch availability, and expiry safety",
    };
  }
  if (lower.includes("demand")) {
    return {
      icon: <TrendingUp size={13} color="#2563eb" />,
      title: "Demand Forecast",
      shortSummary: "Demand forecast calculated",
      defaultDesc: "Estimated consumption velocity, burn rate, and projected days of cover",
    };
  }
  if (lower.includes("redistrib")) {
    return {
      icon: <Truck size={13} color="#d97706" />,
      title: "Regional Redistribution",
      shortSummary: "Redistribution analyzed",
      defaultDesc: "Evaluated regional donor hospitals and logistics transfer routes",
    };
  }
  if (lower.includes("procure")) {
    return {
      icon: <ShoppingCart size={13} color="#7c3aed" />,
      title: "Procurement Staging",
      shortSummary: "Suppliers evaluated",
      defaultDesc: "Evaluated supplier contracts, reliability scoring, and drafted purchase order",
    };
  }
  if (lower.includes("policy") || lower.includes("safety") || lower.includes("gate")) {
    return {
      icon: <ShieldCheck size={13} color="#dc2626" />,
      title: "Safety & Policy Gate",
      shortSummary: "Governance verified",
      defaultDesc: "Validated clinical protocols, budget constraints, and authorization thresholds",
    };
  }
  return {
    icon: <BrainCircuit size={13} color="#0d9488" />,
    title: name || "Agent Step",
    shortSummary: action || "Step completed",
    defaultDesc: action || "Orchestration task executed",
  };
}

function calculateStepDuration(step: WorkflowStep): string | null {
  if (!step.startedAt || !step.completedAt) return null;
  const start = new Date(step.startedAt).getTime();
  const end = new Date(step.completedAt).getTime();
  const diff = end - start;
  if (diff < 0) return null;
  if (diff < 1000) return `${diff}ms`;
  return `${(diff / 1000).toFixed(1)}s`;
}

export function ExecutionDetails({ workflow, compact = false }: ExecutionDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  if (!workflow) return null;

  const steps = workflow.steps || [];
  const stepCount = steps.length;
  if (stepCount === 0) return null;

  // Calculate total duration if available
  let totalDuration = "";
  if (workflow.createdAt && (workflow.completedAt || workflow.updatedAt)) {
    const s = new Date(workflow.createdAt).getTime();
    const e = new Date(workflow.completedAt || workflow.updatedAt).getTime();
    const diff = e - s;
    if (diff > 0) {
      totalDuration = diff < 1000 ? `${diff}ms` : `${(diff / 1000).toFixed(1)}s`;
    }
  }

  // Generate 1-2 line summary elements
  const keySummaries: string[] = [];
  steps.forEach((st) => {
    const info = getAgentInfo(st.agentName || "", st.action);
    if (!keySummaries.includes(info.shortSummary)) {
      keySummaries.push(info.shortSummary);
    }
  });

  const statusLabel =
    workflow.status === "WaitingForApproval"
      ? "Approval required"
      : workflow.status === "Completed"
      ? "Workflow completed"
      : workflow.status;

  const summaryLine = [
    statusLabel,
    `${stepCount} step${stepCount === 1 ? "" : "s"}`,
    totalDuration || null,
    ...keySummaries.slice(0, 3),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ marginTop: 8 }}>
      {/* ── Concise 1-2 line summary pill / toggle bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: compact ? "4px 8px" : "5px 10px",
          borderRadius: 6,
          background: isExpanded ? "#f1f5f9" : "#f8fafc",
          border: "1px solid #e2e8f0",
          fontSize: "0.6875rem",
          color: "#475569",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <Layers size={12} color="#0f766e" style={{ flexShrink: 0 }} />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontWeight: 500,
              color: "#334155",
            }}
            title={summaryLine}
          >
            {summaryLine}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            background: "none",
            border: "none",
            color: "#0f766e",
            fontSize: "0.625rem",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            padding: "2px 4px",
            borderRadius: 4,
          }}
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? "Hide activity" : "Show activity"}</span>
          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* ── Expanded Activity Drawer ── */}
      {isExpanded && (
        <div
          style={{
            marginTop: 6,
            padding: compact ? "8px 10px" : "10px 12px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#64748b",
              }}
            >
              Multi-Agent Orchestration Sequence
            </span>
            <button
              type="button"
              onClick={() => setShowRawJson((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "#0f766e",
                fontSize: "0.625rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <FileCode size={11} />
              {showRawJson ? "Hide JSON" : "Raw JSON"}
            </button>
          </div>

          {/* Clean human-readable steps list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {steps.map((st, idx) => {
              const dur = calculateStepDuration(st);
              const info = getAgentInfo(st.agentName || "", st.action);
              return (
                <div
                  key={st.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "6px 8px",
                    background: "#ffffff",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {info.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#1e293b" }}>
                        {info.title}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {dur && (
                          <span style={{ fontSize: "0.625rem", color: "#64748b", fontFamily: "monospace" }}>
                            {dur}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.5625rem",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: st.status === "Completed" ? "#dcfce7" : "#f1f5f9",
                            color: st.status === "Completed" ? "#166534" : "#475569",
                          }}
                        >
                          {st.status}
                        </span>
                      </div>
                    </div>

                    <p style={{ margin: "2px 0 0 0", fontSize: "0.6875rem", color: "#334155" }}>
                      {st.outputSummary || info.defaultDesc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Raw JSON Diagnostic (Suppressed by default) */}
          {showRawJson && workflow.resultJson && (
            <div style={{ marginTop: 10 }}>
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  background: "#0f172a",
                  color: "#f8fafc",
                  borderRadius: 6,
                  fontSize: "0.625rem",
                  fontFamily: "monospace",
                  overflowX: "auto",
                  maxHeight: 200,
                }}
              >
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(workflow.resultJson), null, 2);
                  } catch {
                    return workflow.resultJson;
                  }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
