import React from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "28px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "var(--color-primary-700)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: "0 0 4px 0",
          }}
        >
          {eyebrow}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-3xl)",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "var(--text-base)",
              color: "var(--text-secondary)",
              margin: "6px 0 0 0",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── Status Badge unified component ────────────────────────────────────────

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info" | "ai" | "primary";

const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  success: { background: "var(--color-success-100)", color: "var(--color-success-700)", border: "1px solid var(--color-success-200)" },
  warning: { background: "var(--color-warning-100)", color: "var(--color-warning-700)", border: "1px solid var(--color-warning-200)" },
  danger:  { background: "var(--color-danger-100)", color: "var(--color-danger-700)", border: "1px solid var(--color-danger-200)" },
  neutral: { background: "var(--color-slate-100)", color: "var(--color-slate-700)", border: "1px solid var(--color-slate-200)" },
  info:    { background: "var(--color-info-100)", color: "var(--color-info-700)", border: "1px solid var(--color-info-200)" },
  ai:      { background: "var(--color-ai-100)", color: "var(--color-ai-700)", border: "1px solid var(--color-ai-200)" },
  primary: { background: "var(--color-primary-100)", color: "var(--color-primary-700)", border: "1px solid var(--color-primary-200)" },
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

export function StatusBadge({ variant, children, dot }: StatusBadgeProps) {
  const style = BADGE_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        fontSize: "0.75rem",
        fontWeight: 600,
        borderRadius: "9999px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// ─── Utility to map PO status → badge variant ──────────────────────────────

export function getPOStatusBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case "Draft":            return { variant: "neutral",  label: "Draft" };
    case "PendingApproval":  return { variant: "warning",  label: "Pending approval" };
    case "Approved":         return { variant: "success",  label: "Approved" };
    case "Rejected":         return { variant: "danger",   label: "Rejected" };
    case "RevisionRequired": return { variant: "warning",  label: "Revision required" };
    case "Received":         return { variant: "primary",  label: "Received" };
    case "Cancelled":        return { variant: "neutral",  label: "Cancelled" };
    case "Delivered":        return { variant: "success",  label: "Delivered" };
    case "InTransit":        return { variant: "info",     label: "In transit" };
    default:                 return { variant: "neutral",  label: status };
  }
}

// ─── KPI card ──────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  context?: string;
  icon: React.ReactNode;
  accent?: string;
  variant?: "default" | "warning" | "danger" | "success";
  trend?: { value: number; label?: string }; // positive = up, negative = down
  compact?: boolean;
}

export function KPICard({ label, value, context, icon, accent = "var(--color-primary-700)", variant = "default", trend, compact }: KPICardProps) {
  const bgMap = {
    default: "#ffffff",
    warning: "var(--color-warning-50)",
    danger:  "var(--color-danger-50)",
    success: "#f0fdf9",
  };
  const borderMap = {
    default: "#e2e8f0",
    warning: "var(--color-warning-200)",
    danger:  "var(--color-danger-200)",
    success: "#a7f3d0",
  };

  const trendColor = trend
    ? trend.value > 0
      ? "#16a34a"
      : trend.value < 0
      ? "#dc2626"
      : "#64748b"
    : null;
  const trendArrow = trend
    ? trend.value > 0
      ? "▲"
      : trend.value < 0
      ? "▼"
      : "–"
    : null;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      style={{
        background: bgMap[variant],
        borderTop: `1px solid ${borderMap[variant]}`,
        borderRight: `1px solid ${borderMap[variant]}`,
        borderBottom: `1px solid ${borderMap[variant]}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: "var(--radius-xl)",
        padding: compact ? "14px 16px" : "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: compact ? 12 : 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        transition: "all 0.18s cubic-bezier(0.16,1,0.3,1)",
        width: "100%",
        boxSizing: "border-box",
        cursor: "default",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          borderRadius: "var(--radius-lg)",
          background: `${accent}16`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: accent,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: 0,
            lineHeight: 1.25,
            whiteSpace: "normal",
          }}
          title={label}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "var(--font-display, 'Space Grotesk', system-ui, sans-serif)",
            fontSize: compact ? "var(--text-2xl)" : "var(--text-3xl)",
            fontWeight: 700,
            color: "#0f172a",
            margin: "2px 0 0",
            lineHeight: 1.15,
          }}
        >
          {value}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
          {context && (
            <p
              style={{
                fontSize: "0.6875rem",
                color: "#94a3b8",
                margin: 0,
                lineHeight: 1.25,
                whiteSpace: "normal",
              }}
              title={context}
            >
              {context}
            </p>
          )}
          {trend && trendColor && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: trendColor,
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                flexShrink: 0,
              }}
            >
              {trendArrow} {trend.label ?? `${Math.abs(trend.value)}%`}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Quick Action link ──────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface QuickActionProps {
  to: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent?: string;
}

export function QuickAction({ to, label, description, icon, accent = "var(--color-primary-700)" }: QuickActionProps) {
  return (
    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
      <Link
        to={to}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "13px 16px",
          background: "var(--bg-surface-subtle)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          textDecoration: "none",
          color: "var(--text-primary)",
          transition: "all var(--duration-fast)",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--color-success-50)";
          el.style.borderColor = "var(--color-success-200)";
          el.style.textDecoration = "none";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--bg-surface-subtle)";
          el.style.borderColor = "var(--border-default)";
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: `${accent}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: accent,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
            {label}
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{description}</p>
        </div>
        <ArrowRight size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      </Link>
    </motion.div>
  );
}

// ─── Skeleton loader ────────────────────────────────────────────────────────

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div
            style={{
              height: 14,
              borderRadius: 4,
              background: "#e2e8f0",
              animation: "pulse 1.5s ease-in-out infinite",
              width: i === 0 ? "70%" : i === cols - 1 ? "50%" : "85%",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

interface EmptyTableStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  colSpan?: number;
}

export function EmptyTableState({
  icon,
  title,
  description,
  action,
  colSpan = 6,
}: EmptyTableStateProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ color: "#94a3b8" }}>{icon}</div>
          <p style={{ fontWeight: 600, color: "#334155", margin: 0, fontSize: "0.9375rem" }}>
            {title}
          </p>
          {description && (
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0, maxWidth: 360 }}>
              {description}
            </p>
          )}
          {action && <div style={{ marginTop: 8 }}>{action}</div>}
        </div>
      </td>
    </tr>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  isLoading,
  children,
}: ConfirmDialogProps) {
  const variantStyle: React.CSSProperties =
    variant === "danger"
      ? { background: "var(--color-danger-600)", color: "#fff", border: "1px solid var(--color-danger-600)" }
      : variant === "warning"
      ? { background: "var(--color-warning-600)", color: "#fff", border: "1px solid var(--color-warning-600)" }
      : { background: "var(--color-primary-700)", color: "#fff", border: "1px solid var(--color-primary-700)" };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--z-modal-backdrop)",
        padding: "16px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 150 }}
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-2xl)",
          maxWidth: 440,
          width: "100%",
          boxShadow: "var(--shadow-2xl)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <h2
            id="confirm-dialog-title"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
        <div style={{ padding: "20px 24px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {typeof message === "string" ? <p style={{ margin: 0 }}>{message}</p> : message}
          {children && <div style={{ marginTop: 16 }}>{children}</div>}
        </div>
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-default)",
            background: "var(--bg-surface-subtle)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              ...variantStyle,
            }}
          >
            {isLoading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
