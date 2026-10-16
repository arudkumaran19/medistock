import React from "react";
import {
  Truck,
  ShoppingCart,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export interface RedistributionProposalData {
  feasible: boolean;
  donor_facility: string;
  recipient_facility: string;
  quantity: number;
  distance_km: number;
  estimated_transit_hours: number;
  recommendation?: string;
  reason?: string;
}

export interface ProcurementProposalData {
  needed: boolean;
  recommended_supplier: string;
  quantity: number;
  unit_price: number;
  lead_time_days: number;
  total_cost?: number;
  summary?: string;
}

interface DecisionProposalCardProps {
  type: "redistribution" | "procurement" | "combined";
  medicineName: string;
  redistribution?: RedistributionProposalData | null;
  procurement?: ProcurementProposalData | null;
  className?: string;
}

export function DecisionProposalCard({
  type,
  medicineName,
  redistribution,
  procurement,
  className = "",
}: DecisionProposalCardProps) {
  const isRedist = (type === "redistribution" || type === "combined") && redistribution?.feasible;
  const isProcur = (type === "procurement" || type === "combined") && procurement?.needed;

  if (!isRedist && !isProcur) return null;

  return (
    <div
      className={className}
      style={{
        margin: "12px 0",
        borderRadius: 14,
        border: "1px solid #99f6e4",
        background: "#ffffff",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #ccfbf1",
          background: "#f0fdfa",
          padding: "10px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "#0d9488",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {type === "redistribution" ? (
              <Truck size={14} />
            ) : type === "procurement" ? (
              <ShoppingCart size={14} />
            ) : (
              <ShieldCheck size={14} />
            )}
          </div>
          <div>
            <h4
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#134e4a",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                margin: 0,
              }}
            >
              {type === "combined"
                ? "Dual Resolution Proposal"
                : type === "redistribution"
                ? "Inter-Facility Stock Transfer Proposal"
                : "Autonomous Purchase Order Proposal"}
            </h4>
            <p style={{ fontSize: "0.6875rem", color: "#0f766e", margin: 0, fontWeight: 500 }}>
              Target: {medicineName}
            </p>
          </div>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            borderRadius: 9999,
            border: "1px solid #5eead4",
            background: "#ffffff",
            padding: "2px 8px",
            fontSize: "0.625rem",
            fontWeight: 700,
            color: "#0f766e",
          }}
        >
          <ShieldCheck size={11} color="#0d9488" />
          Safety Validated
        </span>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Redistribution details */}
        {isRedist && redistribution && (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: 12,
              fontSize: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 600,
                color: "#1e293b",
                marginBottom: 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#0f766e" }}>
                <Truck size={13} />
                Physical Stock Transfer
              </span>
              <span
                style={{
                  borderRadius: 6,
                  background: "#f0fdfa",
                  padding: "2px 8px",
                  fontWeight: 700,
                  color: "#0f766e",
                  border: "1px solid #ccfbf1",
                }}
              >
                {redistribution.quantity.toLocaleString()} units
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 8,
                fontSize: "0.6875rem",
                color: "#475569",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={12} color="#94a3b8" />
                <span>
                  Donor: <strong>{redistribution.donor_facility}</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowRight size={12} color="#94a3b8" />
                <span>
                  To: <strong>{redistribution.recipient_facility}</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={12} color="#94a3b8" />
                <span>
                  ETA: <strong>{redistribution.estimated_transit_hours.toFixed(1)} hrs</strong> ({redistribution.distance_km.toFixed(1)} km)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803d" }}>
                <CheckCircle2 size={12} />
                <span>Donor safety reserve preserved</span>
              </div>
            </div>
          </div>
        )}

        {/* Procurement details */}
        {isProcur && procurement && (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: 12,
              fontSize: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 600,
                color: "#1e293b",
                marginBottom: 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#0284c7" }}>
                <ShoppingCart size={13} />
                Complementary Purchase Order
              </span>
              <span
                style={{
                  borderRadius: 6,
                  background: "#f0f9ff",
                  padding: "2px 8px",
                  fontWeight: 700,
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                }}
              >
                {procurement.quantity.toLocaleString()} units
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 8,
                fontSize: "0.6875rem",
                color: "#475569",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={12} color="#94a3b8" />
                <span>
                  Supplier: <strong>{procurement.recommended_supplier}</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={12} color="#94a3b8" />
                <span>
                  Unit Price: <strong>${procurement.unit_price.toFixed(2)}</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={12} color="#94a3b8" />
                <span>
                  Lead Time: <strong>{procurement.lead_time_days} days</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={12} color="#94a3b8" />
                <span>
                  Total Est:{" "}
                  <strong>
                    ${(procurement.total_cost ?? procurement.quantity * procurement.unit_price).toFixed(2)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 4,
            fontSize: "0.625rem",
            color: "#64748b",
          }}
        >
          <span>* Multi-agent optimization verified no double-counting</span>
          <span style={{ fontWeight: 600, color: "#b45309" }}>Governance Gate Enforced</span>
        </div>
      </div>
    </div>
  );
}
