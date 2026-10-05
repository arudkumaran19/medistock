import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { inventoryApi } from "../services/inventoryApi";
import type { Batch, Facility, Inventory } from "../types/inventory";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Activity,
} from "lucide-react";

export function BatchDetailPage() {
  const { id } = useParams();
  const [batch, setBatch] = useState<Batch>();
  const [facility, setFacility] = useState<Facility>();
  const [balance, setBalance] = useState<Inventory>();
  const [reason, setReason] = useState("");
  const [delta, setDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    if (!id) return;
    await Promise.resolve();
    setLoading(true);
    setError("");
    try {
      const batchData = await inventoryApi.batch(id);
      const [facilityRows, balances] = await Promise.all([
        inventoryApi.facilities(),
        inventoryApi.list(true),
      ]);
      setBatch(batchData);
      setFacility(facilityRows.find((x) => x.id === batchData.facilityId));
      setBalance(
        balances.find(
          (x) => x.medicineId === batchData.medicineId && x.facilityId === batchData.facilityId
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const retire = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !batch || !reason.trim() || batch.quantityOnHand <= 0) return;
    if (
      !window.confirm(
        "Retire this batch? Its remaining quantity will be removed through an audited stock transaction. Batch and transaction history will be preserved."
      )
    )
      return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const retired = await inventoryApi.retireBatch(id, reason.trim());
      setBatch(retired);
      setReason("");
      setMessage("Batch retired. Its history and audit transaction were preserved.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!batch) return;
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0) {
      setError("Enter a non-zero whole-number adjustment.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await inventoryApi.adjust({
        medicineId: batch.medicineId,
        facilityId: batch.facilityId,
        quantityDelta: amount,
        reason: adjustReason.trim(),
      });
      setDelta("");
      setAdjustReason("");
      setMessage("Stock adjustment recorded in transaction history.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const expired = batch ? new Date(batch.expiryDateUtc).getTime() < now : false;

  const metricCard = (label: string, value: React.ReactNode, accent?: string) => (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${accent ? accent + "33" : "var(--border-base, #e2e8f0)"}`,
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
          fontSize: 20,
          fontWeight: 700,
          color: accent ?? "var(--text-primary, #0f172a)",
        }}
      >
        {value}
      </strong>
    </div>
  );

  return (
    <>
      <div className="page-container">
        {/* Back link */}
        <div style={{ marginBottom: 8 }}>
          <Link
            to="/inventory/expiry"
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
            <ArrowLeft size={16} /> Back to expiry watch
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: 64, textAlign: "center", color: "var(--text-secondary)" }}>
            <div className="spinner mb-3" style={{ margin: "0 auto" }} />
            <p role="status">Loading batch details…</p>
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

        {batch && (
          <>
            <PageHeader
              eyebrow="Batch Control Record"
              title={batch.medicineName}
              subtitle={
                <>
                  Batch:{" "}
                  <code
                    style={{
                      background: "var(--surface-subtle, #f1f5f9)",
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {batch.batchNumber}
                  </code>{" "}
                  · Facility: <strong>{facility?.name ?? batch.facilityId}</strong>
                </>
              }
            />

            {/* Metrics Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 14,
                marginBottom: 32,
              }}
            >
              {metricCard("Quantity On Hand", batch.quantityOnHand, "#0f766e")}
              {metricCard("Available Stock", balance?.availableQuantity ?? "—")}
              {metricCard(
                "Manufactured",
                new Date(batch.manufacturingDateUtc).toLocaleDateString()
              )}
              <div
                style={{
                  background: expired ? "#fef2f2" : "#ffffff",
                  border: `1px solid ${expired ? "#fecaca" : "var(--border-base, #e2e8f0)"}`,
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
                    color: expired ? "#b91c1c" : "var(--text-muted, #94a3b8)",
                    marginBottom: 6,
                  }}
                >
                  Expiration Date
                </span>
                <strong
                  style={{ display: "block", fontSize: 15, color: expired ? "#b91c1c" : "var(--text-primary, #0f172a)" }}
                >
                  {new Date(batch.expiryDateUtc).toLocaleDateString()}
                </strong>
              </div>
              <div
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
                    marginBottom: 8,
                  }}
                >
                  Batch Status
                </span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 600,
                    background:
                      batch.quantityOnHand <= 0
                        ? "#f1f5f9"
                        : expired
                        ? "#fee2e2"
                        : "#dcfce7",
                    color:
                      batch.quantityOnHand <= 0
                        ? "#64748b"
                        : expired
                        ? "#b91c1c"
                        : "#15803d",
                  }}
                >
                  {batch.quantityOnHand <= 0 ? "Retired" : expired ? "Expired" : "Active"}
                </span>
              </div>
            </div>

            {/* Action panels */}
            {batch.quantityOnHand > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                {/* Adjust Stock */}
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
                    <Sliders size={16} color="var(--color-primary-700, #0f766e)" />
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
                      Stock Adjustment
                    </p>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 20px", color: "var(--text-primary, #0f172a)" }}>
                    Adjust batch quantity
                  </h3>
                  <form onSubmit={adjust} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-secondary, #475569)",
                          marginBottom: 5,
                        }}
                      >
                        Quantity delta (+/-)
                      </label>
                      <input
                        required
                        type="number"
                        step="1"
                        placeholder="e.g. -5 or 10"
                        value={delta}
                        onChange={(e) => setDelta(e.target.value)}
                        style={{
                          width: "100%",
                          height: 40,
                          padding: "0 12px",
                          border: "1px solid var(--border-base, #e2e8f0)",
                          borderRadius: "var(--radius-md, 8px)",
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-secondary, #475569)",
                          marginBottom: 5,
                        }}
                      >
                        Adjustment reason
                      </label>
                      <input
                        required
                        placeholder="e.g. Broken vial during dispensing"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        style={{
                          width: "100%",
                          height: 40,
                          padding: "0 12px",
                          border: "1px solid var(--border-base, #e2e8f0)",
                          borderRadius: "var(--radius-md, 8px)",
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <button
                      disabled={isSubmitting}
                      type="submit"
                      style={{
                        height: 40,
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
                      {isSubmitting ? "Saving…" : "Record adjustment"}
                    </button>
                  </form>
                </div>

                {/* Retire Batch */}
                <div
                  style={{
                    background: "#fffafb",
                    border: "1px solid #fee2e2",
                    borderRadius: "var(--radius-xl, 12px)",
                    padding: "24px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <ShieldAlert size={16} color="#b91c1c" />
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
                      Decommissioning
                    </p>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 6px", color: "#991b1b" }}>
                    Retire batch
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary, #64748b)", margin: "0 0 16px" }}>
                    Retirement permanently sets this batch's operational balance to zero and logs an audited
                    retirement record.
                  </p>
                  <form onSubmit={retire} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-secondary, #475569)",
                          marginBottom: 5,
                        }}
                      >
                        Retirement reason
                      </label>
                      <input
                        required
                        placeholder="e.g. Contamination or cold-chain compromise"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        style={{
                          width: "100%",
                          height: 40,
                          padding: "0 12px",
                          border: "1px solid #fca5a5",
                          borderRadius: "var(--radius-md, 8px)",
                          fontSize: 13,
                          background: "#fff",
                        }}
                      />
                    </div>
                    <button
                      disabled={isSubmitting}
                      type="submit"
                      style={{
                        height: 40,
                        background: "#dc2626",
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
                      {isSubmitting ? "Saving…" : "Retire batch"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {batch.quantityOnHand <= 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "20px 24px",
                  background: "var(--surface-subtle, #f8fafc)",
                  border: "1px solid var(--border-base, #e2e8f0)",
                  borderRadius: "var(--radius-lg, 10px)",
                  color: "var(--text-secondary, #64748b)",
                  fontSize: 14,
                }}
              >
                <Activity size={18} color="#94a3b8" />
                This batch is retired; its historical records and transactions remain permanently archived in the
                compliance log.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
