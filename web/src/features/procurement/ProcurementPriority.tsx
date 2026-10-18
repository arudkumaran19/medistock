import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ProcurementAgentPanel } from "./ProcurementAgentPanel";
import {
  procurementApi,
  type SupplierItem,
  type ValidateProcurementResponse,
} from "../../services/procurementApi";
import { apiRequest } from "../../services/apiClient";
import { PageHeader, KPICard } from "../../components/ui";
import styles from "./ProcurementPages.module.css";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  X,
  Building2,
  Pill,
} from "lucide-react";

interface InventoryMedicineItem {
  id: string;
  name: string;
  code: string;
  unit?: string;
  minimumStockLevel?: number;
  currentStock?: number;
  minimumStock?: number;
  unitPrice?: number;
}

interface FacilityOption {
  id: string;
  name: string;
  code?: string;
  isActive?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export function ProcurementPriority() {
  const queryClient = useQueryClient();
  const [medicines, setMedicines] = useState<InventoryMedicineItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Policy validation test state
  const [validationResult, setValidationResult] = useState<ValidateProcurementResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  function getReplenishmentQuantity(med: InventoryMedicineItem): number {
    const minThreshold = med.minimumStockLevel ?? med.minimumStock ?? 100;
    return Math.max(minThreshold, 10);
  }

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [medList, supList, facList] = await Promise.all([
        apiRequest<InventoryMedicineItem[]>("/api/medicines"),
        procurementApi.getSuppliers(undefined, true),
        apiRequest<FacilityOption[]>("/api/facilities"),
      ]);
      const validFacilities = Array.isArray(facList)
        ? facList.filter((f) => f && f.id && f.isActive !== false)
        : [];
      setMedicines(medList || []);
      setSuppliers(supList || []);
      setFacilities(validFacilities);
      if (validFacilities.length > 0 && (!selectedFacilityId || !validFacilities.some((f) => f.id === selectedFacilityId))) {
        setSelectedFacilityId(validFacilities[0].id);
      }
      if (supList.length > 0 && (!selectedSupplierId || !supList.some((s) => s.id === selectedSupplierId))) {
        setSelectedSupplierId(supList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog data.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedFacilityId, selectedSupplierId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleTestValidation(med: InventoryMedicineItem) {
    const facilityId = selectedFacilityId || facilities[0]?.id;
    const supplierId = selectedSupplierId || suppliers[0]?.id;
    const qty = getReplenishmentQuantity(med);

    if (!facilityId) {
      setError("Select a target healthcare facility before checking policy compliance.");
      return;
    }
    if (!supplierId) {
      setError("Select a supplier before checking policy compliance.");
      return;
    }

    setIsValidating(true);
    setError(null);
    try {
      const result = await procurementApi.validateProcurement({
        facilityId,
        supplierId,
        items: [
          {
            medicineId: med.id,
            requestedQuantity: qty,
            unitPrice: med.unitPrice || 12.5,
          },
        ],
      });
      setValidationResult(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? "Policy validation could not be completed. Please try again."
          : "Policy validation could not be completed. Please try again."
      );
    } finally {
      setIsValidating(false);
    }
  }

  async function handleFastReplenish(med: InventoryMedicineItem) {
    const facilityId = selectedFacilityId || facilities[0]?.id;
    const supplierId = selectedSupplierId || suppliers[0]?.id;
    const qty = getReplenishmentQuantity(med);
    const unitName = med.unit ?? "units";

    if (!facilityId) {
      setError("No registered clinical facility selected.");
      return;
    }
    if (!supplierId) {
      setError("No active supplier selected to fulfill order.");
      return;
    }

    setError(null);
    try {
      const order = await procurementApi.createPurchaseOrder({
        supplierId,
        facilityId,
        items: [
          {
            medicineId: med.id,
            requestedQuantity: qty,
            unitPrice: med.unitPrice || 12.0,
          },
        ],
      });

      // Submit immediately so the requisition enters PendingApproval and appears on the Approvals & Workflow views
      await procurementApi.submitPurchaseOrder(order.id);

      setSuccessMessage(
        `Purchase order PO-${order.id.slice(0, 8)} created & submitted for approval for ${med.name} (${qty} ${unitName}).`
      );

      // Invalidate queries so that other screens / views update immediately
      void queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });

      window.dispatchEvent(
        new CustomEvent("medistock:approval-updated", {
          detail: { orderId: order.id, status: "PendingApproval" },
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Requisition creation failed. Please try again.");
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Replenishment Governance"
        title="Procurement Priorities"
        subtitle="Review clinical medications that require replenishment based on stock balances, run-rate demand, and institutional policies."
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/procurement/orders" className={styles.secondaryButton}>
              <FileText size={16} /> Purchase Orders Directory
            </Link>
          </div>
        }
      />

      {/* Summary KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Tracked Formulary"
          value={isLoading ? "…" : medicines.length}
          context="Catalog items evaluated"
          icon={<Pill size={20} />}
          accent="#0f766e"
        />
        <KPICard
          label="Accredited Suppliers"
          value={isLoading ? "…" : suppliers.length}
          context="Active approved vendors"
          icon={<Building2 size={20} />}
          accent="#2563eb"
        />
        <KPICard
          label="Clinical Sites"
          value={isLoading ? "…" : facilities.length}
          context="Connected hospital sites"
          icon={<Building2 size={20} />}
          accent="#7c3aed"
        />
        <KPICard
          label="AI Policy Gating"
          value="Active"
          context="Institutional compliance engine"
          icon={<Sparkles size={20} />}
          accent="#16a34a"
          variant="success"
        />
      </div>

      <ProcurementAgentPanel onOrderCreated={() => void loadData()} />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className={styles.successBanner} role="status">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {validationResult && (
        <div
          style={{
            background: !validationResult.isValid ? "#fef2f2" : validationResult.requiresApproval ? "#fffbeb" : "#f0fdf4",
            border: `1px solid ${!validationResult.isValid ? "#fecaca" : validationResult.requiresApproval ? "#fde68a" : "#bbf7d0"}`,
            padding: 18,
            borderRadius: 10,
            marginBottom: 24,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
          role="status"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!validationResult.isValid ? (
                <AlertCircle size={20} style={{ color: "#991b1b" }} />
              ) : validationResult.requiresApproval ? (
                <AlertTriangle size={20} style={{ color: "#92400e" }} />
              ) : (
                <CheckCircle2 size={20} style={{ color: "#166534" }} />
              )}
              <strong
                style={{
                  fontSize: "0.95rem",
                  color: !validationResult.isValid
                    ? "#991b1b"
                    : validationResult.requiresApproval
                    ? "#92400e"
                    : "#166534",
                }}
              >
                {!validationResult.isValid
                  ? "Policy Exception Identified"
                  : validationResult.requiresApproval
                  ? "Policy Review Required (High-Value / Bulk Rule)"
                  : "Institutional Policy Passed"}
              </strong>
            </div>
            <button
              type="button"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              onClick={() => setValidationResult(null)}
              aria-label="Dismiss validation result"
            >
              <X size={16} />
            </button>
          </div>
          <p style={{ margin: "8px 0 0 28px", fontSize: "0.875rem", color: "#1e293b" }}>
            {!validationResult.isValid
              ? validationResult.message
              : validationResult.requiresApproval
              ? "This request exceeds institutional thresholds ($10,000+ or 1,000+ units). Managerial approval sign-off will be triggered automatically upon submission."
              : "No policy blockers found. The requisition complies with hospital formulary and standard authorization limits."}
          </p>
          <p style={{ margin: "4px 0 0 28px", fontSize: "0.8125rem", color: "#64748b" }}>
            Estimated Order Value: <strong>${validationResult.totalEstimatedCost.toFixed(2)}</strong> • Supplier Lead Time: <strong>{validationResult.supplierLeadTimeDays} days</strong>
          </p>
        </div>
      )}

      {/* Target Parameters Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "16px 20px",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
            Target Clinical Facility {isLoading ? "(Loading...)" : `(${facilities.length} available)`}
          </label>
          {isLoading ? (
            <div style={{ fontSize: "0.875rem", color: "#64748b", padding: "8px 0" }}>Loading authorized facilities…</div>
          ) : facilities.length === 0 ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>No eligible active facilities found.</span>
              <button
                type="button"
                onClick={() => void loadData()}
                style={{ fontSize: "0.75rem", padding: "3px 8px", cursor: "pointer" }}
              >
                Retry
              </button>
            </div>
          ) : (
            <select
              className={styles.filterSelect}
              style={{ width: "100%" }}
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              aria-label="Target Healthcare Facility"
            >
              {facilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} {fac.code ? `(${fac.code})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
            Primary Vendor Partner
          </label>
          {suppliers.length === 0 ? (
            <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>No active suppliers found.</div>
          ) : (
            <select
              className={styles.filterSelect}
              style={{ width: "100%" }}
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              aria-label="Primary Vendor Partner"
            >
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} ({sup.leadTimeDays ?? 5}d lead time)
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Priorities Table */}
      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <div className="spinner mb-2" style={{ margin: "0 auto" }} />
            <p>Evaluating clinical inventory balances and medicine-specific policy rules…</p>
          </div>
        ) : medicines.length === 0 ? (
          <div className={styles.emptyState}>No medicines currently recorded in the central catalogue.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Medicine Name</th>
                <th className={styles.th}>Code & Unit</th>
                <th className={styles.th}>Policy Safety Level</th>
                <th className={styles.th}>Estimated Unit Cost</th>
                <th className={styles.th}>Policy Pre-Check</th>
                <th className={styles.th} style={{ minWidth: 210 }}>Procurement Action</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med) => {
                const replenishQty = getReplenishmentQuantity(med);
                const unitStr = med.unit ?? "units";
                return (
                  <tr key={med.id} className={styles.tr}>
                    <td className={styles.td}>
                      <strong>{med.name}</strong>
                    </td>
                    <td className={styles.td}>
                      <code>{med.code}</code>
                      <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                        {unitStr}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span style={{ fontSize: "0.8125rem", color: "#0f766e", fontWeight: 600 }}>
                        Min {med.minimumStockLevel ?? med.minimumStock ?? 100} {unitStr}
                      </span>
                    </td>
                    <td className={styles.td} style={{ whiteSpace: "nowrap" }}>
                      <strong style={{ color: "#0f172a" }}>${(med.unitPrice || 12.5).toFixed(2)}</strong>
                    </td>
                    <td className={styles.td}>
                      <button
                        type="button"
                        className={styles.actionBtnSecondary}
                        disabled={isValidating}
                        onClick={() => void handleTestValidation(med)}
                        title={`Test policy compliance for ${replenishQty} ${unitStr}`}
                      >
                        <ShieldCheck size={13} /> Check Policy ({replenishQty} {unitStr})
                      </button>
                    </td>
                    <td className={styles.td}>
                      <button
                        type="button"
                        className={styles.actionBtnPrimary}
                        onClick={() => void handleFastReplenish(med)}
                        title={`Initiate & submit purchase requisition for ${replenishQty} ${unitStr}`}
                      >
                        <Plus size={13} /> Replenish ({replenishQty} {unitStr})
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
