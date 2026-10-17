import React, { useState, useRef, useEffect } from "react";
import { useCoordinator } from "./CoordinatorContext";
import { MarkdownMessage } from "./MarkdownMessage";
import { InChatApprovalCard } from "./InChatApprovalCard";
import { ExecutionDetails } from "./ExecutionDetails";
import { AdaptiveResponseRenderer } from "./intelligent-ui";
import { useAuth } from "@/features/auth/AuthContext";
import "./coordinator.css";
import {
  BrainCircuit,
  Send,
  LoaderCircle,
  StopCircle,
  User,
  ShieldCheck,
  PackageSearch,
  Truck,
  TrendingUp,
  Clock,
  Pencil,
  Check,
  History,
  Zap,
} from "lucide-react";

const C = {
  brand:     "var(--color-primary-700)",
  brandBg:   "var(--color-primary-50)",
  brandDark: "var(--color-primary-800)",
  slate50:   "var(--color-slate-50)",
  slate100:  "var(--color-slate-100)",
  slate200:  "var(--color-slate-200)",
  slate300:  "var(--color-slate-300)",
  slate400:  "var(--color-slate-400)",
  slate500:  "var(--color-slate-500)",
  slate600:  "var(--color-slate-600)",
  slate700:  "var(--color-slate-700)",
  slate800:  "var(--color-slate-800)",
  slate900:  "var(--color-slate-900)",
  white:     "#ffffff",
};

interface AgentChatProps {
  compact?: boolean;
  hideHeader?: boolean;
  onOpenTimeline?: () => void;
}

const DEFAULT_PROMPTS = [
  {
    title: "Analyze Stock Shortages",
    desc: "Audit hospital inventory and calculate days of cover for Paracetamol 500mg.",
    prompt: "Critical shortage of Paracetamol 500mg at Colombo General Hospital. Audit local inventory, check regional donor hospitals, and prepare an immediate emergency transfer proposal.",
    icon: PackageSearch,
    color: "#059669",
  },
  {
    title: "Forecast Demand & Draft PO",
    desc: "Forecast 60-day consumption velocity and draft autonomous purchase order with SPMC.",
    prompt: "Forecast 60-day consumption burn rate for Amoxicillin 500mg, identify supplier stockout risk, score verified suppliers, and draft an autonomous purchase order with SPMC under policy compliance.",
    icon: TrendingUp,
    color: "#2563eb",
  },
  {
    title: "Regional Donor Redistribution",
    desc: "Identify nearby surplus facilities within 50km and route emergency transfer.",
    prompt: "Assess Insulin Regular 100IU stock across regional clinics, find donor facilities within 50km, and route cold-chain emergency transfer.",
    icon: Truck,
    color: "#d97706",
  },
  {
    title: "Near-Expiry Waste Prevention",
    desc: "Identify medicine batches expiring within 90 days and route to high-burn wards.",
    prompt: "Identify batches of Metformin 500mg expiring within 90 days. Calculate current facility consumption vs shelf life, and prepare redistribution transfers to prevent stock expiry waste.",
    icon: Clock,
    color: "#7c3aed",
  },
];

export function AgentChat({ compact = false, hideHeader = false, onOpenTimeline }: AgentChatProps) {
  const {
    messages,
    isRunning,
    currentPhase,
    elapsedSeconds,
    activeWorkflow,
    sendMessage,
    submitApproval,
    editUserMessage,
    editAssistantMessage,
    cancelExecution,
  } = useCoordinator();

  const { user } = useAuth();
  const [inputText, setInputText] = useState("");
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});
  const [selectedStrategies, setSelectedStrategies] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, isRunning]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /** Detect if the user's text is a strategy-selection phrase for a given keyword */
  function isStrategyPhrase(text: string, keyword: string): boolean {
    const t = text.toLowerCase().trim();
    const k = keyword.toLowerCase();

    // Explicitly reject analysis, forecast, audit, and long queries
    const isAnalysis =
      t.length > 50 ||
      t.includes("forecast") ||
      t.includes("burn rate") ||
      t.includes("consumption") ||
      t.includes("shortage") ||
      t.includes("audit") ||
      t.includes("stockout") ||
      t.includes("deficit") ||
      t.includes("assess") ||
      t.includes("score verified suppliers") ||
      t.includes("identify supplier") ||
      t.includes("check stock") ||
      t.includes("check inventory");
    if (isAnalysis) return false;

    if (t === k) return true;
    if (t.startsWith(`apply strategy: ${k}`) || t.startsWith(`select strategy: ${k}`)) return true;

    if (k === "procurement" && (t === "procurement" || t === "procure" || t === "purchase" || t === "buy" || t === "1" || t === "option 1")) return true;
    if (k === "redistribution" && (t === "redistribution" || t === "redistribute" || t === "transfer" || t === "2" || t === "option 2")) return true;
    if (k === "both" && (t === "both" || t === "dual" || t === "hybrid" || t === "combined" || t === "3" || t === "option 3")) return true;
    if (k === "neither" && (t === "neither" || t === "none" || t === "cancel" || t === "stop" || t === "do nothing" || t === "4" || t === "option 4")) return true;

    const prefixes = [
      `choose`, `chose`, `i choose`, `i chose`, `i'd like`,
      `i want`, `i'll take`, `go with`, `use`, `select`,
      `let's use`, `let's go with`, `do`, `proceed with`,
      `i prefer`, `prefer`, `pick`, `option`, `take`, `try`,
      `apply`, `execute`, `run`,
    ];
    return prefixes.some((p) => t.startsWith(`${p} ${k}`) || t === `${p} ${k}`.trim());
  }

  /** Simple factual stock query → InventoryAudit (no strategy buttons, no approval) */
  function isSimpleStockQuery(text: string): boolean {
    const lower = text.toLowerCase();
    const SIMPLE_STOCK_PHRASES = [
      "what is the stock", "what's the stock", "what is the current stock",
      "what's the current stock", "how much stock", "current stock of",
      "stock level of", "stock levels of", "how many units", "how many tablets",
      "how many capsules", "do we have of", "do we currently have",
      "quantity of", "quantity on hand", "on-hand stock", "on hand stock",
      "available stock of", "how much is left", "how much do we have",
      "stock status of", "stock for",
    ];
    return (
      SIMPLE_STOCK_PHRASES.some((p) => lower.includes(p)) &&
      !lower.includes("shortage") && !lower.includes("stockout") &&
      !lower.includes("critical") && !lower.includes("deficit") &&
      !lower.includes("order") && !lower.includes("procur") &&
      !lower.includes("transfer") && !lower.includes("redist")
    );
  }

  /** Multi-medicine catalogue query → CatalogueQuery */
  function isCatalogueQuery(text: string): boolean {
    const lower = text.toLowerCase();
    const CATALOGUE_PHRASES = [
      "what medicines are", "list all medicines", "list medicines",
      "all medicines", "all drugs", "medicines available",
      "medicines and their stock", "medicines and stock",
      "what drugs are available", "full stock list", "complete inventory",
      "all inventory", "show all medicines", "show medicines",
      "avaliable", "total stocks", "total stock", "across facilities",
      "stock vs minimum threshold", "stock vs threshold", "catalogue", "catalog",
    ];
    return (
      CATALOGUE_PHRASES.some((p) => lower.includes(p)) ||
      (lower.includes("medicines") && (lower.includes("stock") || lower.includes("available") || lower.includes("avaliable")))
    );
  }

  /** Pure demand/forecast query → DemandForecast (no strategy buttons) */
  function isDemandForecastQuery(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      (lower.includes("forecast") || lower.includes("consumption rate") ||
       lower.includes("days of supply") || lower.includes("burn rate") ||
       lower.includes("how long will") || lower.includes("will last")) &&
      !lower.includes("shortage") && !lower.includes("stockout") &&
      !lower.includes("critical") && !lower.includes("deficit") &&
      !lower.includes("order") && !lower.includes("procur") &&
      !lower.includes("redist")
    );
  }

  /**
   * Resolve the correct workflowType for typed/clicked text.
   * Strategy selections take priority; factual queries route to specific intent types
   * to avoid triggering the full shortage-resolution pipeline.
   */
  function resolveWorkflowType(text: string): string {
    const t = text.toLowerCase().trim();
    // 1. Explicit strategy selections (highest priority)
    if (isStrategyPhrase(t, "both")) return "CombinedResolution";
    if (isStrategyPhrase(t, "procurement")) return "AutonomousProcurement";
    if (isStrategyPhrase(t, "redistribution")) return "StockRedistribution";
    if (isStrategyPhrase(t, "neither")) return "Neither";
    // 2b. Batch expiry scan across facilities
    if (t.includes("expir") || t.includes("expire") || (t.includes("batch") && (t.includes("day") || t.includes("across") || t.includes("soon") || t.includes("within")))) return "ExpiryAudit";
    // 3. Simple single-item factual stock query
    if (isSimpleStockQuery(text)) return "InventoryAudit";
    // 4. Pure demand/forecast query
    if (isDemandForecastQuery(text)) return "DemandForecast";
    // 5. Everything else → pass empty string so backend and LLM classify dynamically
    return "";
  }

  function handleSend() {
    const text = inputText.trim();
    if (!text || isRunning) return;
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    void sendMessage(text, resolveWorkflowType(text));
  }

  function handlePromptClick(promptText: string) {
    if (isRunning) return;
    void sendMessage(promptText, resolveWorkflowType(promptText));
  }

  function startEditing(msg: (typeof messages)[0]) {
    setEditingMsgId(msg.id);
    setEditText(msg.text);
    setTimeout(() => {
      editTextareaRef.current?.focus();
    }, 50);
  }

  function cancelEditing() {
    setEditingMsgId(null);
    setEditText("");
  }

  async function handleSaveUserEdit(msgId: string, resubmit: boolean) {
    const textToSave = editText.trim();
    if (!textToSave) return;
    setEditingMsgId(null);
    setEditText("");
    await editUserMessage(msgId, textToSave, resubmit);
  }

  function handleSaveAssistantEdit(msgId: string) {
    const textToSave = editText.trim();
    if (!textToSave) return;
    setEditingMsgId(null);
    setEditText("");
    editAssistantMessage(msgId, textToSave);
  }

  function toggleShowOriginal(msgId: string) {
    setShowOriginalMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  }

  const isConversationEmpty = messages.length <= 1;

  return (
    <div
      className="coord-chat-viewport"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        background: "#ffffff",
        position: "relative",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Optional compact header (used in floating popup or embedded) ── */}
      {!hideHeader && compact && (
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${C.slate100}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: C.slate50,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <BrainCircuit size={15} color={C.brand} />
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: C.slate900 }}>
              MediStock Coordinator
            </span>
          </div>
        </div>
      )}

      {/* ── Main Message Scroll Area with Generous Bottom Padding ── */}
      <div
        className="open-intelligent-canvas"
        style={{
          flex: "1 1 0%",
          minHeight: 0,
          overflowY: "auto",
          padding: compact ? "12px 14px 48px" : "20px 24px 72px",
        }}
      >
        <div
          className="coord-conversation-container"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Empty State — Premium OpenIntelligentUI Hero */}
          {isConversationEmpty && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "auto 0",
              padding: compact ? "24px 16px" : "48px 24px",
              textAlign: "center",
            }}
          >
            {/* Floating animated AI avatar */}
            <div
              style={{
                position: "relative",
                marginBottom: compact ? 16 : 22,
              }}
            >
              <div
                style={{
                  width: compact ? 52 : 68,
                  height: compact ? 52 : 68,
                  borderRadius: "20px",
                  background: "linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #14b8a6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    "0 10px 32px rgba(15,118,110,0.35), " +
                    "0 2px 8px rgba(15,118,110,0.2), " +
                    "0 0 0 8px rgba(15,118,110,0.08)",
                }}
                className="coord-float"
              >
                <BrainCircuit
                  size={compact ? 26 : 34}
                  color="#ffffff"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            {/* Gradient hero headline */}
            <h2
              className="coord-hero-title"
              style={{
                fontSize: compact ? "1.125rem" : "1.75rem",
                margin: "0 0 10px 0",
                lineHeight: 1.15,
              }}
            >
              MediStock Coordinator AI
            </h2>

            <p
              style={{
                fontSize: compact ? "0.75rem" : "0.9rem",
                color: "#64748b",
                maxWidth: 520,
                margin: "0 0 30px 0",
                lineHeight: 1.65,
                fontWeight: 400,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Autonomous healthcare supply chain intelligence — inventory audits, demand forecasts, regional redistributions, and supplier orders with full human governance.
            </p>

            {/* Premium Prompt Suggestion Cards (Balanced 2x2 Bento Grid) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: compact
                  ? "1fr"
                  : "repeat(2, minmax(0, 1fr))",
                gap: 12,
                width: "100%",
                maxWidth: 720,
                textAlign: "left",
              }}
            >
              {DEFAULT_PROMPTS.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePromptClick(p.prompt)}
                    disabled={isRunning}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e8edf4",
                      borderRadius: 14,
                      padding: "13px 15px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 7,
                      transition: "all 0.18s cubic-bezier(0.16,1,0.3,1)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                      fontFamily: "'Inter', system-ui, sans-serif",
                    }}
                    className="coord-prompt-card"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          background: `${p.color}18`,
                          border: `1px solid ${p.color}30`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={14} color={p.color} />
                      </div>
                      <span
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          color: "#0f172a",
                          lineHeight: 1.2,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {p.title}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        color: "#64748b",
                        lineHeight: 1.5,
                        paddingLeft: 40,
                      }}
                    >
                      {p.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversation Stream (When Messages Exist) */}
        {!isConversationEmpty &&
          messages.map((msg) => {
            const isUser = msg.sender === "user";

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  alignItems: "flex-start",
                  width: "100%",
                }}
              >
                {/* AI Avatar — Premium gradient with glow */}
                {!isUser && (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "var(--gradient-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                      boxShadow: "var(--shadow-brand)",
                    }}
                  >
                    <BrainCircuit size={18} strokeWidth={1.75} color="#fff" />
                  </div>
                )}

                {/* Message Body Box */}
                <div style={{ maxWidth: compact ? "90%" : "84%", minWidth: 0, width: "100%" }}>
                  {/* AI Metadata row */}
                  {!isUser && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#115e59", letterSpacing: "0.01em", fontFamily: "'Inter', system-ui, sans-serif" }}>
                        MediStock Coordinator
                      </span>
                      {msg.intent && (
                        <span
                          style={{
                            fontSize: "0.5625rem",
                            fontWeight: 600,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: C.slate100,
                            color: C.slate600,
                            fontFamily: "monospace",
                          }}
                        >
                          {msg.intent}
                        </span>
                      )}
                      {msg.requiresApproval && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            fontSize: "0.5625rem",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 999,
                            background: "#fef3c7",
                            color: "#92400e",
                          }}
                        >
                          <ShieldCheck size={9} strokeWidth={2} />
                          Governance Gate
                        </span>
                      )}
                      <span style={{ fontSize: "0.5625rem", color: C.slate400, marginLeft: "auto" }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}

                  {/* ── Inline Edit Mode ── */}
                  {editingMsgId === msg.id ? (
                    <div
                      style={{
                        background: isUser ? "#1e293b" : C.white,
                        border: `1px solid ${C.brand}`,
                        borderRadius: isUser ? "14px 14px 2px 14px" : "2px 14px 14px 14px",
                        padding: "10px 12px",
                        boxShadow: `0 0 0 2px rgba(15,118,110,0.12)`,
                      }}
                    >
                      <textarea
                        ref={editTextareaRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { e.preventDefault(); cancelEditing(); }
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (isUser) { void handleSaveUserEdit(msg.id, true); }
                            else handleSaveAssistantEdit(msg.id);
                          }
                        }}
                        rows={3}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          color: isUser ? "#f8fafc" : C.slate900,
                          fontSize: "0.8125rem",
                          lineHeight: 1.5,
                          fontFamily: "inherit",
                          resize: "vertical",
                          minHeight: 52,
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                        {isUser ? (
                          <button
                            type="button"
                            onClick={() => { void handleSaveUserEdit(msg.id, true); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 6, border: "none",
                              background: C.brand, color: "#fff", fontSize: "0.6875rem",
                              fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            <Check size={11} /> Save &amp; Submit
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSaveAssistantEdit(msg.id)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 6, border: "none",
                              background: C.brand, color: "#fff", fontSize: "0.6875rem",
                              fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            <Check size={11} /> Save Annotation
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={cancelEditing}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "4px 8px", borderRadius: 6, border: "none",
                            background: "transparent", color: C.slate400,
                            fontSize: "0.6875rem", cursor: "pointer",
                          }}
                        >
                          Esc to Cancel
                        </button>
                        <span style={{ fontSize: "0.5625rem", color: C.slate400, alignSelf: "center", marginLeft: "auto" }}>
                          Ctrl+Enter to save
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal display mode ── */
                    <div className="coord-msg-wrapper">
                      {/* Message bubble */}
                      <div
                        className={
                          isUser
                            ? "coord-msg-user"
                            : msg.status === "error"
                            ? "coord-msg-error"
                            : "coord-msg-ai"
                        }
                        style={{
                          fontSize: "0.8125rem",
                          lineHeight: 1.55,
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {isUser ? (
                          <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
                        ) : (
                          <AdaptiveResponseRenderer
                            message={msg}
                            onSelectPrompt={(promptText) => {
                              void sendMessage(promptText, resolveWorkflowType(promptText));
                            }}
                            onRetry={() => {
                              void sendMessage(msg.text, resolveWorkflowType(msg.text));
                            }}
                            onEdit={() => startEditing(msg)}
                          />
                        )}
                      </div>

                      {/* Hover-visible edit/annotate action row */}
                      <div
                        className="coord-msg-actions"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 4,
                          justifyContent: isUser ? "flex-end" : "flex-start",
                        }}
                      >
                        {msg.isEdited && (
                          <span style={{ fontSize: "0.5625rem", color: C.slate400, fontStyle: "italic" }}>
                            {isUser ? "(edited)" : "(edited annotation)"}
                          </span>
                        )}
                        {msg.isEdited && !isUser && msg.originalText && (
                          <button
                            type="button"
                            onClick={() => toggleShowOriginal(msg.id)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              background: "none", border: "none", cursor: "pointer",
                              color: C.slate400, fontSize: "0.5625rem", padding: "0 2px",
                            }}
                            title="Show/hide original AI output"
                          >
                            <History size={9} />
                            {showOriginalMap[msg.id] ? "Hide original" : "View original"}
                          </button>
                        )}
                        {!isRunning && msg.status !== "error" && (
                          <button
                            type="button"
                            onClick={() => startEditing(msg)}
                            className="coord-edit-btn"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              background: "none", border: "none", cursor: "pointer",
                              color: C.slate400, fontSize: "0.5625rem", padding: "0 2px",
                            }}
                            title={isUser ? "Edit message" : "Annotate response"}
                          >
                            <Pencil size={9} />
                            {isUser ? "Edit" : "Annotate"}
                          </button>
                        )}
                      </div>

                      {/* Original AI output (when annotation toggled) */}
                      {!isUser && msg.isEdited && msg.originalText && showOriginalMap[msg.id] && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: "8px 10px",
                            background: C.slate50,
                            border: `1px solid ${C.slate200}`,
                            borderRadius: 6,
                            fontSize: "0.75rem",
                            color: C.slate500,
                            lineHeight: 1.5,
                          }}
                        >
                          <div style={{ fontSize: "0.5625rem", fontWeight: 700, color: C.slate400, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Original AI output (read-only)
                          </div>
                          <MarkdownMessage content={msg.originalText} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* In-Chat Human Approval Card */}
                  {!isUser && (msg.requiresApproval || msg.workflowRun?.requiresApproval) && (
                    <InChatApprovalCard
                      message={msg}
                      workflow={msg.workflowRun || activeWorkflow!}
                      onSubmitApproval={submitApproval}
                      compact={compact}
                    />
                  )}

                  {/* Phase 3: Strategy Selection Buttons */}
                  {(() => {
                    let stratList: string[] = [];
                    if (Array.isArray(msg.availableStrategies) && msg.availableStrategies.length > 0) {
                      stratList = msg.availableStrategies;
                    }
                    if (stratList.length === 0 && msg.workflowRun?.resultJson) {
                      try {
                        const parsed = typeof msg.workflowRun.resultJson === "string"
                          ? JSON.parse(msg.workflowRun.resultJson)
                          : msg.workflowRun.resultJson;
                        if (Array.isArray(parsed?.available_strategies) && parsed.available_strategies.length > 0) {
                          stratList = parsed.available_strategies as string[];
                        } else if (Array.isArray(parsed?.availableStrategies) && parsed.availableStrategies.length > 0) {
                          stratList = parsed.availableStrategies as string[];
                        }
                      } catch {
                        // ignore parse error
                      }
                    }
                    if (stratList.length === 0 && !isUser) {
                      const msgText = (msg.text || "").toLowerCase();
                      const wfType = msg.workflowRun?.workflowType || msg.intent;
                      // Don't show strategy buttons if this is an approval-required message
                      // or if the workflow is already a concrete execution type
                      const isConcreteExecution = wfType === "AutonomousProcurement" ||
                        wfType === "StockRedistribution" || wfType === "CombinedResolution";
                      if (
                        !msg.requiresApproval &&
                        !msg.workflowRun?.requiresApproval &&
                        !isConcreteExecution &&
                        (
                          (wfType === "ShortageAnalysis" || wfType === "ShortageResolution") &&
                          (
                            msgText.includes("choose a resolution strategy") ||
                            msgText.includes("resolution strategy below") ||
                            msgText.includes("resolution strategy") ||
                            msgText.includes("select a resolution strategy") ||
                            msgText.includes("please choose") ||
                            msgText.includes("recommend choosing")
                          )
                        )
                      ) {
                        stratList = ["Redistribution", "Procurement", "Both", "Neither"];
                      }
                    }

                    // Never show strategy buttons on messages requiring approval
                    if (msg.requiresApproval || msg.workflowRun?.requiresApproval) {
                      stratList = [];
                    }

                    if (!isUser && stratList.length > 0) {
                      return (
                        <div
                          style={{
                            marginTop: 10,
                            padding: "12px 14px",
                            background: "var(--gradient-subtle)",
                            border: "1.5px solid var(--color-primary-600)",
                            borderRadius: 10,
                            boxShadow: "0 2px 6px rgba(13, 148, 136, 0.08)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <Zap size={14} color="var(--color-primary-700)" strokeWidth={2.5} aria-hidden="true" />
                            <p
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "var(--color-primary-800)",
                                margin: 0,
                                letterSpacing: "-0.01em",
                              }}
                            >
                              Choose Resolution Strategy:
                            </p>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {stratList.map((strategy) => {
                              const wfType = resolveWorkflowType(strategy);
                              return (
                                <button
                                  key={strategy}
                                  type="button"
                                  disabled={isRunning}
                                  onClick={() =>
                                    void sendMessage(
                                      strategy,
                                      wfType,
                                      true
                                    )
                                  }
                                  style={{
                                    padding: "6px 14px",
                                    borderRadius: 999,
                                    border: "1px solid var(--color-primary-600)",
                                    background: "#ffffff",
                                    color: "var(--color-primary-700)",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    cursor: isRunning ? "not-allowed" : "pointer",
                                    opacity: isRunning ? 0.5 : 1,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                    transition: "all 0.15s ease",
                                  }}
                                  className="coord-strategy-btn"
                                >
                                  {strategy}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Expandable Execution Details */}
                  {!isUser && msg.workflowRun?.steps && msg.workflowRun.steps.length > 0 && (
                    <ExecutionDetails workflow={msg.workflowRun} compact={compact} />
                  )}

                  {/* User timestamp */}
                  {isUser && (
                    <p
                      style={{
                        fontSize: "0.5625rem",
                        color: C.slate400,
                        margin: "3px 4px 0",
                        textAlign: "right",
                      }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: C.slate200,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <User size={13} strokeWidth={1.75} color={C.slate600} />
                  </div>
                )}
              </div>
            );
          })}

        {/* Running Live State — Premium typing indicator */}
        {isRunning && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
                boxShadow: "var(--shadow-brand)",
              }}
            >
              <BrainCircuit size={18} strokeWidth={1.75} color="#fff" className="coord-pulse" />
            </div>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-default)",
                borderRadius: "4px 18px 18px 18px",
                padding: "14px 18px",
                maxWidth: "85%",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <LoaderCircle size={13} strokeWidth={2} color="var(--color-primary-700)" className="coord-spin" />
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-primary-800)", fontFamily: "var(--font-sans)" }}>
                  Orchestrating… <span style={{ fontWeight: 500, color: "var(--color-slate-500)" }}>({elapsedSeconds}s)</span>
                </span>
                <button
                  type="button"
                  onClick={cancelExecution}
                  title="Cancel execution"
                  style={{
                    background: "var(--color-danger-50)",
                    border: "1px solid var(--color-danger-200)",
                    borderRadius: 6,
                    color: "var(--color-danger-600)",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    marginLeft: 6,
                    padding: "2px 8px",
                  }}
                >
                  <StopCircle size={10} /> Cancel
                </button>
              </div>
              {/* Typing dots */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <span className="coord-typing-dot" />
                <span className="coord-typing-dot" />
                <span className="coord-typing-dot" />
              </div>
              <p style={{ fontSize: "0.6875rem", color: "var(--color-slate-500)", margin: 0, fontStyle: "italic" }}>
                {currentPhase}
              </p>
            </div>
          </div>
        )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Anchored Message Composer at Bottom — Premium ── */}
      <div
        style={{
          padding: compact ? "10px 12px" : "16px 22px",
          borderTop: "1px solid var(--border-default)",
          background: "#ffffff",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div className="coord-conversation-container">
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              background: "#ffffff",
              border: "1.5px solid var(--border-strong)",
              borderRadius: 16,
              padding: "10px 14px",
              boxShadow: "var(--shadow-md)",
              transition: "all 0.18s ease",
            }}
            className="coord-composer-box"
          >
          <textarea
            ref={textareaRef}
            rows={compact ? 1 : 2}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            placeholder={
              compact
                ? "Ask MediStock Coordinator..."
                : "Ask about medicine shortages, donor facilities, supplier scores, or enter a clinical directive..."
            }
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              background: "transparent",
              minHeight: compact ? 22 : 36,
              maxHeight: 120,
              overflowY: "auto",
            }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={isRunning || !inputText.trim()}
            aria-label="Send message"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: inputText.trim() && !isRunning
                ? "var(--gradient-primary)"
                : "var(--color-slate-100)",
              color: inputText.trim() && !isRunning ? "#ffffff" : "var(--color-slate-400)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: inputText.trim() && !isRunning ? "pointer" : "default",
              flexShrink: 0,
              transition: "all 0.18s ease",
              boxShadow: inputText.trim() && !isRunning ? "var(--shadow-brand)" : "none",
            }}
          >
            {isRunning ? (
              <LoaderCircle size={15} className="coord-spin" />
            ) : (
              <Send size={15} strokeWidth={2} />
            )}
          </button>
        </div>

          {!compact && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 6,
                padding: "0 4px",
                fontSize: "0.6875rem",
                color: C.slate400,
                flexWrap: "wrap",
                gap: 4,
              }}
            >
              <span>Enter to send · Shift+Enter for new line</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <ShieldCheck size={11} color="#059669" />
                Autonomous Health Governance Enabled
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
