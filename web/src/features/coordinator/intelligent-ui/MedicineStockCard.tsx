import React, { useState } from "react";
import {
  Pill,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Sliders,
  RotateCcw,
} from "lucide-react";

export function formatUnit(unit?: string, count: number = 2): string {
  if (!unit) return "units";
  const clean = unit.trim().toLowerCase();
  const singular = clean.endsWith("s") ? clean.slice(0, -1) : clean;
  if (count === 1) return singular;
  return `${singular}s`;
}

export interface FacilityBreakdownItem {
  facility: string;
  facility_id?: string;
  stock_on_hand: number;
  available_stock: number;
  reserved_stock: number;
  minimum_stock_threshold: number;
  status: string;
}

export interface MedicineStockData {
  medicine: string;
  facility: string;
  stock_on_hand: number;
  available_stock: number;
  reserved_stock: number;
  minimum_stock_threshold: number;
  unit: string;
  stock_status?: string;
  active_batches?: Array<{
    batch_number: string;
    quantity: number;
    expiry_date: string;
    days_to_expiry: number;
    status: string;
  }>;
  facility_breakdown?: FacilityBreakdownItem[];
}

interface MedicineStockCardProps {
  data: MedicineStockData;
  onQuickAction?: (promptText: string) => void;
  className?: string;
}

export function MedicineStockCard({
  data,
  onQuickAction,
  className = "",
}: MedicineStockCardProps) {
  const {
    medicine,
    facility,
    stock_on_hand,
    available_stock,
    reserved_stock,
    minimum_stock_threshold,
    unit = "unit",
    stock_status,
    active_batches = [],
    facility_breakdown = [],
  } = data;

  const minStock = minimum_stock_threshold || 50;
  const usable = available_stock ?? stock_on_hand;
  const ratio = minStock > 0 ? (usable / minStock) * 100 : 100;

  // Base consumption estimation based on medicine type
  const lowerMed = medicine.toLowerCase();
  const defaultDailyRate = lowerMed.includes("paracetamol")
    ? 20.0
    : lowerMed.includes("amoxicillin")
    ? 14.5
    : lowerMed.includes("azithromycin")
    ? 2.5
    : lowerMed.includes("cetirizine")
    ? 5.0
    : 10.0;

  // OpenIntelligentUI Interactive Runway Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [dailyRate, setDailyRate] = useState(defaultDailyRate);
  const [horizonDays, setHorizonDays] = useState(30);

  // Dynamic calculations
  const projectedBurn = Math.round(dailyRate * horizonDays);
  const projectedBalance = Math.round(usable - projectedBurn);
  const daysOfSupply = dailyRate > 0 ? Math.floor(usable / dailyRate) : 999;
  const willDeplete = projectedBalance < minStock;

  // Status computation
  const isCritical = stock_status === "CRITICAL_DEFICIT" || usable < minStock;
  const isLow = usable >= minStock && usable < minStock * 1.5;

  const statusLabel = isCritical
    ? "Below Threshold"
    : isLow
    ? "Low Reserve"
    : "Adequate Stock";

  const statusBadgeStyle: React.CSSProperties = isCritical
    ? { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }
    : isLow
    ? { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }
    : { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" };

  const meterFillColor = isCritical ? "#ef4444" : isLow ? "#f59e0b" : "#10b981";

  const earliestBatch =
    active_batches.length > 0
      ? active_batches.reduce((min, b) =>
          b.days_to_expiry < min.days_to_expiry ? b : min
        )
      : null;

  return (
    <div
      className={`coord-gen-card ${className}`}
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        overflow: "hidden",
        margin: "14px 0",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Header Banner ── */}
      <div
        className="coord-gen-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#f8fafc",
          borderBottom: "1px solid #f1f5f9",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "#ccfbf1",
              color: "#0f766e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Pill size={18} />
          </div>
          <div>
            <h4
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {medicine}
            </h4>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "0.75rem",
                color: "#64748b",
                marginTop: "2px",
              }}
            >
              <Building2 size={12} color="#94a3b8" />
              <span>{facility}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className="coord-chip-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 11px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              background: showSimulator ? "#f0fdfa" : "#ffffff",
              border: `1px solid ${showSimulator ? "#2dd4bf" : "#cbd5e1"}`,
              color: showSimulator ? "#0f766e" : "#334155",
            }}
            title="Toggle interactive consumption scenario"
          >
            <Sliders size={12} />
            <span>{showSimulator ? "Close Simulator" : "Simulate Runway"}</span>
          </button>

          <span
            className="coord-status-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "0.6875rem",
              fontWeight: 700,
              ...statusBadgeStyle,
            }}
          >
            {isCritical ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── Numerical Metrics Grid (4 columns) ── */}
      <div
        className="coord-gen-grid-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          background: "#ffffff",
          borderBottom: "1px solid #f1f5f9",
          textAlign: "center",
        }}
      >
        <div className="coord-gen-cell" style={{ padding: "12px 8px", borderRight: "1px solid #f1f5f9" }}>
          <p className="coord-gen-label" style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, color: "#94a3b8", margin: "0 0 2px" }}>
            Usable
          </p>
          <p className="coord-gen-value" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f766e", margin: "2px 0 0", letterSpacing: "-0.02em" }}>
            {usable.toLocaleString()}
          </p>
          <span className="coord-gen-sub" style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{formatUnit(unit, usable)}</span>
        </div>

        <div className="coord-gen-cell" style={{ padding: "12px 8px", borderRight: "1px solid #f1f5f9" }}>
          <p className="coord-gen-label" style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, color: "#94a3b8", margin: "0 0 2px" }}>
            On Hand
          </p>
          <p className="coord-gen-value" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", margin: "2px 0 0", letterSpacing: "-0.02em" }}>
            {stock_on_hand.toLocaleString()}
          </p>
          <span className="coord-gen-sub" style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{formatUnit(unit, stock_on_hand)}</span>
        </div>

        <div className="coord-gen-cell" style={{ padding: "12px 8px", borderRight: "1px solid #f1f5f9" }}>
          <p className="coord-gen-label" style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, color: "#94a3b8", margin: "0 0 2px" }}>
            Reserved
          </p>
          <p className="coord-gen-value" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#475569", margin: "2px 0 0", letterSpacing: "-0.02em" }}>
            {reserved_stock.toLocaleString()}
          </p>
          <span className="coord-gen-sub" style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{formatUnit(unit, reserved_stock)}</span>
        </div>

        <div className="coord-gen-cell" style={{ padding: "12px 8px" }}>
          <p className="coord-gen-label" style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, color: "#94a3b8", margin: "0 0 2px" }}>
            Min Safety
          </p>
          <p className="coord-gen-value" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#475569", margin: "2px 0 0", letterSpacing: "-0.02em" }}>
            {minStock.toLocaleString()}
          </p>
          <span className="coord-gen-sub" style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>threshold</span>
        </div>
      </div>

      {/* ── Multi-Facility Stock Breakdown Section ── */}
      {facility_breakdown && facility_breakdown.length > 0 && (
        <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Facility Stock Breakdown ({facility_breakdown.length} reporting locations)
            </span>
            <span style={{ fontSize: "0.6875rem", color: "#64748b" }}>
              Policy Min: <strong>{minStock.toLocaleString()} {formatUnit(unit)}</strong>
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {facility_breakdown.map((fb, idx) => {
              const isBelow = fb.status === "CRITICAL_DEFICIT" || fb.available_stock < (fb.minimum_stock_threshold || minStock);
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={13} color="#64748b" />
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{fb.facility}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: "#64748b", fontSize: "0.6875rem" }}>
                      On-hand: {fb.stock_on_hand.toLocaleString()}
                    </span>
                    <span style={{ fontWeight: 700, color: isBelow ? "#be123c" : "#0f766e" }}>
                      {fb.available_stock.toLocaleString()} {formatUnit(unit, fb.available_stock)}
                    </span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 9999,
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        background: isBelow ? "#fff1f2" : "#f0fdf4",
                        color: isBelow ? "#be123c" : "#15803d",
                        border: `1px solid ${isBelow ? "#fecdd3" : "#bbf7d0"}`,
                      }}
                    >
                      {isBelow ? "Below" : "Adequate"}
                    </span>
                    {onQuickAction && (
                      <button
                        type="button"
                        onClick={() => onQuickAction(`What is the current stock of ${medicine} at ${fb.facility}?`)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#0f766e",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "2px 4px",
                          textDecoration: "underline",
                        }}
                      >
                        Audit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Visual Stock Level Meter ──  */}
      <div style={{ padding: "10px 16px", background: "#fbfcfd", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 500, color: "#475569", marginBottom: "6px" }}>
          <span>Operating Buffer vs Safety Threshold</span>
          <span style={{ fontWeight: 700, color: meterFillColor }}>
            {Math.round(ratio)}% of minimum
          </span>
        </div>
        <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(5, ratio))}%`,
              height: "100%",
              background: meterFillColor,
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* ── OpenIntelligentUI Interactive Runway Simulator ── */}
      {showSimulator && (
        <div
          style={{
            padding: "16px",
            background: "#f0fdfa",
            borderBottom: "1px solid #ccfbf1",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", fontWeight: 700, color: "#134e4a" }}>
              <Sliders size={14} color="#0d9488" />
              <span>Interactive Depletion &amp; Burn Simulator</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setDailyRate(defaultDailyRate);
                setHorizonDays(30);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.6875rem",
                color: "#0f766e",
                background: "#ffffff",
                border: "1px solid #99f6e4",
                borderRadius: "6px",
                padding: "3px 8px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={10} />
              <span>Reset defaults</span>
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Daily Consumption Rate Slider */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                <span>Daily Consumption Velocity</span>
                <span style={{ fontWeight: 700, color: "#0f766e", background: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #ccfbf1", fontSize: "0.6875rem" }}>
                  {dailyRate.toFixed(1)} {formatUnit(unit)}/day
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="100"
                step="0.5"
                value={dailyRate}
                onChange={(e) => setDailyRate(parseFloat(e.target.value))}
                className="coord-slider"
                style={{ width: "100%", accentColor: "#0f766e", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", color: "#94a3b8", marginTop: "3px" }}>
                <span>0.5/d</span>
                <span>25/d</span>
                <span>50/d</span>
                <span>75/d</span>
                <span>100/d</span>
              </div>
            </div>

            {/* Forecast Horizon Slider */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                <span>Planning Horizon</span>
                <span style={{ fontWeight: 700, color: "#0f766e", background: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #ccfbf1", fontSize: "0.6875rem" }}>
                  {horizonDays} days
                </span>
              </div>
              <input
                type="range"
                min="7"
                max="90"
                step="1"
                value={horizonDays}
                onChange={(e) => setHorizonDays(parseInt(e.target.value, 10))}
                className="coord-slider"
                style={{ width: "100%", accentColor: "#0f766e", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", color: "#94a3b8", marginTop: "3px" }}>
                <span>7d</span>
                <span>14d</span>
                <span>30d</span>
                <span>60d</span>
                <span>90d</span>
              </div>
            </div>
          </div>

          {/* Dynamic Re-computed Outcome Cards (OpenIntelligentUI pattern) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
              textAlign: "center",
            }}
          >
            <div style={{ background: "#ffffff", padding: "10px 8px", borderRadius: "10px", border: "1px solid #99f6e4", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                Days of Supply
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "#0f766e", margin: "2px 0 0", display: "block" }}>
                {daysOfSupply > 365 ? "> 1 year" : `${daysOfSupply} days`}
              </span>
              <span style={{ fontSize: "0.625rem", color: "#94a3b8" }}>at simulated burn</span>
            </div>

            <div style={{ background: "#ffffff", padding: "10px 8px", borderRadius: "10px", border: "1px solid #99f6e4", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                Projected {horizonDays}d Burn
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: "2px 0 0", display: "block" }}>
                {projectedBurn.toLocaleString()}
              </span>
              <span style={{ fontSize: "0.625rem", color: "#94a3b8" }}>{formatUnit(unit, projectedBurn)} dispensed</span>
            </div>

            <div
              style={{
                padding: "10px 8px",
                borderRadius: "10px",
                border: `1px solid ${willDeplete ? "#fecdd3" : "#99f6e4"}`,
                background: willDeplete ? "#fff1f2" : "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                Projected Balance
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: willDeplete ? "#be123c" : "#15803d", margin: "2px 0 0", display: "block" }}>
                {projectedBalance.toLocaleString()} {formatUnit(unit, projectedBalance)}
              </span>
              <span style={{ fontSize: "0.625rem", fontWeight: 600, color: willDeplete ? "#e11d48" : "#16a34a", display: "inline-flex", alignItems: "center", gap: 3 }}>
                {willDeplete ? (
                  <>
                    <AlertTriangle size={11} aria-hidden="true" /> Below Safety
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={11} aria-hidden="true" /> Within Safety
                  </>
                )}
              </span>
            </div>
          </div>

          <p style={{ fontSize: "0.6875rem", color: "#64748b", margin: 0, fontStyle: "italic", lineHeight: 1.4 }}>
            Simulation computed based on authoritative {usable.toLocaleString()} {formatUnit(unit, usable)} usable stock. Physical ledger balances remain unchanged until clinical directives commit.
          </p>
        </div>
      )}

      {/* ── Batch and Expiry Footer ── */}
      {earliestBatch && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            fontSize: "0.75rem",
            color: "#475569",
            background: "#ffffff",
            borderBottom: onQuickAction ? "1px solid #f1f5f9" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Clock size={12} color="#94a3b8" />
            <span>
              Batch <strong style={{ fontWeight: 600, color: "#1e293b" }}>{earliestBatch.batch_number}</strong>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Calendar size={12} color="#94a3b8" />
            <span
              style={{
                fontWeight: 600,
                color: earliestBatch.days_to_expiry < 60 ? "#b45309" : "#475569",
              }}
            >
              Expires in {earliestBatch.days_to_expiry} days
            </span>
          </div>
        </div>
      )}

      {/* ── Quick Action Buttons ── */}
      {onQuickAction && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "8px 16px",
            background: "#f8fafc",
            fontSize: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={() =>
              onQuickAction(
                `What is the 30-day forecast demand and consumption rate for ${medicine}?`
              )
            }
            className="coord-chip-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 12px",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f766e",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <TrendingUp size={12} />
            <span>Forecast Demand</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onQuickAction(
                `Find hospitals that can donate ${medicine} to ${facility}`
              )
            }
            className="coord-chip-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 12px",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <ShieldCheck size={12} />
            <span>Check Donors</span>
          </button>
        </div>
      )}
    </div>
  );
}
