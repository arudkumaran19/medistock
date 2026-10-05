import React from "react";

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
  success: { background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" },
  warning: { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" },
  danger:  { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" },
  neutral: { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" },
  info:    { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  ai:      { background: "#e0e7ff", color: "#4338ca", border: "1px solid #c7d2fe" },
  primary: { background: "#ccfbf1", color: "#0f766e", border: "1px solid #99f6e4" },
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
}

export function KPICard({ label, value, context, icon, accent = "#0f766e", variant = "default" }: KPICardProps) {
  const bgMap = {
    default: "#ffffff",
    warning: "#fffbeb",
    danger:  "#fef2f2",
    success: "#f0fdf4",
  };
  const borderMap = {
    default: "#e2e8f0",
    warning: "#fde68a",
    danger:  "#fecaca",
    success: "#bbf7d0",
  };

  return (
    <div
      style={{
        background: bgMap[variant],
        border: `1px solid ${borderMap[variant]}`,
        borderRadius: "10px",
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        transition: "box-shadow 150ms, transform 150ms",
        width: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 10px rgba(0,0,0,0.07)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: "10px",
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
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={label}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "var(--font-display, inherit)",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#0f172a",
            margin: "2px 0 0",
            lineHeight: 1.2,
          }}
        >
          {value}
        </p>
        {context && (
          <p
            style={{
              fontSize: "0.72rem",
              color: "#94a3b8",
              margin: "2px 0 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={context}
          >
            {context}
          </p>
        )}
      </div>
    </div>
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

export function QuickAction({ to, label, description, icon, accent = "#0f766e" }: QuickActionProps) {
  return (
    <Link
      to={to}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "13px 16px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        textDecoration: "none",
        color: "#0f172a",
        transition: "all 150ms",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "#f0fdf4";
        el.style.borderColor = "#bbf7d0";
        el.style.textDecoration = "none";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "#f8fafc";
        el.style.borderColor = "#e2e8f0";
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: "8px",
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
        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.8125rem", color: "#0f172a" }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>{description}</p>
      </div>
      <ArrowRight size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
    </Link>
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
      ? { background: "#dc2626", color: "#fff", border: "1px solid #dc2626" }
      : variant === "warning"
      ? { background: "#d97706", color: "#fff", border: "1px solid #d97706" }
      : { background: "#0f766e", color: "#fff", border: "1px solid #0f766e" };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 400,
        padding: "16px",
        animation: "overlayIn 150ms ease",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
          overflow: "hidden",
          animation: "modalIn 200ms ease",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            id="confirm-dialog-title"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.0625rem",
              fontWeight: 600,
              color: "#0f172a",
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
        <div style={{ padding: "20px 24px", fontSize: "0.875rem", color: "#334155" }}>
          {typeof message === "string" ? <p style={{ margin: 0 }}>{message}</p> : message}
          {children && <div style={{ marginTop: 16 }}>{children}</div>}
        </div>
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
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
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#334155",
              fontSize: "0.8125rem",
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
              borderRadius: "6px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              ...variantStyle,
            }}
          >
            {isLoading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
