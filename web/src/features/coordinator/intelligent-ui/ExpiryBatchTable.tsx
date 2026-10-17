import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Pill,
  Search,
  Lightbulb,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";

export interface ExpiryBatchEntry {
  batch_number: string;
  medicine: string;
  facility: string;
  quantity: number;
  expiry_date: string;
  days_to_expiry: number;
  condition: string;
}

export interface ExpiryAuditData {
  expiry_audit: boolean;
  window_days: number;
  expiring_batches: ExpiryBatchEntry[];
  total_expiring: number;
  critical_count: number;
  warning_count: number;
  notice_count: number;
  batches_scanned: number;
  agent_findings?: string;
}

interface ExpiryBatchTableProps {
  data: ExpiryAuditData;
  onSelectMedicine?: (medicineName: string) => void;
  className?: string;
}

type SortKey = "days_to_expiry" | "medicine" | "facility" | "quantity";
type FilterTier = "all" | "critical" | "warning" | "notice";

export function ExpiryBatchTable({
  data,
  onSelectMedicine,
  className = "",
}: ExpiryBatchTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("days_to_expiry");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterTier, setFilterTier] = useState<FilterTier>("all");

  const batches = useMemo(() => data.expiring_batches || [], [data.expiring_batches]);

  // Severity helper with clean semantic color tokens
  const getSeverity = (days: number) => {
    if (days <= 0) {
      return {
        tier: "critical" as FilterTier,
        label: "Expired",
        icon: AlertCircle,
        iconColor: "#dc2626",
        badgeBg: "#fef2f2",
        badgeText: "#991b1b",
        badgeBorder: "#fecaca",
        countdownText: "Expired",
      };
    }
    if (days <= 30) {
      return {
        tier: "critical" as FilterTier,
        label: "Critical",
        icon: AlertTriangle,
        iconColor: "#dc2626",
        badgeBg: "#fef2f2",
        badgeText: "#b91c1c",
        badgeBorder: "#fecaca",
        countdownText: `${days}d left`,
      };
    }
    if (days <= 60) {
      return {
        tier: "warning" as FilterTier,
        label: "Warning",
        icon: Clock,
        iconColor: "#d97706",
        badgeBg: "#fffbeb",
        badgeText: "#b45309",
        badgeBorder: "#fde68a",
        countdownText: `${days}d left`,
      };
    }
    return {
      tier: "notice" as FilterTier,
      label: "Notice",
      icon: CheckCircle2,
      iconColor: "#0284c7",
      badgeBg: "#f0f9ff",
      badgeText: "#0369a1",
      badgeBorder: "#bae6fd",
      countdownText: `${days}d left`,
    };
  };

  // Filter batches
  const filtered = useMemo(() => {
    return batches.filter((b) => {
      const sev = getSeverity(b.days_to_expiry);
      if (filterTier !== "all" && sev.tier !== filterTier) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        b.medicine.toLowerCase().includes(term) ||
        b.facility.toLowerCase().includes(term) ||
        b.batch_number.toLowerCase().includes(term)
      );
    });
  }, [batches, filterTier, searchTerm]);

  // Sort batches
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "days_to_expiry") cmp = a.days_to_expiry - b.days_to_expiry;
      else if (sortKey === "quantity") cmp = a.quantity - b.quantity;
      else if (sortKey === "medicine") cmp = a.medicine.localeCompare(b.medicine);
      else if (sortKey === "facility") cmp = a.facility.localeCompare(b.facility);
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const criticalCount = data.critical_count || batches.filter((b) => b.days_to_expiry <= 30).length;
  const warningCount = data.warning_count || batches.filter((b) => b.days_to_expiry > 30 && b.days_to_expiry <= 60).length;
  const noticeCount = data.notice_count || batches.filter((b) => b.days_to_expiry > 60).length;
  const totalQuantityExpiring = sorted.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div
      className={className}
      style={{
        margin: "14px 0",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
        fontFamily: "var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        color: "#0f172a",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* ── 1. Header & KPI Bar ────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
          padding: "14px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#f0fdfa",
                border: "1px solid #ccfbf1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0f766e",
                flexShrink: 0,
              }}
            >
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h4
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Facility Batch Expiry Intelligence
                </h4>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "2px 7px",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  <Clock size={11} color="#64748b" />
                  Next {data.window_days} Days
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#64748b",
                  margin: "2px 0 0",
                }}
              >
                Authoritative FEFO lot audit across facilities ·{" "}
                <strong style={{ color: "#334155" }}>
                  {data.batches_scanned} batches scanned
                </strong>
              </p>
            </div>
          </div>

          {/* Quick KPI Count Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Critical */}
            <button
              type="button"
              onClick={() => setFilterTier(filterTier === "critical" ? "all" : "critical")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 9px",
                borderRadius: 7,
                fontSize: "0.6875rem",
                fontWeight: 600,
                cursor: "pointer",
                border: filterTier === "critical" ? "1.5px solid #ef4444" : "1px solid #fecaca",
                background: filterTier === "critical" ? "#fef2f2" : "#ffffff",
                color: "#b91c1c",
              }}
            >
              <AlertCircle size={12} color="#dc2626" />
              <span>Critical ≤30d:</span>
              <span
                style={{
                  background: "#fee2e2",
                  padding: "0 5px",
                  borderRadius: 4,
                  fontWeight: 700,
                  color: "#991b1b",
                }}
              >
                {criticalCount}
              </span>
            </button>

            {/* Warning */}
            <button
              type="button"
              onClick={() => setFilterTier(filterTier === "warning" ? "all" : "warning")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 9px",
                borderRadius: 7,
                fontSize: "0.6875rem",
                fontWeight: 600,
                cursor: "pointer",
                border: filterTier === "warning" ? "1.5px solid #f59e0b" : "1px solid #fde68a",
                background: filterTier === "warning" ? "#fffbeb" : "#ffffff",
                color: "#b45309",
              }}
            >
              <Clock size={12} color="#d97706" />
              <span>Warning 31–60d:</span>
              <span
                style={{
                  background: "#fef3c7",
                  padding: "0 5px",
                  borderRadius: 4,
                  fontWeight: 700,
                  color: "#92400e",
                }}
              >
                {warningCount}
              </span>
            </button>

            {/* Notice */}
            <button
              type="button"
              onClick={() => setFilterTier(filterTier === "notice" ? "all" : "notice")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 9px",
                borderRadius: 7,
                fontSize: "0.6875rem",
                fontWeight: 600,
                cursor: "pointer",
                border: filterTier === "notice" ? "1.5px solid #0284c7" : "1px solid #bae6fd",
                background: filterTier === "notice" ? "#f0f9ff" : "#ffffff",
                color: "#0369a1",
              }}
            >
              <CheckCircle2 size={12} color="#0284c7" />
              <span>Notice:</span>
              <span
                style={{
                  background: "#e0f2fe",
                  padding: "0 5px",
                  borderRadius: 4,
                  fontWeight: 700,
                  color: "#075985",
                }}
              >
                {noticeCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Filter & Search Controls ────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: "1px solid #f1f5f9",
          background: "#ffffff",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 300 }}>
          <Search
            size={13}
            color="#94a3b8"
            style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medicine, facility, lot..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "5px 10px 5px 28px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: "0.75rem",
              color: "#0f172a",
              outline: "none",
              background: "#ffffff",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "#f1f5f9",
              padding: 2,
              borderRadius: 6,
            }}
          >
            {(
              [
                { id: "all", label: `All (${batches.length})` },
                { id: "critical", label: `Critical (${criticalCount})` },
                { id: "warning", label: `Warning (${warningCount})` },
                { id: "notice", label: `Notice (${noticeCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTier(tab.id)}
                style={{
                  padding: "3px 8px",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  borderRadius: 5,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 100ms ease",
                  background: filterTier === tab.id ? "#ffffff" : "transparent",
                  color: filterTier === tab.id ? "#0f766e" : "#64748b",
                  boxShadow: filterTier === tab.id ? "0 1px 2px rgba(0, 0, 0, 0.08)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>
            Showing <strong>{sorted.length}</strong> of {batches.length}
          </span>
        </div>
      </div>

      {/* ── 3. High-Density Robust Table ─────────────────────────────────────── */}
      {sorted.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <h4 style={{ margin: "0 0 4px", fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}>
            No Expiring Batches in this Filter
          </h4>
          <p style={{ margin: "0 auto", fontSize: "0.75rem", color: "#64748b", maxWidth: 380 }}>
            {searchTerm
              ? `No batch matches "${searchTerm}".`
              : `All medicine batches within this threshold are safely within standard shelf life.`}
          </p>
          {(searchTerm || filterTier !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setFilterTier("all");
              }}
              style={{
                marginTop: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                padding: "4px 10px",
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={11} />
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <table
            style={{
              width: "auto",
              minWidth: 680,
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.7rem",
              tableLayout: "auto",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                {/* Column 1: Pharmaceutical & Batch Lot */}
                <th
                  onClick={() => toggleSort("medicine")}
                  style={{
                    padding: "8px 10px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    minWidth: 160,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span>Pharmaceutical & Batch Lot</span>
                    <ArrowUpDown size={10} color="#94a3b8" />
                  </div>
                </th>

                {/* Column 2: Healthcare Facility */}
                <th
                  onClick={() => toggleSort("facility")}
                  style={{
                    padding: "8px 10px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    minWidth: 130,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span>Healthcare Facility</span>
                    <ArrowUpDown size={10} color="#94a3b8" />
                  </div>
                </th>

                {/* Column 3: Stock Qty */}
                <th
                  onClick={() => toggleSort("quantity")}
                  style={{
                    padding: "8px 0px 8px 1px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    textAlign: "right",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    minWidth: 25,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                    <span>Stock Qty</span>
                    <ArrowUpDown size={9} color="#94a3b8" />
                  </div>
                </th>

                {/* Column 4: Expiry Status & Runway */}
                <th
                  onClick={() => toggleSort("days_to_expiry")}
                  style={{
                    padding: "8px 10px 8px 0px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    textAlign: "right",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    minWidth: 200,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    <span>Expiry & Runway</span>
                    <ArrowUpDown size={10} color="#94a3b8" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((batch, idx) => {
                const sev = getSeverity(batch.days_to_expiry);
                const SevIcon = sev.icon;

                return (
                  <tr
                    key={`${batch.batch_number}-${idx}`}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: idx % 2 === 0 ? "#ffffff" : "#fafbfc",
                      transition: "background 100ms ease",
                    }}
                  >
                    {/* Pharmaceutical & Batch Lot (Stacked neatly, NEVER wrapped character by character) */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: "#f0fdfa",
                            border: "1px solid #ccfbf1",
                            color: "#0f766e",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Pill size={13} />
                        </span>
                        <div>
                          <div
                            onClick={() => onSelectMedicine?.(batch.medicine)}
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              color: "#0f172a",
                              cursor: "pointer",
                              lineHeight: 1.25,
                            }}
                          >
                            {batch.medicine}
                          </div>
                          <div style={{ marginTop: 2 }}>
                            <code
                              style={{
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                borderRadius: 4,
                                padding: "1px 5px",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: "0.6875rem",
                                color: "#475569",
                                fontWeight: 500,
                              }}
                            >
                              Lot: {batch.batch_number}
                            </code>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Healthcare Facility */}
                    <td style={{ padding: "10px 14px", color: "#334155", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Building2 size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{batch.facility}</span>
                      </div>
                    </td>

                    {/* Stock Qty */}
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        fontSize: "0.8125rem",
                      }}
                    >
                      {batch.quantity.toLocaleString()}{" "}
                      <span style={{ fontWeight: 400, color: "#64748b", fontSize: "0.6875rem" }}>
                        units
                      </span>
                    </td>

                    {/* Expiry Status & Runway */}
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            borderRadius: 10,
                            border: `1px solid ${sev.badgeBorder}`,
                            background: sev.badgeBg,
                            color: sev.badgeText,
                            padding: "2px 8px",
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                          }}
                        >
                          <SevIcon size={11} color={sev.iconColor} />
                          <span>{sev.label} · {sev.countdownText}</span>
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "#64748b",
                          marginTop: 3,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                      >
                        Exp: {batch.expiry_date}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer */}
            <tfoot>
              <tr
                style={{
                  borderTop: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#475569",
                  whiteSpace: "nowrap",
                }}
              >
                <td colSpan={2} style={{ padding: "8px 14px" }}>
                  Total Expiring Inventory Across Filtered Lots:
                </td>
                <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                  {totalQuantityExpiring.toLocaleString()}{" "}
                  <span style={{ fontWeight: 400, color: "#64748b" }}>units</span>
                </td>
                <td style={{ padding: "8px 14px", textAlign: "right", color: "#64748b" }}>
                  {sorted.length} batch lots recorded
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── 4. Clinical Governance & FEFO Best Practice Banner ─────────────────── */}
      <div
        style={{
          borderTop: "1px solid #fde68a",
          background: "#fffbeb",
          padding: "10px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 5,
            background: "#fef3c7",
            border: "1px solid #fde68a",
            color: "#b45309",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          <Lightbulb size={13} />
        </div>
        <div style={{ fontSize: "0.6875rem", color: "#78350f", lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 700, color: "#92400e" }}>
            FEFO Clinical Rotation Protocol:
          </strong>{" "}
          Dispense soonest-expiring batches first (First-Expiry-First-Out). For lots with ≤30 days remaining and surplus stock exceeding local consumption velocity, initiate emergency inter-facility redistribution to avoid inventory write-offs.
        </div>
      </div>
    </div>
  );
}
