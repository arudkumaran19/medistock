import type { SampleScenario } from "./types";

export const ALL_SCENARIOS: SampleScenario[] = [
  {
    id: "shortage-redistrib",
    category: "Shortage & Redistribution",
    title: "Regional Shortage & Donor Transfer",
    subAgents: ["Demand", "Inventory", "Redistribution"],
    prompt:
      "Critical shortage of Paracetamol 500mg at Colombo General Hospital. Audit local inventory, check regional donor hospitals within 50km (e.g. Kandy Base Hospital), and prepare an immediate emergency transfer proposal.",
    rolesAllowed: ["FacilityManager", "Administrator", "OperationalStaff"],
  },
  {
    id: "forecast-procure",
    category: "Demand & Procurement",
    title: "60-Day Forecast & PO Generation",
    subAgents: ["Demand", "Procurement", "Policy Gate"],
    prompt:
      "Forecast 60-day consumption burn rate for Amoxicillin 500mg, identify supplier stockout risk, score verified suppliers, and draft an autonomous purchase order with SPMC under policy compliance.",
    rolesAllowed: ["FacilityManager", "Administrator", "SupplierOfficer"],
  },
  {
    id: "end-to-end-crisis",
    category: "End-to-End Supply Chain",
    title: "Dual Strategy: Redistribute + Procure",
    subAgents: ["Inventory", "Demand", "Redistribution", "Procurement", "Policy Gate"],
    prompt:
      "Multi-facility emergency audit: Assess Insulin Regular 100IU stock across Central and Colombo clinics, calculate deficit velocity, and optimize a dual strategy: redistribute existing regional surplus and trigger procurement for the residual shortfall.",
    rolesAllowed: ["FacilityManager", "Administrator"],
  },
  {
    id: "expiry-prevention",
    category: "Waste Prevention",
    title: "Near-Expiry Batch Redistribution",
    subAgents: ["Inventory", "Demand", "Redistribution"],
    prompt:
      "Identify batches of Metformin 500mg expiring within 90 days. Calculate current facility consumption vs shelf life, identify higher-consumption recipient facilities, and prepare redistribution transfers to prevent stock expiry waste.",
    rolesAllowed: ["FacilityManager", "Administrator", "OperationalStaff"],
  },
  {
    id: "high-value-policy",
    category: "Financial Governance",
    title: "High-Value Procurement Policy Gate",
    subAgents: ["Procurement", "Policy Gate"],
    prompt:
      "Draft emergency procurement order for 5,000 units of Salbutamol Inhaler 100mcg exceeding the $25,000 threshold. Verify single-source limits, run lead-time checks, and route for Ministry Governance authorization.",
    rolesAllowed: ["FacilityManager", "Administrator"],
  },
  {
    id: "store-stock-audit",
    category: "Store Audit",
    title: "Facility Floor Balance & Reserve Audit",
    subAgents: ["Inventory", "Demand"],
    prompt:
      "Perform a physical inventory reconciliation for Ciprofloxacin 500mg. Cross-reference batch reserves against daily dispensary issues and flag any critical discrepancy.",
    rolesAllowed: ["OperationalStaff", "FacilityManager", "Administrator"],
  },
  {
    id: "supplier-lead-time-audit",
    category: "Vendor Performance",
    title: "Supplier Lead-Time & Scorecard Audit",
    subAgents: ["Procurement", "Demand"],
    prompt:
      "Evaluate performance and reliability scores for state pharmaceutical suppliers supplying Ceftriaxone 1g. Compare historical delivery latency against contracted lead times.",
    rolesAllowed: ["SupplierOfficer", "Administrator"],
  },
];

export function getScenariosForRoles(roles: string[]): SampleScenario[] {
  const isAdmin = roles.includes("Administrator") || roles.includes("ADMIN");
  if (isAdmin) return ALL_SCENARIOS;

  return ALL_SCENARIOS.filter((s) => {
    if (!s.rolesAllowed) return true;
    return s.rolesAllowed.some((r) => roles.includes(r));
  });
}
