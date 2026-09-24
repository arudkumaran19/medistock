import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { InventoryAgentPanel } from "../components/InventoryAgentPanel";
import { inventoryApi, medicineApi } from "../services/inventoryApi";
import type { Batch, Facility, Inventory, Medicine } from "../types/inventory";
import { validateMedicineCode, validateMedicineName, validateMinimumStock, validateUnit } from "../utils/inventoryValidation";
import styles from "./InventoryPage.module.css";

type StatusFilter = "all" | "low" | "healthy" | "expiring" | "active" | "archived";
type MedicineDraft = { code: string; name: string; unit: string; minimumStockLevel: string };
type MedicineErrors = Partial<Record<keyof MedicineDraft, string>>;
const blankMedicine: MedicineDraft = { code: "", name: "", unit: "unit", minimumStockLevel: "0" };

export function InventoryPage() {
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

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const [balanceRows, medicineRows, facilityRows, batchRows] = await Promise.all([
        inventoryApi.list(true), inventoryApi.medicines(true), inventoryApi.facilities(), inventoryApi.batches(),
      ]);
      setItems(balanceRows); setMedicines(medicineRows); setFacilities(facilityRows); setBatches(batchRows);
    } catch (e) { setError(e instanceof Error ? e.message : "Inventory could not be loaded."); }
    finally { setIsLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const expiryByBalance = useMemo(() => {
    const result = new Map<string, number>();
    for (const batch of batches) {
      const key = `${batch.medicineId}:${batch.facilityId}`;
      const expiry = new Date(batch.expiryDateUtc).getTime();
      result.set(key, Math.min(result.get(key) ?? Infinity, expiry));
    }
    return result;
  }, [batches]);
  const now = Date.now();
  const filtered = useMemo(() => items.filter((item) => {
    const medicine = medicines.find((x) => x.id === item.medicineId);
    const search = `${item.medicineName} ${medicine?.code ?? ""}`.toLocaleLowerCase();
    const expiringSoon = (expiryByBalance.get(`${item.medicineId}:${item.facilityId}`) ?? Infinity) <= now + 30 * 86400000;
    return (!query || search.includes(query.trim().toLocaleLowerCase())) && (!facilityId || item.facilityId === facilityId)
      && (status === "all" || (status === "low" && item.isBelowMinimum) || (status === "healthy" && !item.isBelowMinimum)
        || (status === "expiring" && expiringSoon) || (status === "active" && item.isMedicineActive) || (status === "archived" && !item.isMedicineActive));
  }).sort((a, b) => sort === "quantity" ? a.quantityOnHand - b.quantityOnHand
    : sort === "expiry" ? (expiryByBalance.get(`${a.medicineId}:${a.facilityId}`) ?? Infinity) - (expiryByBalance.get(`${b.medicineId}:${b.facilityId}`) ?? Infinity)
    : a.medicineName.localeCompare(b.medicineName)), [items, medicines, query, facilityId, status, sort, expiryByBalance, now]);

  const lowMedicineCount = new Set(items.filter(x => x.isBelowMinimum && x.isMedicineActive).map(x => x.medicineId)).size;
  const expiringSoon = batches.filter(x => new Date(x.expiryDateUtc).getTime() <= now + 30 * 86400000);
  const submitMedicine = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    const validation: MedicineErrors = {
      code: validateMedicineCode(draft.code), name: validateMedicineName(draft.name),
      unit: validateUnit(draft.unit), minimumStockLevel: validateMinimumStock(draft.minimumStockLevel),
    };
    setDraftErrors(validation);
    if (Object.values(validation).some(Boolean)) return;
    setSaving(true);
    try {
      await medicineApi.create({ ...draft, name: draft.name.trim(), code: draft.code.trim(), unit: draft.unit.trim(), minimumStockLevel: Number(draft.minimumStockLevel) });
      setDraft(blankMedicine); setDraftErrors({}); setShowCreate(false); setNotice("Medicine created. Receive stock to add a facility balance."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Medicine could not be created."); }
    finally { setSaving(false); }
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className="eyebrow">MEDISTOCK / INVENTORY</p><h1>Facility stock control</h1><p className={styles.subtitle}>Medicine balances, batch risks, and stock activity in one place.</p></div>
      <nav className={styles.actions}><button type="button" onClick={() => setShowCreate(x => !x)}>＋ Add medicine</button><Link className={styles.primaryLink} to="/inventory/receive">＋ Receive stock</Link><Link to="/inventory/expiry">Expiry watch</Link></nav>
    </header>

    <section className={styles.metrics} aria-label="Inventory overview">
      <article><span>Active medicines</span><strong>{medicines.filter(x => x.isActive).length}</strong></article>
      <article><span>Facilities</span><strong>{facilities.filter(x => x.isActive).length}</strong></article>
      <article><span>Units on hand</span><strong>{items.filter(x => x.isMedicineActive).reduce((sum, x) => sum + x.quantityOnHand, 0).toLocaleString()}</strong></article>
      <article className={lowMedicineCount ? styles.warning : ""}><span>Low stock medicines</span><strong>{lowMedicineCount}</strong></article>
      <article className={expiringSoon.length ? styles.warning : ""}><span>Expiring in 30 days</span><strong>{expiringSoon.length}</strong></article>
      <article><span>Active batches</span><strong>{batches.length}</strong></article>
    </section>

    {showCreate && <section className={styles.createPanel}><div><h2>Add medicine</h2><p>Create a catalog item first, then receive a batch to put it into facility stock.</p></div><form noValidate onSubmit={submitMedicine} className={styles.createForm}>
      <label>Medicine code<input required aria-invalid={Boolean(draftErrors.code)} aria-describedby="medicine-code-error" value={draft.code} onChange={e => { const code = e.target.value; setDraft({ ...draft, code }); setDraftErrors(errors => ({ ...errors, code: validateMedicineCode(code) })); }} onBlur={e => { const code = e.currentTarget.value; setDraftErrors(errors => ({ ...errors, code: validateMedicineCode(code) })); }} />{draftErrors.code && <small id="medicine-code-error" className={styles.fieldError} role="alert">{draftErrors.code}</small>}</label>
      <label>Medicine name<input required aria-invalid={Boolean(draftErrors.name)} aria-describedby="medicine-name-error" value={draft.name} onChange={e => { const name = e.target.value; setDraft({ ...draft, name }); setDraftErrors(errors => ({ ...errors, name: validateMedicineName(name) })); }} />{draftErrors.name && <small id="medicine-name-error" className={styles.fieldError} role="alert">{draftErrors.name}</small>}</label>
      <label>Unit<input required aria-invalid={Boolean(draftErrors.unit)} aria-describedby="medicine-unit-error" value={draft.unit} onChange={e => { const unit = e.target.value; setDraft({ ...draft, unit }); setDraftErrors(errors => ({ ...errors, unit: validateUnit(unit) })); }} />{draftErrors.unit && <small id="medicine-unit-error" className={styles.fieldError} role="alert">{draftErrors.unit}</small>}</label>
      <label>Minimum stock<input required type="text" inputMode="numeric" aria-invalid={Boolean(draftErrors.minimumStockLevel)} aria-describedby="minimum-stock-error" value={draft.minimumStockLevel} onChange={e => { const minimumStockLevel = e.target.value; setDraft({ ...draft, minimumStockLevel }); setDraftErrors(errors => ({ ...errors, minimumStockLevel: validateMinimumStock(minimumStockLevel) })); }} />{draftErrors.minimumStockLevel && <small id="minimum-stock-error" className={styles.fieldError} role="alert">{draftErrors.minimumStockLevel}</small>}</label>
      <button disabled={saving} type="submit">{saving ? "Saving…" : "Create medicine"}</button>
    </form></section>}

    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <InventoryAgentPanel />
    <section className={styles.inventorySection}>
      <div className={styles.sectionHeading}><div><p className="eyebrow">STOCK REGISTER</p><h2>Inventory balances</h2></div><span>{filtered.length} balances</span></div>
      <div className={styles.filters}>
        <label className={styles.search}>Search<input type="search" placeholder="Medicine name or code" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label>Facility<select value={facilityId} onChange={e => setFacilityId(e.target.value)}><option value="">All facilities</option>{facilities.filter(x => x.isActive).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Status<select value={status} onChange={e => setStatus(e.target.value as StatusFilter)}><option value="all">All statuses</option><option value="low">Low stock</option><option value="healthy">Normal</option><option value="expiring">Expiring soon</option><option value="active">Active medicines</option><option value="archived">Archived medicines</option></select></label>
        <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Medicine name</option><option value="quantity">Stock quantity</option><option value="expiry">Nearest expiry</option></select></label>
      </div>
      {isLoading && <p className={styles.state}>Loading inventory balances…</p>}
      {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void load()}>Retry</button></p>}
      {!isLoading && !error && filtered.length === 0 && <p className={styles.state}>No balances match these filters. Try changing your search or receive stock for a medicine.</p>}
      {!isLoading && !error && filtered.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Medicine</th><th>Facility</th><th>On hand</th><th>Available</th><th>Minimum</th><th>Nearest expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(item => { const expiry = expiryByBalance.get(`${item.medicineId}:${item.facilityId}`); return <tr key={item.id}>
          <td><Link to={`/inventory/${item.id}`}>{item.medicineName}</Link><small>{medicines.find(x => x.id === item.medicineId)?.code}</small></td><td>{item.facilityName}</td><td>{item.quantityOnHand}</td><td>{item.availableQuantity}</td><td>{item.minimumStockLevel}</td><td>{expiry && Number.isFinite(expiry) ? new Date(expiry).toLocaleDateString() : "—"}</td>
          <td><span className={`${styles.badge} ${!item.isMedicineActive ? styles.muted : item.isBelowMinimum ? styles.danger : styles.good}`}>{!item.isMedicineActive ? "Archived" : item.isBelowMinimum ? "Low" : "Normal"}</span></td><td><Link to={`/inventory/${item.id}`}>View / edit</Link></td>
        </tr>; })}
      </tbody></table></div>}
    </section>
  </main>;
}
