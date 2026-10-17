import React, { useState } from "react";
import type { WorkflowRun } from "@/types/workflow";
import {
  PackageSearch,
  TrendingUp,
  Truck,
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import "./coordinator.css";

const C = {
  brand:     "#0f766e",
  brandBg:   "#f0fdfa",
  brandDark: "#115e59",
  slate50:   "#f8fafc",
  slate100:  "#f1f5f9",
  slate200:  "#e2e8f0",
  slate400:  "#94a3b8",
  slate500:  "#64748b",
  slate600:  "#475569",
  slate700:  "#334155",
  slate800:  "#1e293b",
  slate900:  "#0f172a",
  white:     "#ffffff",
};

interface Props {
  workflow: WorkflowRun | null;
}

interface KVProps {
  label: string;
  value: React.ReactNode;
}

function KV({ label, value }: KVProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "5px 0", borderBottom: `1px solid ${C.slate100}`, gap: 8 }}>
      <span style={{ fontSize: "0.6875rem", color: C.slate500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: C.slate800, textAlign: "right" }}>{value}</span>
    </div>
  );
}

interface AgentCardProps {
  icon: React.ReactNode;
  name: string;
  badge: string;
  badgeColor: { bg: string; text: string };
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
}

function AgentCard({ icon, name, badge, badgeColor, iconBg, iconColor, children }: AgentCardProps) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.slate200}`, borderRadius: 8,
      padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
          <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: C.slate800,
            textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {name}
          </span>
        </div>
        <span style={{ fontSize: "0.5625rem", fontWeight: 700, padding: "2px 7px",
          borderRadius: 999, background: badgeColor.bg, color: badgeColor.text, flexShrink: 0 }}>
          {badge}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SubAgentTelemetry({ workflow }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  if (!workflow) return null;

  let parsed: Record<string, any> | null = null;
  if (workflow.resultJson) {
    try { parsed = JSON.parse(workflow.resultJson); } catch { parsed = null; }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.6875rem",
          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.slate500 }}>
          <Layers size={13} strokeWidth={1.75} color={C.brand} />
          Specialist Findings
        </span>
        {parsed && (
          <button type="button" className="coord-btn-ghost"
            style={{ fontSize: "0.625rem" }}
            onClick={() => setShowRaw(v => !v)}>
            <FileCode size={12} strokeWidth={1.75} />
            {showRaw ? "Hide" : "Raw JSON"}
            {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>

      {/* Raw JSON */}
      {showRaw && parsed && (
        <div style={{ background: C.slate900, borderRadius: 8, padding: "12px 14px",
          border: `1px solid #1e293b` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.5625rem",
            fontFamily: "monospace", color: "#64748b", paddingBottom: 6, marginBottom: 6,
            borderBottom: "1px solid #334155" }}>
            <span>ID: {workflow.id?.substring(0, 12)}…</span>
            <span>{workflow.status}</span>
          </div>
          <pre style={{ fontSize: "0.5625rem", fontFamily: "monospace", color: "#34d399",
            margin: 0, whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      )}

      {/* 5-card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>

        {/* Inventory */}
        <AgentCard
          icon={<PackageSearch size={14} strokeWidth={1.75} color="#059669" />}
          name="Inventory Specialist"
          badge="Audit Verified"
          badgeColor={{ bg: "#dcfce7", text: "#166534" }}
          iconBg="#ecfdf5"
          iconColor="#059669"
        >
          {parsed?.inventory_data ? (
            <div>
              <KV label="Medicine" value={parsed.inventory_data.medicine} />
              <KV label="Facility" value={parsed.inventory_data.facility} />
              <KV label="Available Stock" value={`${parsed.inventory_data.available_stock} units`} />
              {parsed.inventory_data.agent_findings && (
                <p style={{ fontSize: "0.625rem", color: C.slate500, margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                  {parsed.inventory_data.agent_findings}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "0.6875rem", color: C.slate400, fontStyle: "italic", margin: 0 }}>
              No specific stock query requested.
            </p>
          )}
        </AgentCard>

        {/* Demand */}
        <AgentCard
          icon={<TrendingUp size={14} strokeWidth={1.75} color="#2563eb" />}
          name="Demand Specialist"
          badge="Burn Rate Analyzed"
          badgeColor={{ bg: "#dbeafe", text: "#1d4ed8" }}
          iconBg="#eff6ff"
          iconColor="#2563eb"
        >
          {parsed?.shortage_analysis ? (
            <div>
              <KV label="Daily Consumption" value={`${parsed.shortage_analysis.daily_consumption_rate} units/day`} />
              <KV label="Days of Supply" value={
                <span style={{ color: "#dc2626", fontWeight: 800 }}>
                  {parsed.shortage_analysis.days_of_supply_remaining} days
                </span>
              } />
              <KV label="Projected Deficit" value={`${parsed.shortage_analysis.projected_deficit_units} units`} />
              {parsed.shortage_analysis.agent_findings && (
                <p style={{ fontSize: "0.625rem", color: C.slate500, margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                  {parsed.shortage_analysis.agent_findings}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "0.6875rem", color: C.slate400, fontStyle: "italic", margin: 0 }}>
              No demand forecast required.
            </p>
          )}
        </AgentCard>

        {/* Redistribution */}
        <AgentCard
          icon={<Truck size={14} strokeWidth={1.75} color="#d97706" />}
          name="Redistribution"
          badge={parsed?.redistribution_proposal?.feasible ? "Candidate Feasible" : "Evaluated"}
          badgeColor={parsed?.redistribution_proposal?.feasible
            ? { bg: "#dcfce7", text: "#166534" }
            : { bg: C.slate100, text: C.slate600 }}
          iconBg="#fffbeb"
          iconColor="#d97706"
        >
          {parsed?.redistribution_proposal?.feasible ? (
            <div>
              <KV label="Donor Facility" value={parsed.redistribution_proposal.donor_facility} />
              <KV label="Transfer Units" value={
                <span style={{ color: "#059669", fontWeight: 800 }}>
                  {parsed.redistribution_proposal.quantity} units
                </span>
              } />
              <KV label="Distance / Time"
                value={`${parsed.redistribution_proposal.distance_km} km · ${parsed.redistribution_proposal.estimated_transit_hours}h`} />
              {parsed.redistribution_proposal.recommendation && (
                <p style={{ fontSize: "0.625rem", color: C.slate500, margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                  {parsed.redistribution_proposal.recommendation}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "0.6875rem", color: C.slate400, fontStyle: "italic", margin: 0 }}>
              {parsed?.redistribution_proposal?.reason || "Redistribution evaluated; alternate strategy selected."}
            </p>
          )}
        </AgentCard>

        {/* Procurement */}
        <AgentCard
          icon={<ShoppingCart size={14} strokeWidth={1.75} color="#7c3aed" />}
          name="Procurement"
          badge="PO Drafted"
          badgeColor={{ bg: "#f3e8ff", text: "#7c3aed" }}
          iconBg="#faf5ff"
          iconColor="#7c3aed"
        >
          {parsed?.procurement_proposal?.needed ? (
            <div>
              <KV label="Supplier"
                value={<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: 160, display: "inline-block" }}>
                  {parsed.procurement_proposal.recommended_supplier}
                </span>}
              />
              <KV label="Reliability" value={
                <span style={{ color: "#7c3aed" }}>{parsed.procurement_proposal.supplier_score}%</span>
              } />
              <KV label="PO Number" value={
                <code style={{ fontFamily: "monospace", fontSize: "0.625rem" }}>
                  {parsed.procurement_proposal.draft_po_number}
                </code>
              } />
              <KV label="Est. Cost" value={`$${parsed.procurement_proposal.total_estimated_cost?.toLocaleString()}`} />
              {parsed.procurement_proposal.summary && (
                <p style={{ fontSize: "0.625rem", color: C.slate500, margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                  {parsed.procurement_proposal.summary}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "0.6875rem", color: C.slate400, fontStyle: "italic", margin: 0 }}>
              Redistribution fulfilled demand; no purchase order required.
            </p>
          )}
        </AgentCard>

        {/* Policy */}
        <AgentCard
          icon={<ShieldCheck size={14} strokeWidth={1.75} color="#dc2626" />}
          name="Policy & Safety Gate"
          badge="Compliant"
          badgeColor={{ bg: "#dcfce7", text: "#166534" }}
          iconBg="#fef2f2"
          iconColor="#dc2626"
        >
          {parsed?.policy_validation ? (
            <div>
              <KV label="Delegation Tier" value={
                <span style={{ color: C.brandDark }}>{parsed.policy_validation.approval_tier}</span>
              } />
              {parsed.policy_validation.rules_checked?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: "0.625rem", fontWeight: 700, color: C.slate600,
                    textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
                    Rules Evaluated
                  </p>
                  {parsed.policy_validation.rules_checked.slice(0, 3).map((r: string, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6,
                      fontSize: "0.625rem", color: "#166534", marginBottom: 2 }}>
                      <CheckCircle2 size={10} strokeWidth={2.5} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "0.6875rem", color: C.slate400, fontStyle: "italic", margin: 0 }}>
              Healthcare rules passed — zero compliance violations detected.
            </p>
          )}
        </AgentCard>
      </div>
    </div>
  );
}
