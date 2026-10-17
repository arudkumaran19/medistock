import React from "react";
import { Sparkles, ArrowRight } from "lucide-react";

interface ContextualFollowUpsProps {
  intent?: string;
  medicineName?: string;
  facilityName?: string;
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

export function ContextualFollowUps({
  intent,
  medicineName,
  facilityName,
  onSelectPrompt,
  disabled = false,
}: ContextualFollowUpsProps) {
  const med = medicineName || "Paracetamol 500 mg";
  const fac = facilityName || "Central Facility";

  let suggestions: { label: string; prompt: string }[];

  switch (intent) {
    case "InventoryAudit":
      suggestions = [
        {
          label: `Forecast 30-day demand for ${med}`,
          prompt: `What is the 30-day forecast demand and consumption rate for ${med}?`,
        },
        {
          label: "View all medicine stocks",
          prompt: "What medicines are available and what are their total stocks?",
        },
        {
          label: `Check expiry batches for ${med}`,
          prompt: `Inspect active batches and expiry schedule for ${med} at ${fac}`,
        },
      ];
      break;

    case "CatalogueQuery":
      suggestions = [
        {
          label: "Show low stock items only",
          prompt: "Which registered medicines are currently below their minimum safety thresholds?",
        },
        {
          label: "View facility-wise breakdown",
          prompt: "Show the stock versus minimum threshold chart for distinct facilities",
        },
        {
          label: "Generate procurement recommendations",
          prompt: "Draft autonomous procurement proposals for medicines in critical deficit",
        },
        {
          label: "Check expiry dates",
          prompt: "Which batches across our facilities expire within the next 90 days?",
        },
      ];
      break;

    case "DemandForecast":
      suggestions = [
        {
          label: "Evaluate regional donor transfer",
          prompt: `Find hospitals that can donate ${med} to ${fac}`,
        },
        {
          label: "Compare supplier quotes",
          prompt: `Compare verified supplier options, pricing, and lead times for ${med}`,
        },
        {
          label: `Audit usable stock for ${med}`,
          prompt: `How much stock do we currently have of ${med} at ${fac}?`,
        },
      ];
      break;

    case "ShortageAnalysis":
      suggestions = [
        {
          label: "Evaluate donor transfer feasibility",
          prompt: `Find hospitals that can donate ${med}`,
        },
        {
          label: "Compare supplier lead times",
          prompt: `Compare suppliers and prices for ${med}`,
        },
        {
          label: "Simulate 60-day runway",
          prompt: `Calculate 60-day demand forecast for ${med} at ${fac}`,
        },
      ];
      break;

    case "ExpiryAudit":
      suggestions = [
        {
          label: "Check 30-day critical batches",
          prompt: "Which batches across our facilities expire within the next 30 days?",
        },
        {
          label: "View full medicine catalogue",
          prompt: "What medicines are available and what are their total stocks?",
        },
        {
          label: "Redistribute Paracetamol surplus",
          prompt: "Find hospitals that can donate Paracetamol 500 mg to Central Facility",
        },
      ];
      break;


    default:
      suggestions = [
        {
          label: "List all available medicines",
          prompt: "What medicines are available and what are their total stocks?",
        },
        {
          label: "Check Paracetamol 500 mg stock",
          prompt: "What is the current stock of Paracetamol 500 mg?",
        },
        {
          label: "Forecast demand for Omeprazole",
          prompt: "What is the 30-day forecast demand and consumption rate for Omeprazole 20 mg?",
        },
      ];
      break;
  }

  if (suggestions.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 10,
        borderTop: "1px solid #f1f5f9",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "#64748b",
          marginBottom: 8,
        }}
      >
        <Sparkles size={12} color="#0d9488" />
        <span>Suggested Follow-Ups:</span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: "#334155",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 9999,
              cursor: disabled ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
              transition: "all 120ms ease",
              opacity: disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = "#f0fdfa";
                e.currentTarget.style.borderColor = "#99f6e4";
                e.currentTarget.style.color = "#0f766e";
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.color = "#334155";
              }
            }}
          >
            <span>{item.label}</span>
            <ArrowRight size={10} color="#94a3b8" />
          </button>
        ))}
      </div>
    </div>
  );
}
