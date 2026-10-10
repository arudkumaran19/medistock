import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { inventoryApi } from "../services/inventoryApi";
import type { Facility, Medicine } from "../types/inventory";
import { validateBatchNumber } from "../utils/inventoryValidation";
import { ArrowLeft, PackagePlus, CheckCircle2, AlertCircle, Info } from "lucide-react";

export function ReceiveStockPage() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [batchNumberError, setBatchNumberError] = useState("");
  const [form, setForm] = useState({
    medicineId: "",
    facilityId: "",
    batchNumber: "",
    quantity: 1,
    expiryDateUtc: "",
    manufacturingDateUtc: "",
  });

  useEffect(() => {
    Promise.all([inventoryApi.medicines(), inventoryApi.facilities()])
      .then(([medicineList, facilityList]) => {
        const activeMedicines = medicineList.filter((x) => x.isActive);
        setMedicines(activeMedicines);
        setFacilities(facilityList);
        setForm((x) => ({
          ...x,
          medicineId: activeMedicines[0]?.id ?? "",
          facilityId: facilityList[0]?.id ?? "",
        }));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  const update = (key: string, value: string) =>
    setForm((x) => ({ ...x, [key]: key === "quantity" ? Number(value) : value }));

  const changeBatchNumber = (value: string) => {
    update("batchNumber", value);
    setBatchNumberError(validateBatchNumber(value) ?? "");
  };

  const blurBatchNumber = () => setBatchNumberError(validateBatchNumber(form.batchNumber) ?? "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const batchError = validateBatchNumber(form.batchNumber);
    setBatchNumberError(batchError ?? "");
    if (batchError) return;
    if (!form.medicineId || !form.facilityId) {
      setError("Select a medicine and receiving facility.");
      return;
    }
    if (form.quantity <= 0 || !Number.isInteger(form.quantity)) {
      setError("Quantity must be a positive whole number.");
      return;
    }
    const manufactureDate = new Date(form.manufacturingDateUtc);
    const expiryDate = new Date(form.expiryDateUtc);
    if (
      !form.manufacturingDateUtc ||
      !form.expiryDateUtc ||
      !Number.isFinite(manufactureDate.getTime()) ||
      !Number.isFinite(expiryDate.getTime()) ||
      expiryDate <= manufactureDate
    ) {
      setError("Expiry date must be later than manufacture date.");
      return;
    }
    setIsSubmitting(true);
    try {
      await inventoryApi.receive({
        ...form,
        batchNumber: form.batchNumber.trim(),
        expiryDateUtc: new Date(form.expiryDateUtc).toISOString(),
        manufacturingDateUtc: new Date(form.manufacturingDateUtc).toISOString(),
      });
      setMessage("Stock received successfully.");
      setTimeout(() => navigate("/inventory"), 600);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "16px 24px 64px" }}>
        {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: 20 }}>
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

      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <p
          className="eyebrow"
          style={{
            fontSize: "var(--text-xs, 12px)",
            fontWeight: 600,
            color: "var(--color-primary-700, #0f766e)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 0 4px",
          }}
        >
          STOCK INTAKE
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl, 24px)",
            fontWeight: 700,
            color: "var(--text-primary, #0f172a)",
            margin: 0,
          }}
        >
          Receive a medicine batch
        </h1>
        <p style={{ color: "var(--text-secondary, #64748b)", fontSize: "var(--text-sm, 14px)", margin: "6px 0 0" }}>
          Record incoming medicine shipments, lot tracking details, and expiration parameters into facility stock.
        </p>
      </div>

      {isLoading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary, #64748b)" }}>
          <div className="spinner mb-3" style={{ margin: "0 auto" }} />
          <p>Loading medicines and facilities…</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 18px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius-lg, 10px)",
            color: "#b91c1c",
            fontSize: "var(--text-sm, 13px)",
            marginBottom: 24,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

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
            fontSize: "var(--text-sm, 13px)",
            marginBottom: 24,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {!isLoading && (
        <div
          style={{
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "var(--radius-xl, 12px)",
            padding: "28px 32px",
            boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
          }}
        >
          <form noValidate onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Medicine & Facility */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label
                  htmlFor="medicine-select"
                  style={{
                    display: "block",
                    fontSize: "var(--text-xs, 12px)",
                    fontWeight: 600,
                    color: "var(--text-secondary, #475569)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Medicine
                </label>
                <select
                  id="medicine-select"
                  required
                  aria-label="Medicine"
                  value={form.medicineId}
                  onChange={(e) => update("medicineId", e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "var(--radius-md, 8px)",
                    background: "#ffffff",
                    fontSize: "var(--text-sm, 14px)",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">Select medicine</option>
                  {medicines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="facility-select"
                  style={{
                    display: "block",
                    fontSize: "var(--text-xs, 12px)",
                    fontWeight: 600,
                    color: "var(--text-secondary, #475569)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Facility
                </label>
                <select
                  id="facility-select"
                  required
                  aria-label="Facility"
                  value={form.facilityId}
                  onChange={(e) => update("facilityId", e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "var(--radius-md, 8px)",
                    background: "#ffffff",
                    fontSize: "var(--text-sm, 14px)",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">Select facility</option>
                  {facilities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Batch Number & Quantity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label
                  htmlFor="batch-number"
                  style={{
                    display: "block",
                    fontSize: "var(--text-xs, 12px)",
                    fontWeight: 600,
                    color: "var(--text-secondary, #475569)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Batch number
                </label>
                <input
                  id="batch-number"
                  aria-label="Batch number"
                  required
                  aria-invalid={Boolean(batchNumberError)}
                  aria-describedby="batch-number-error"
                  type="text"
                  placeholder="e.g. BATCH-001"
                  value={form.batchNumber}
                  onChange={(e) => changeBatchNumber(e.target.value)}
                  onBlur={blurBatchNumber}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: `1px solid ${batchNumberError ? "#ef4444" : "var(--border-color, #cbd5e1)"}`,
                    borderRadius: "var(--radius-md, 8px)",
                    fontSize: "var(--text-sm, 14px)",
                    fontFamily: "inherit",
                  }}
                />
                {batchNumberError && (
                  <small
                    id="batch-number-error"
                    role="alert"
                    style={{
                      display: "block",
                      marginTop: 4,
                      color: "#dc2626",
                      fontSize: "var(--text-xs, 12px)",
                      fontWeight: 500,
                    }}
                  >
                    {batchNumberError}
                  </small>
                )}
              </div>

              <div>
                <label
                  htmlFor="quantity-received"
                  style={{
                    display: "block",
                    fontSize: "var(--text-xs, 12px)",
                    fontWeight: 600,
                    color: "var(--text-secondary, #475569)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Quantity received
                </label>
                <input
                  id="quantity-received"
                  aria-label="quantity"
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "var(--radius-md, 8px)",
                    fontSize: "var(--text-sm, 14px)",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Dates: Manufacturing & Expiry */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label
                  htmlFor="manufacturing-date"
                  style={{
                    display: "block",
                    fontSize: "var(--text-xs, 12px)",
                    fontWeight: 600,
                    color: "var(--text-secondary, #475569)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Manufacturing date
                </label>
                <input
                  id="manufacturing-date"
                  aria-label="manufacturingDate"
                  required
                  type="date"
                  value={form.manufacturingDateUtc}
                  onChange={(e) => update("manufacturingDateUtc", e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "var(--radius-md, 8px)",
                    fontSize: "var(--text-sm, 14px)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="expiry-date"
                  style={{
                    display: "block",
                    fontSize: "var(--text-xs, 12px)",
                    fontWeight: 600,
                    color: "var(--text-secondary, #475569)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Expiry date
                </label>
                <input
                  id="expiry-date"
                  aria-label="expiryDate"
                  required
                  type="date"
                  value={form.expiryDateUtc}
                  onChange={(e) => update("expiryDateUtc", e.target.value)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "var(--radius-md, 8px)",
                    fontSize: "var(--text-sm, 14px)",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Informational Guidance */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: "var(--bg-subtle, #f8fafc)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "var(--radius-md, 8px)",
                fontSize: "var(--text-xs, 12px)",
                color: "var(--text-secondary, #64748b)",
              }}
            >
              <Info size={16} style={{ color: "var(--color-primary-700, #0f766e)", flexShrink: 0 }} />
              <span>
                Standard lot tracking ensures complete audit traceability across storage locations and cold-chain compliance.
              </span>
            </div>

            {/* Form Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
              <Link
                to="/inventory"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "10px 20px",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  background: "#ffffff",
                  color: "var(--text-secondary, #475569)",
                  fontSize: "var(--text-sm, 13px)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Cancel
              </Link>
              <button
                disabled={isSubmitting || !medicines.length || !facilities.length}
                type="submit"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 24px",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "none",
                  background: "var(--color-primary-600, #0f766e)",
                  color: "#ffffff",
                  fontSize: "var(--text-sm, 13px)",
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting || !medicines.length || !facilities.length ? 0.6 : 1,
                  transition: "background 150ms",
                }}
              >
                <PackagePlus size={16} />
                {isSubmitting ? "Saving…" : "Record receipt"}
              </button>
            </div>
          </form>
        </div>
      )}
      </div>
    </>
  );
}
