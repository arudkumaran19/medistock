import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { InventoryAgentPanel } from "./InventoryAgentPanel";
import { inventoryApi, medicineApi } from "../../services/inventoryApi";
import { useAuth } from "../auth/AuthContext";
import type { Batch, Facility, Inventory, Medicine } from "../../types/inventory";
import {
  validateMedicineCode,
  validateMedicineName,
  validateMinimumStock,
  validateUnit,
} from "../../utils/inventoryValidation";
import { KPICard } from "../../components/ui";
import styles from "./InventoryPage.module.css";
import {
  CalendarCheck,
  PackagePlus,
  Plus,
  Eye,
  AlertCircle,
  CheckCircle2,
  Pill,
  Building2,
  Archive,
  TrendingDown,
  Layers,
} from "lucide-react";

type StatusFilter = "all" | "low" | "healthy" | "expiring" | "active" | "archived";
type MedicineDraft = { code: string; name: string; unit: string; minimumStockLevel: string };
type MedicineErrors = Partial<Record<keyof MedicineDraft, string>>;
const blankMedicine: MedicineDraft = { code: "", name: "", unit: "unit", minimumStockLevel: "0" };

export function InventoryPage() {
  const { canManageMedicineAndExpiry } = useAuth();
  const canManage = canManageMedicineAndExpiry();
  const [items, setItems] = useState<Inventory[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState("name");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<MedicineDraft>(blankMedicine);
  const [draftErrors, setDraftErrors] = useState<MedicineErrors>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    await Promise.resolve();
    setIsLoading(true);
    setError("");
    try {
      const [balanceRows, medicineRows, facilityRows, batchRows] = await Promise.all([
        inventoryApi.list(true),
        inventoryApi.medicines(true),
        inventoryApi.facilities(),
        inventoryApi.batches(),
      ]);
      setItems(balanceRows);
      setMedicines(medicineRows);
      setFacilities(facilityRows);
      setBatches(batchRows);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inventory could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const expiryByBalance = useMemo(() => {
    const result = new Map<string, number>();
    for (const batch of batches) {
      const key = `${batch.medicineId}:${batch.facilityId}`;
      const expiry = new Date(batch.expiryDateUtc).getTime();
      result.set(key, Math.min(result.get(key) ?? Infinity, expiry));
    }
    return result;
  }, [batches]);

  const [now] = useState(() => Date.now());

  const filtered = useMemo(
    () =>
      items
        .filter((item) => {
          const medicine = medicines.find((x) => x.id === item.medicineId);
          const search = `${item.medicineName} ${medicine?.code ?? ""}`.toLocaleLowerCase();
          const expiringSoon =
            (expiryByBalance.get(`${item.medicineId}:${item.facilityId}`) ?? Infinity) <=
            now + 30 * 86400000;
          return (
            (!query || search.includes(query.trim().toLocaleLowerCase())) &&
            (!facilityId || item.facilityId === facilityId) &&
            (status === "all" ||
              (status === "low" && item.isBelowMinimum) ||
              (status === "healthy" && !item.isBelowMinimum) ||
              (status === "expiring" && expiringSoon) ||
              (status === "active" && item.isMedicineActive) ||
              (status === "archived" && !item.isMedicineActive))
          );
        })
        .sort((a, b) =>
          sort === "quantity"
            ? a.quantityOnHand - b.quantityOnHand
            : sort === "expiry"
            ? (expiryByBalance.get(`${a.medicineId}:${a.facilityId}`) ?? Infinity) -
              (expiryByBalance.get(`${b.medicineId}:${b.facilityId}`) ?? Infinity)
            : a.medicineName.localeCompare(b.medicineName)
        ),
    [items, medicines, query, facilityId, status, sort, expiryByBalance, now]
  );

  const lowMedicineCount = new Set(
    items.filter((x) => x.isBelowMinimum && x.isMedicineActive).map((x) => x.medicineId)
  ).size;
  const expiringSoon = batches.filter((x) => new Date(x.expiryDateUtc).getTime() <= now + 30 * 86400000);

  const submitMedicine = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const validation: MedicineErrors = {
      code: validateMedicineCode(draft.code),
      name: validateMedicineName(draft.name),
      unit: validateUnit(draft.unit),
      minimumStockLevel: validateMinimumStock(draft.minimumStockLevel),
    };
    setDraftErrors(validation);
    if (Object.values(validation).some(Boolean)) return;
    setSaving(true);
    try {
      await medicineApi.create({
        ...draft,
        name: draft.name.trim(),
        code: draft.code.trim(),
        unit: draft.unit.trim(),
        minimumStockLevel: Number(draft.minimumStockLevel),
      });
      setDraft(blankMedicine);
      setDraftErrors({});
      setShowCreate(false);
      setNotice("Medicine created. Receive stock to add a facility balance.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Medicine could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow" style={{ color: "var(--color-primary-700, #0f766e)" }}>
            MEDISTOCK / INVENTORY
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", margin: "4px 0 0" }}>Facility stock control</h1>
          <p className={styles.subtitle}>Medicine balances, batch risks, and stock activity in one place.</p>
        </div>
        <nav className={styles.actions}>
          {canManage && (
            <button type="button" onClick={() => setShowCreate((x) => !x)}>
              <Plus size={16} /> Add medicine
            </button>
          )}
          {canManage && (
            <Link className={styles.primaryLink} to="/inventory/receive">
              <PackagePlus size={16} /> Receive stock
            </Link>
          )}
          <Link className={styles.secondaryLink} to="/inventory/expiry">
            <CalendarCheck size={16} /> Expiry watch
          </Link>
        </nav>
      </header>

      {/* KPI Row */}
      <section
        className={styles.kpiRow}
        aria-label="Inventory overview"
      >
        <KPICard
          label="Active Medicines"
          value={isLoading ? "…" : medicines.filter((x) => x.isActive).length}
          context="Catalogued & active"
          icon={<Pill size={20} />}
          accent="#0f766e"
          variant="success"
          compact
        />
        <KPICard
          label="Facilities"
          value={isLoading ? "…" : facilities.filter((x) => x.isActive).length}
          context="Active dispensing sites"
          icon={<Building2 size={20} />}
          accent="#6366f1"
          compact
        />
        <KPICard
          label="Units on Hand"
          value={isLoading ? "…" : items.filter((x) => x.isMedicineActive).reduce((sum, x) => sum + x.quantityOnHand, 0).toLocaleString()}
          context="Total across all facilities"
          icon={<Layers size={20} />}
          accent="#0891b2"
          compact
        />
        <KPICard
          label="Low Stock"
          value={isLoading ? "…" : lowMedicineCount}
          context="Below minimum threshold"
          icon={<TrendingDown size={20} />}
          accent={lowMedicineCount > 0 ? "#d97706" : "#64748b"}
          variant={lowMedicineCount > 0 ? "warning" : "default"}
          compact
        />
        <KPICard
          label="Expiring Soon"
          value={isLoading ? "…" : expiringSoon.length}
          context="Batches within 30 days"
          icon={<CalendarCheck size={20} />}
          accent={expiringSoon.length > 0 ? "#dc2626" : "#64748b"}
          variant={expiringSoon.length > 0 ? "danger" : "default"}
          compact
        />
        <KPICard
          label="Active Batches"
          value={isLoading ? "…" : batches.length}
          context="Tracked batch records"
          icon={<Archive size={20} />}
          accent="#7c3aed"
          compact
        />
      </section>

      {/* Stock Health Band */}
      {!isLoading && items.length > 0 && (() => {
        const activeMeds = items.filter((x) => x.isMedicineActive);
        const total = activeMeds.length || 1;
        const lowCount = activeMeds.filter((x) => x.isBelowMinimum).length;
        const expiringIds = new Set(expiringSoon.map((b) => `${b.medicineId}:${b.facilityId}`));
        const expiringCount = activeMeds.filter((x) => expiringIds.has(`${x.medicineId}:${x.facilityId}`)).length;
        const healthyCount = Math.max(0, total - lowCount - expiringCount);
        const healthPct = Math.round((healthyCount / total) * 100);
        const lowPct = Math.round((lowCount / total) * 100);
        const expiringPct = 100 - healthPct - lowPct;
        return (
          <div className={styles.healthBand}>
            <div className={styles.healthBandLabel}>
              <span>Stock Health</span>
              <span className={styles.healthBandLegend}>
                <span className={styles.dot} style={{ background: "#16a34a" }} /> Healthy ({healthyCount})
                {lowCount > 0 && <><span className={styles.dot} style={{ background: "#d97706" }} /> Low ({lowCount})</>}
                {expiringCount > 0 && <><span className={styles.dot} style={{ background: "#dc2626" }} /> Expiring ({expiringCount})</>}
              </span>
            </div>
            <div className={styles.healthBar}>
              {healthPct > 0 && <div style={{ width: `${healthPct}%`, background: "#22c55e" }} title={`Healthy: ${healthyCount}`} />}
              {lowPct > 0 && <div style={{ width: `${lowPct}%`, background: "#f59e0b" }} title={`Low: ${lowCount}`} />}
              {expiringPct > 0 && <div style={{ width: `${expiringPct}%`, background: "#ef4444" }} title={`Expiring: ${expiringCount}`} />}
            </div>
          </div>
        );
      })()}

      {canManage && showCreate && (
        <section className={styles.createPanel}>
          <div>
            <h2>Add medicine</h2>
            <p>Create a catalog item first, then receive a batch to put it into facility stock.</p>
          </div>
          <form noValidate onSubmit={submitMedicine} className={styles.createForm}>
            <label>
              Medicine code
              <input
                required
                placeholder="e.g. PARA-500"
                aria-invalid={Boolean(draftErrors.code)}
                aria-describedby="medicine-code-error"
                value={draft.code}
                onChange={(e) => {
                  const code = e.target.value;
                  setDraft({ ...draft, code });
                  setDraftErrors((errors) => ({ ...errors, code: validateMedicineCode(code) }));
                }}
                onBlur={(e) => {
                  const code = e.currentTarget.value;
                  setDraftErrors((errors) => ({ ...errors, code: validateMedicineCode(code) }));
                }}
              />
              {draftErrors.code && (
                <small id="medicine-code-error" className={styles.fieldError} role="alert">
                  {draftErrors.code}
                </small>
              )}
            </label>
            <label>
              Medicine name
              <input
                required
                placeholder="e.g. Paracetamol 500mg"
                aria-invalid={Boolean(draftErrors.name)}
                aria-describedby="medicine-name-error"
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft({ ...draft, name });
                  setDraftErrors((errors) => ({ ...errors, name: validateMedicineName(name) }));
                }}
                onBlur={(e) => {
                  const name = e.currentTarget.value;
                  setDraftErrors((errors) => ({ ...errors, name: validateMedicineName(name) }));
                }}
              />
              {draftErrors.name && (
                <small id="medicine-name-error" className={styles.fieldError} role="alert">
                  {draftErrors.name}
                </small>
              )}
            </label>
            <label>
              Unit
              <input
                required
                placeholder="tablet, bottle, vial..."
                aria-invalid={Boolean(draftErrors.unit)}
                aria-describedby="medicine-unit-error"
                value={draft.unit}
                onChange={(e) => {
                  const unit = e.target.value;
                  setDraft({ ...draft, unit });
                  setDraftErrors((errors) => ({ ...errors, unit: validateUnit(unit) }));
                }}
                onBlur={(e) => {
                  const unit = e.currentTarget.value;
                  setDraftErrors((errors) => ({ ...errors, unit: validateUnit(unit) }));
                }}
              />
              {draftErrors.unit && (
                <small id="medicine-unit-error" className={styles.fieldError} role="alert">
                  {draftErrors.unit}
                </small>
              )}
            </label>
            <label>
              Minimum stock
              <input
                required
                type="text"
                inputMode="numeric"
                aria-invalid={Boolean(draftErrors.minimumStockLevel)}
                aria-describedby="minimum-stock-error"
                value={draft.minimumStockLevel}
                onChange={(e) => {
                  const minimumStockLevel = e.target.value;
                  setDraft({ ...draft, minimumStockLevel });
                  setDraftErrors((errors) => ({
                    ...errors,
                    minimumStockLevel: validateMinimumStock(minimumStockLevel),
                  }));
                }}
                onBlur={(e) => {
                  const minimumStockLevel = e.currentTarget.value;
                  setDraftErrors((errors) => ({
                    ...errors,
                    minimumStockLevel: validateMinimumStock(minimumStockLevel),
                  }));
                }}
              />
              {draftErrors.minimumStockLevel && (
                <small id="minimum-stock-error" className={styles.fieldError} role="alert">
                  {draftErrors.minimumStockLevel}
                </small>
              )}
            </label>
            <button disabled={saving} type="submit">
              {saving ? "Saving…" : "Create medicine"}
            </button>
          </form>
        </section>
      )}

      {notice && (
        <p className={styles.notice} role="status">
          <CheckCircle2 size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
          {notice}
        </p>
      )}

      <InventoryAgentPanel />

      <section className={styles.inventorySection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow" style={{ color: "var(--color-primary-700, #0f766e)" }}>
              STOCK REGISTER
            </p>
            <h2>Inventory balances</h2>
          </div>
          <span>{filtered.length} balances</span>
        </div>

        <div className={styles.filters}>
          <label className={styles.search}>
            Search
            <input
              type="search"
              placeholder="Medicine name or code..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Facility
            <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              <option value="">All facilities</option>
              {facilities
                .filter((x) => x.isActive)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              <option value="low">Low stock</option>
              <option value="healthy">Normal</option>
              <option value="expiring">Expiring soon</option>
              <option value="active">Active medicines</option>
              <option value="archived">Archived medicines</option>
            </select>
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Medicine name</option>
              <option value="quantity">Stock quantity</option>
              <option value="expiry">Nearest expiry</option>
            </select>
          </label>
        </div>

        {isLoading && <p className={styles.state}>Loading inventory balances…</p>}
        {error && (
          <p className={styles.error} role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button type="button" onClick={() => void load()}>
              Retry
            </button>
          </p>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <p className={styles.state}>
            No balances match these filters. Try changing your search or receive stock for a medicine.
          </p>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Facility</th>
                  <th>On hand</th>
                  <th>Available</th>
                  <th>Minimum</th>
                  <th>Nearest expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const expiry = expiryByBalance.get(`${item.medicineId}:${item.facilityId}`);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link to={`/inventory/${item.id}`}>{item.medicineName}</Link>
                        <small>{medicines.find((x) => x.id === item.medicineId)?.code}</small>
                      </td>
                      <td>{item.facilityName}</td>
                      <td>
                        <strong>{item.quantityOnHand}</strong>
                        {item.minimumStockLevel > 0 && (
                          <div
                            title={`${item.quantityOnHand} / ${item.minimumStockLevel} minimum`}
                            style={{
                              marginTop: 5,
                              height: 4,
                              borderRadius: 2,
                              background: "#e2e8f0",
                              overflow: "hidden",
                              width: 72,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, Math.round((item.quantityOnHand / (item.minimumStockLevel * 2)) * 100))}%`,
                                background: item.isBelowMinimum ? "#f59e0b" : "#22c55e",
                                borderRadius: 2,
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td>{item.availableQuantity}</td>
                      <td>{item.minimumStockLevel}</td>
                      <td>{expiry && Number.isFinite(expiry) ? new Date(expiry).toLocaleDateString() : "—"}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            !item.isMedicineActive
                              ? styles.muted
                              : item.isBelowMinimum
                              ? styles.danger
                              : styles.good
                          }`}
                        >
                          {!item.isMedicineActive ? "Archived" : item.isBelowMinimum ? "Low stock" : "Normal"}
                        </span>
                      </td>
                      <td>
                        <Link to={`/inventory/${item.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Eye size={14} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
