import React, { type FormEvent } from "react";
import {
  Brain,
  Database,
  Cpu,
  Loader2,
  Send,
  Bot,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { useProcurementAgent } from "../context/ProcurementAgentContext";
import styles from "./ProcurementAgentPanel.module.css";

interface ProcurementAgentPanelProps {
  onOrderCreated?: () => void;
  contextPurchaseOrderId?: string;
}

export function ProcurementAgentPanel({ onOrderCreated }: ProcurementAgentPanelProps) {
  const {
    result,
    isLoading,
    error,
    prompt,
    lastPrompt,
    setPrompt,
    runAction,
    clearResult,
    getPhase,
  } = useProcurementAgent();

  const phase = getPhase();

  const samplePrompts = [
    "We need to replenish paracetamol because stock is running low.",
    "Which pending procurement requests require administrative approval?",
    "Check whether this procurement request complies with our storage and high-value policies.",
    "Find suitable suppliers for amoxicillin antibiotic procurement.",
  ];

  function handlePromptSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    void runAction("ask", { question: prompt.trim() }, false, onOrderCreated);
  }

  function handleSelectPrompt(selected: string) {
    setPrompt(selected);
    void runAction("ask", { question: selected }, false, onOrderCreated);
  }

  function handleApproveMutation() {
    if (!lastPrompt) return;
    void runAction("ask", { question: lastPrompt }, true, onOrderCreated);
  }

  function renderPhaseIcon() {
    switch (phase.stage) {
      case "analyzing":
        return <Brain size={16} />;
      case "tools":
        return <Database size={16} />;
      case "reasoning":
        return <Cpu size={16} />;
      case "finalizing":
      default:
        return <Loader2 size={16} className={styles.spin} />;
    }
  }

  function renderInsightIcon(kind: string, severity: string) {
    if (severity === "critical") {
      return <ShieldAlert size={15} style={{ flexShrink: 0, color: "#991b1b" }} />;
    }
    if (severity === "warning") {
      return <AlertTriangle size={15} style={{ flexShrink: 0, color: "#92400e" }} />;
    }
    if (kind.toLowerCase().includes("recommendation")) {
      return <Sparkles size={15} style={{ flexShrink: 0, color: "#166534" }} />;
    }
    return <Info size={15} style={{ flexShrink: 0, color: "#166534" }} />;
  }

  return (
    <section className={styles.panel} aria-label="Procurement AI Assistant">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Agentic AI Assistant</p>
          <h2 className={styles.title}>Procurement & Policy Validation Agent</h2>
          <p className={styles.description}>
            Interactive LangGraph agent with real-time tool execution, policy validation checks, and human approval gating.
          </p>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void runAction("analyze", {}, false, onOrderCreated)}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className={styles.spin} style={{ marginRight: 6 }} />
              Reviewing…
            </>
          ) : (
            <>
              <Bot size={15} style={{ marginRight: 6 }} />
              Run Procurement Review
            </>
          )}
        </button>
      </div>

      <form className={styles.form} onSubmit={handlePromptSubmit}>
        <input
          type="text"
          className={styles.input}
          placeholder="Ask procurement questions or request replenishment (e.g. Replenish Paracetamol)..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" className={styles.button} disabled={isLoading || !prompt.trim()}>
          {isLoading ? (
            <>
              <Loader2 size={14} className={styles.spin} style={{ marginRight: 6 }} />
              Processing…
            </>
          ) : (
            <>
              <Send size={14} style={{ marginRight: 6 }} />
              Ask Agent
            </>
          )}
        </button>
      </form>

      <div className={styles.quickPrompts}>
        {samplePrompts.map((p) => (
          <button
            key={p}
            type="button"
            className={styles.promptChip}
            onClick={() => handleSelectPrompt(p)}
            disabled={isLoading}
          >
            {p}
          </button>
        ))}
      </div>

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      {isLoading && (
        <div className={styles.progressBanner} role="status" aria-live="polite">
          <span className={styles.progressIconWrapper}>
            {renderPhaseIcon()}
          </span>
          <span>{phase.label}</span>
        </div>
      )}

      {result && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f766e" }}>
              Latest Agent Analysis
            </span>
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearResult}
              title="Clear current agent result"
            >
              <RotateCcw size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Clear
            </button>
          </div>

          {result.answer && (
            <div className={styles.answerBox}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Bot size={16} color="#0f766e" />
                <strong>Agent Decision & Recommendation:</strong>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>{result.answer}</p>
            </div>
          )}

          {result.plan && result.plan.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#475569", margin: "0 0 6px 0" }}>
                Execution Plan:
              </p>
              <ul className={styles.planList}>
                {result.plan.map((step, idx) => (
                  <li key={idx} className={styles.planItem}>
                    <CheckCircle2 size={14} style={{ color: "#0d9488", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>Step {idx + 1}:</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.insights && result.insights.length > 0 && (
            <div className={styles.insightsGrid}>
              {result.insights.map((insight, idx) => {
                const cardClass =
                  insight.severity === "critical"
                    ? styles.insightCritical
                    : insight.severity === "warning"
                    ? styles.insightWarning
                    : styles.insightInfo;
                return (
                  <div key={idx} className={`${styles.insightCard} ${cardClass}`}>
                    <div className={styles.insightHeader}>
                      {renderInsightIcon(insight.kind, insight.severity)}
                      <span>[{insight.kind.toUpperCase()}]</span>
                    </div>
                    <div>{insight.message}</div>
                  </div>
                );
              })}
            </div>
          )}

          {result.validation_errors && result.validation_errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#991b1b" }}>
                <AlertTriangle size={16} />
                <strong style={{ fontSize: "0.875rem" }}>Validation Warnings / Flags:</strong>
              </div>
              <ul style={{ color: "#991b1b", fontSize: "0.8125rem", margin: "4px 0 0 16px" }}>
                {result.validation_errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {result.approval_required && (
            <div className={styles.approvalBanner}>
              <div className={styles.approvalBannerContent}>
                <ShieldAlert size={20} color="#b45309" style={{ flexShrink: 0 }} />
                <span className={styles.approvalBannerText}>
                  This operation requires explicit human managerial authorization. Would you like to proceed?
                </span>
              </div>
              <button
                type="button"
                className={styles.button}
                style={{ backgroundColor: "#b45309" }}
                onClick={handleApproveMutation}
                disabled={isLoading}
              >
                Approve & Execute via Backend
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
