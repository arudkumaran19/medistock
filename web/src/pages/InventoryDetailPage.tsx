import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { PageHeader } from "../components/ui";
import { inventoryApi, medicineApi } from "../services/inventoryApi";
import type { Inventory, Medicine, StockTransaction } from "../types/inventory";
import {
  validateMedicineName,
  validateMinimumStock,
  validateUnit,
} from "../utils/inventoryValidation";
import {
  ArrowLeft,
  Sliders,
  Archive,
  AlertCircle,
  CheckCircle2,
  Save,
  Activity,
} from "lucide-react";

export function InventoryDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Inventory>();
  const [medicine, setMedicine] = useState<Medicine>();
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editErrors, setEditErrors] = useState<{
    name?: string;
    unit?: string;
    minimumStockLevel?: string;
  }>({});

  const refresh = useCallback(async () => {
    if (!id) return;
    await Promise.resolve();
    setIsLoading(true);
    setError("");
    try {
      const balance = await inventoryApi.get(id);
      const [medicineData, history] = await Promise.all([
        inventoryApi.medicine(balance.medicineId),
        inventoryApi.transactions(balance.medicineId, balance.facilityId),
      ]);
      setItem(balance);
      setMedicine(medicineData);
      setTransactions(history);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const adjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await inventoryApi.adjust({
        medicineId: item.medicineId,
        facilityId: item.facilityId,
        quantityDelta: Number(delta),
        reason,
      });
      setMessage("Stock adjustment recorded.");
      setDelta("0");
      setReason("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const edit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!medicine) return;
    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name")),
      unit: String(form.get("unit")),
      minimumStockLevel: String(form.get("minimumStockLevel")),
    };
    const validation = {
      name: validateMedicineName(values.name),
      unit: validateUnit(values.unit),
      minimumStockLevel: validateMinimumStock(values.minimumStockLevel),
    };
    setEditErrors(validation);
    if (Object.values(validation).some(Boolean)) return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const updated = await medicineApi.update(medicine.id, {
        name: values.name.trim(),
        unit: values.unit.trim(),
        minimumStockLevel: Number(values.minimumStockLevel),
      });
      setMedicine(updated);
      setMessage("Medicine details updated.");
      setEditErrors({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const archive = async () => {
    if (
      !item ||
      !medicine ||
      !archiveReason.trim() ||
      !window.confirm("Archive this medicine? Stock records and audit history will be preserved.")
    )
      return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const archived = await inventoryApi.archiveMedicine(item.medicineId, archiveReason);
      setMedicine(archived);
      setMessage("Medicine archived. Stock and transaction history remain available.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 38,
    padding: "0 10px",
    border: "1px solid var(--border-base, #e2e8f0)",
    borderRadius: "var(--radius-md, 8px)",
    fontSize: 13,
    background: "#fff",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary, #475569)",
    marginBottom: 5,
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        {/* Back link */}
        <div style={{ marginBottom: 8 }}>
          <Link
            to="/inventory"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-sm, 13px)",
              color: "var(--color-primary-700, #0f766e)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Back to inventory
          </Link>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ padding: 64, textAlign: "center", color: "var(--text-secondary)" }}>
            <div className="spinner mb-3" style={{ margin: "0 auto" }} />
            <p role="status">Loading balance and transaction history…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "var(--radius-lg, 10px)",
              color: "#b91c1c",
              marginBottom: 24,
              fontSize: "var(--text-sm, 13px)",
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              style={{
                marginLeft: "auto",
                padding: "4px 12px",
                background: "#fff",
                border: "1px solid #fca5a5",
                borderRadius: "6px",
                color: "#b91c1c",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Success */}
        {message && (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "var(--radius-lg, 10px)",
              color: "#15803d",
              marginBottom: 24,
              fontSize: "var(--text-sm, 13px)",
            }}
          >
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        )}

        {item && medicine && (
          <>
            <PageHeader
              eyebrow="Medicine / Balance Detail"
              title={item.medicineName}
              subtitle={
                <>
                  <code
                    style={{
                      background: "var(--surface-subtle, #f1f5f9)",
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {medicine.code}
                  </code>{" "}
                  · Unit: <strong>{medicine.unit}</strong> · Status:{" "}
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 9px",
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: medicine.isActive ? "#dcfce7" : "#f1f5f9",
                      color: medicine.isActive ? "#15803d" : "#64748b",
                    }}
                  >
                    {medicine.isActive ? "Active" : "Archived"}
                  </span>
                </>
              }
            />

            {/* Stock Metrics */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
                marginBottom: 32,
              }}
            >
              {[
                { label: "Facility", value: item.facilityName, color: "" },
                { label: "On Hand", value: `${item.quantityOnHand} ${medicine.unit}`, color: "var(--color-primary-700, #0f766e)" },
                { label: "Reserved", value: String(item.quantityReserved), color: "#64748b" },
                { label: "Available", value: String(item.availableQuantity), color: "var(--text-primary, #0f172a)" },
                { label: "Minimum Stock", value: String(item.minimumStockLevel), color: "" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-base, #e2e8f0)",
                    borderRadius: "var(--radius-lg, 10px)",
                    padding: "16px 18px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text-muted, #94a3b8)",
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: label === "On Hand" ? 20 : 16,
                      fontWeight: 700,
                      color: color || "var(--text-primary, #0f172a)",
                    }}
                  >
                    {value}
                  </strong>
                </div>
              ))}
              <div
                style={{
                  background: item.isBelowMinimum ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${item.isBelowMinimum ? "#fecaca" : "#bbf7d0"}`,
                  borderRadius: "var(--radius-lg, 10px)",
                  padding: "16px 18px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-muted, #94a3b8)",
                    marginBottom: 6,
                  }}
                >
                  Stock Status
                </span>
                <strong
                  style={{
                    display: "block",
                    fontSize: 15,
                    fontWeight: 700,
                    color: item.isBelowMinimum ? "#b91c1c" : "#15803d",
                  }}
                >
                  {item.isBelowMinimum ? "Below Minimum" : "Adequate"}
                </strong>
              </div>
            </div>

            {/* Action Cards */}
            {medicine.isActive && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                  marginBottom: 32,
                }}
              >
                {/* Edit Medicine */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-base, #e2e8f0)",
                    borderRadius: "var(--radius-xl, 12px)",
                    padding: "24px",
                    boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <Save size={15} color="var(--color-primary-700, #0f766e)" />
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--color-primary-700, #0f766e)",
                      }}
                    >
                      Catalog Details
                    </p>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 20px", color: "var(--text-primary, #0f172a)" }}>
                    Edit medicine parameters
                  </h3>
                  <form noValidate onSubmit={edit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Medicine name</label>
                      <input
                        name="name"
                        required
                        aria-invalid={Boolean(editErrors.name)}
                        aria-describedby="edit-medicine-name-error"
                        defaultValue={medicine.name}
                        onChange={(e) =>
                          setEditErrors((errors) => ({ ...errors, name: validateMedicineName(e.target.value) }))
                        }
                        style={{
                          ...inputStyle,
                          borderColor: editErrors.name ? "#fca5a5" : undefined,
                        }}
                      />
                      {editErrors.name && (
                        <small id="edit-medicine-name-error" role="alert" style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>
                          {editErrors.name}
                        </small>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Unit</label>
                        <input
                          name="unit"
                          required
                          aria-invalid={Boolean(editErrors.unit)}
                          aria-describedby="edit-medicine-unit-error"
                          defaultValue={medicine.unit}
                          onChange={(e) =>
                            setEditErrors((errors) => ({ ...errors, unit: validateUnit(e.target.value) }))
                          }
                          style={{
                            ...inputStyle,
                            borderColor: editErrors.unit ? "#fca5a5" : undefined,
                          }}
                        />
                        {editErrors.unit && (
                          <small id="edit-medicine-unit-error" role="alert" style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>
                            {editErrors.unit}
                          </small>
                        )}
                      </div>
                      <div>
                        <label style={labelStyle}>Minimum stock</label>
                        <input
                          name="minimumStockLevel"
                          required
                          type="text"
                          inputMode="numeric"
                          aria-invalid={Boolean(editErrors.minimumStockLevel)}
                          aria-describedby="edit-minimum-stock-error"
                          defaultValue={medicine.minimumStockLevel}
                          onChange={(e) =>
                            setEditErrors((errors) => ({
                              ...errors,
                              minimumStockLevel: validateMinimumStock(e.target.value),
                            }))
                          }
                          style={{
                            ...inputStyle,
                            borderColor: editErrors.minimumStockLevel ? "#fca5a5" : undefined,
                          }}
                        />
                        {editErrors.minimumStockLevel && (
                          <small id="edit-minimum-stock-error" role="alert" style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>
                            {editErrors.minimumStockLevel}
                          </small>
                        )}
                      </div>
                    </div>
                    <button
                      disabled={isSubmitting}
                      type="submit"
                      style={{
                        height: 38,
                        background: "var(--color-primary-700, #0f766e)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "var(--radius-md, 8px)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        opacity: isSubmitting ? 0.7 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {isSubmitting ? "Saving…" : "Save medicine details"}
                    </button>
                  </form>
                </div>

                {/* Adjust & Archive */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Adjust Stock */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--border-base, #e2e8f0)",
                      borderRadius: "var(--radius-xl, 12px)",
                      padding: "20px 24px",
                      boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <Sliders size={15} color="var(--color-primary-700, #0f766e)" />
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "var(--color-primary-700, #0f766e)",
                        }}
                      >
                        Stock Balance
                      </p>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 16px", color: "var(--text-primary, #0f172a)" }}>
                      Record inventory adjustment
                    </h3>
                    <form onSubmit={adjust} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Quantity delta</label>
                          <input
                            required
                            type="number"
                            step="1"
                            value={delta}
                            onChange={(e) => setDelta(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Reason</label>
                          <input
                            required
                            placeholder="e.g. Audit correction, damage..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <button
                        disabled={isSubmitting}
                        type="submit"
                        style={{
                          height: 36,
                          background: "var(--surface-subtle, #f8fafc)",
                          border: "1px solid var(--border-base, #e2e8f0)",
                          borderRadius: "var(--radius-md, 8px)",
                          color: "var(--text-primary, #0f172a)",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isSubmitting ? "not-allowed" : "pointer",
                        }}
                      >
                        {isSubmitting ? "Saving…" : "Record adjustment"}
                      </button>
                    </form>
                  </div>

                  {/* Archive Medicine */}
                  <div
                    style={{
                      background: "#fffafb",
                      border: "1px solid #fee2e2",
                      borderRadius: "var(--radius-xl, 12px)",
                      padding: "20px 24px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <Archive size={15} color="#b91c1c" />
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#b91c1c",
                        }}
                      >
                        Lifecycle Management
                      </p>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 6px", color: "#991b1b" }}>
                      Archive medicine
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-secondary, #64748b)", margin: "0 0 12px" }}>
                      Archiving is available when all on-hand and reserved stock has been cleared.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void archive();
                      }}
                      style={{ display: "flex", gap: 10 }}
                    >
                      <input
                        required
                        placeholder="Reason for archiving..."
                        value={archiveReason}
                        onChange={(e) => setArchiveReason(e.target.value)}
                        style={{
                          flex: 1,
                          height: 36,
                          padding: "0 10px",
                          border: "1px solid #fca5a5",
                          borderRadius: "var(--radius-md, 8px)",
                          fontSize: 13,
                          background: "#fff",
                        }}
                      />
                      <button
                        disabled={isSubmitting}
                        type="submit"
                        style={{
                          height: 36,
                          padding: "0 16px",
                          background: "#dc2626",
                          border: "none",
                          borderRadius: "var(--radius-md, 8px)",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isSubmitting ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isSubmitting ? "Saving…" : "Archive"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction History */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-base, #e2e8f0)",
                borderRadius: "var(--radius-xl, 12px)",
                padding: "24px",
                boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--color-primary-700, #0f766e)",
                    }}
                  >
                    Audit Trail
                  </p>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary, #0f172a)" }}>
                    Stock transaction history
                  </h2>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary, #64748b)",
                    background: "var(--surface-subtle, #f1f5f9)",
                    padding: "4px 10px",
                    borderRadius: 9999,
                    fontWeight: 600,
                  }}
                >
                  {transactions.length} records
                </span>
              </div>

              {transactions.length === 0 ? (
                <div
                  style={{
                    padding: "32px 24px",
                    textAlign: "center",
                    color: "var(--text-secondary, #64748b)",
                    background: "var(--surface-subtle, #f8fafc)",
                    borderRadius: "var(--radius-lg, 10px)",
                  }}
                >
                  <Activity size={28} style={{ margin: "0 auto 10px", color: "#cbd5e1" }} />
                  <p style={{ margin: 0 }}>No transactions recorded for this balance.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm, 13px)" }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "var(--surface-subtle, #f8fafc)",
                          borderBottom: "1px solid var(--border-base, #e2e8f0)",
                        }}
                      >
                        {["Date", "Type", "Quantity", "Reason", "Batch", "Balance After"].map((h, i) => (
                          <th
                            key={h}
                            style={{
                              padding: "10px 14px",
                              textAlign: i === 2 || i === 5 ? "right" : "left",
                              fontSize: 11,
                              color: "var(--text-muted, #94a3b8)",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr
                          key={tx.id}
                          style={{
                            borderBottom:
                              idx < transactions.length - 1
                                ? "1px solid var(--border-subtle, #f1f5f9)"
                                : "none",
                          }}
                        >
                          <td style={{ padding: "12px 14px", color: "var(--text-secondary, #64748b)" }}>
                            {new Date(tx.createdAtUtc).toLocaleString()}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: "var(--surface-subtle, #f1f5f9)",
                                color: "var(--text-secondary, #475569)",
                              }}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px 14px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: tx.quantity > 0 ? "#15803d" : "#b91c1c",
                            }}
                          >
                            {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-primary, #334155)" }}>
                            {tx.reason}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {tx.batchNumber ? (
                              <code
                                style={{
                                  background: "var(--surface-subtle, #f1f5f9)",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 12,
                                }}
                              >
                                {tx.batchNumber}
                              </code>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td
                            style={{
                              padding: "12px 14px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "var(--text-primary, #0f172a)",
                            }}
                          >
                            {tx.balanceAfter}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
