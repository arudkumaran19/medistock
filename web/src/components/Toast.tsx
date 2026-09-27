import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (variant: ToastVariant, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, message: string, duration = variant === "error" ? 5500 : 3500) => {
      const id = `toast-${++nextId.current}`;
      setToasts((prev) => [...prev.slice(-4), { id, variant, message, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const ctx: ToastContextValue = {
    toast,
    success: (msg) => toast("success", msg),
    error:   (msg) => toast("error", msg),
    warning: (msg) => toast("warning", msg),
    info:    (msg) => toast("info", msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Toast Item ────────────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={16} style={{ color: "#4ade80", flexShrink: 0 }} />,
  error:   <XCircle      size={16} style={{ color: "#f87171", flexShrink: 0 }} />,
  warning: <AlertTriangle size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />,
  info:    <Info          size={16} style={{ color: "#60a5fa", flexShrink: 0 }} />,
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`toast toast-${t.variant}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px 14px",
        background: "#1e293b",
        color: "#f1f5f9",
        borderRadius: "8px",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.25)",
        fontSize: "0.8125rem",
        maxWidth: "400px",
        pointerEvents: "all",
        animation: "toastIn 200ms ease",
        borderLeft: t.variant === "success" ? "3px solid #22c55e"
                  : t.variant === "error"   ? "3px solid #ef4444"
                  : t.variant === "warning" ? "3px solid #f59e0b"
                  : "3px solid #3b82f6",
      }}
    >
      {ICONS[t.variant]}
      <span style={{ flex: 1, lineHeight: 1.5 }}>{t.message}</span>
      <button
        aria-label="Dismiss notification"
        onClick={() => onDismiss(t.id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#64748b",
          padding: 0,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Container ─────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
