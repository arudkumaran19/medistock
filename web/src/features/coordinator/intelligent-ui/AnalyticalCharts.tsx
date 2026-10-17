import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { TrendingDown, ShieldAlert, Truck, DollarSign } from "lucide-react";

// ── 1. Stock vs Minimum Threshold Chart ─────────────────────────────────────
interface StockThresholdChartProps {
  medicine: string;
  usableStock: number;
  reservedStock: number;
  minimumThreshold: number;
  unit?: string;
  facilities?: Array<{
    facility: string;
    available_stock: number;
    reserved_stock?: number;
    stock_on_hand?: number;
    minimum_stock_threshold?: number;
    status?: string;
  }>;
  className?: string;
}

export function StockThresholdChart({
  medicine,
  usableStock,
  reservedStock,
  minimumThreshold,
  unit = "units",
  facilities,
  className = "",
}: StockThresholdChartProps) {
  const data = facilities && facilities.length > 0
    ? facilities.map((f) => ({
        name: f.facility.replace(" Hospital", "").replace(" Community Clinic", "").replace(" Public Dispensary", ""),
        Usable: f.available_stock,
        Reserved: f.reserved_stock ?? 0,
        "Min Threshold": f.minimum_stock_threshold || minimumThreshold,
      }))
    : [
        {
          name: "Current Levels",
          Usable: usableStock,
          Reserved: reservedStock,
          "Min Threshold": minimumThreshold,
        },
      ];

  return (
    <div
      className={className}
      style={{
        margin: "12px 0",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ShieldAlert size={14} color="#0f766e" />
          <h5
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            Stock Buffer vs. Safety Threshold: {medicine}
          </h5>
        </div>
        <span style={{ fontSize: "0.625rem", color: "#94a3b8", fontWeight: 500 }}>
          Authoritative Level
        </span>
      </div>

      <div style={{ height: 176, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
            <Tooltip
              formatter={(val: any, name: any) => [
                `${Number(val ?? 0).toLocaleString()} ${unit}`,
                String(name ?? ""),
              ]}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e2e8f0",
                fontSize: 11,
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
            <ReferenceLine
              y={minimumThreshold}
              label={{
                value: `Min: ${minimumThreshold} ${unit}`,
                fill: "#e11d48",
                fontSize: 10,
                position: "insideTopRight",
              }}
              stroke="#e11d48"
              strokeDasharray="4 4"
            />
            <Bar dataKey="Usable" fill="#0d9488" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Reserved" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p
        style={{
          marginTop: 8,
          fontSize: "0.625rem",
          color: "#94a3b8",
          textAlign: "center",
          margin: "8px 0 0",
        }}
      >
        Green bar represents immediately dispensable stock. Dashed red line indicates policy safety threshold.
      </p>
    </div>
  );
}

// ── 2. Demand Depletion Runway Chart ────────────────────────────────────────
interface DemandRunwayChartProps {
  medicine: string;
  usableStock: number;
  dailyConsumptionRate: number;
  daysOfSupply: number;
  forecastHorizonDays?: number;
  unit?: string;
  className?: string;
}

export function DemandRunwayChart({
  medicine,
  usableStock,
  dailyConsumptionRate,
  daysOfSupply,
  forecastHorizonDays = 30,
  unit = "units",
  className = "",
}: DemandRunwayChartProps) {
  // Generate projection points
  const points = [];
  const step = Math.max(1, Math.floor(forecastHorizonDays / 6));
  for (let d = 0; d <= forecastHorizonDays; d += step) {
    const projected = Math.max(0, Math.round(usableStock - dailyConsumptionRate * d));
    points.push({
      day: `Day ${d}`,
      "Stock Runway": projected,
    });
  }

  const isStockoutExpected = daysOfSupply < forecastHorizonDays;

  return (
    <div
      className={className}
      style={{
        margin: "12px 0",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingDown size={14} color="#0f766e" />
          <h5
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            {forecastHorizonDays}-Day Demand Runway &amp; Burn Rate: {medicine}
          </h5>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: "0.625rem",
            fontWeight: 700,
            background: isStockoutExpected ? "#fff1f2" : "#f0fdf4",
            color: isStockoutExpected ? "#be123c" : "#15803d",
            border: `1px solid ${isStockoutExpected ? "#fecdd3" : "#bbf7d0"}`,
          }}
        >
          {daysOfSupply.toFixed(1)} Days Runway
        </span>
      </div>

      <div style={{ height: 176, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
            <Tooltip
              formatter={(val: any) => [
                `${Number(val ?? 0).toLocaleString()} ${unit}`,
                "Projected Balance",
              ]}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e2e8f0",
                fontSize: 11,
                borderRadius: 8,
              }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Line
              type="monotone"
              dataKey="Stock Runway"
              stroke="#0f766e"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#0f766e" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.625rem",
          color: "#64748b",
          background: "#f8fafc",
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #f1f5f9",
        }}
      >
        <span>Burn Rate: ~{dailyConsumptionRate.toFixed(1)} {unit}/day</span>
        <span>
          {isStockoutExpected ? (
            <strong style={{ color: "#e11d48" }}>Stockout in {daysOfSupply.toFixed(1)} days</strong>
          ) : (
            <strong style={{ color: "#059669" }}>Sufficient for {forecastHorizonDays} days</strong>
          )}
        </span>
      </div>
    </div>
  );
}

// ── 3. Regional Donor Surplus Comparison Chart ──────────────────────────────
interface DonorComparisonChartProps {
  candidates: Array<{
    facility: string;
    surplus: number;
    distance_km: number;
    transit_hours: number;
  }>;
  unit?: string;
  className?: string;
}

export function DonorComparisonChart({
  candidates,
  unit: _unit = "units",
  className = "",
}: DonorComparisonChartProps) {
  if (!candidates || candidates.length === 0) return null;

  const data = candidates.map((c) => ({
    name: c.facility.replace(" Hospital", "").replace(" Community Clinic", ""),
    Surplus: c.surplus,
    "Distance (km)": c.distance_km,
  }));

  return (
    <div
      className={className}
      style={{
        margin: "12px 0",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Truck size={14} color="#0f766e" />
          <h5
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            Regional Donor Candidates (Surplus vs. Distance)
          </h5>
        </div>
        <span style={{ fontSize: "0.625rem", color: "#94a3b8" }}>Within 50km radius</span>
      </div>

      <div style={{ height: 176, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e2e8f0",
                fontSize: 11,
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="Surplus" fill="#0d9488" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Distance (km)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p
        style={{
          marginTop: 8,
          fontSize: "0.625rem",
          color: "#94a3b8",
          textAlign: "center",
          margin: "8px 0 0",
        }}
      >
        Optimized by proximity and surplus preservation. Safety reserve rules prevent donor depletion.
      </p>
    </div>
  );
}

// ── 4. Supplier Pricing & Lead Time Comparison Chart ────────────────────────
interface SupplierComparisonChartProps {
  suppliers: Array<{
    name: string;
    unit_price: number;
    lead_time_days: number;
    score?: number;
  }>;
  className?: string;
}

export function SupplierComparisonChart({
  suppliers,
  className = "",
}: SupplierComparisonChartProps) {
  if (!suppliers || suppliers.length === 0) return null;

  const data = suppliers.map((s) => ({
    name: s.name.replace(" State Pharmaceuticals", "SPMC").substring(0, 15),
    "Price ($)": s.unit_price,
    "Lead Time (Days)": s.lead_time_days,
  }));

  return (
    <div
      className={className}
      style={{
        margin: "12px 0",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <DollarSign size={14} color="#0f766e" />
          <h5
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            Supplier Multi-Criteria Evaluation (Price vs. Lead Time)
          </h5>
        </div>
        <span style={{ fontSize: "0.625rem", color: "#94a3b8" }}>Verified Vendors</span>
      </div>

      <div style={{ height: 176, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e2e8f0",
                fontSize: 11,
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="Price ($)" fill="#0284c7" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Lead Time (Days)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p
        style={{
          marginTop: 8,
          fontSize: "0.625rem",
          color: "#94a3b8",
          textAlign: "center",
          margin: "8px 0 0",
        }}
      >
        Ranked through multi-criteria decision scoring balancing unit economics and clinical urgency.
      </p>
    </div>
  );
}
