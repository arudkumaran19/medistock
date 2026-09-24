import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { inventoryApi, medicineApi } from "../services/inventoryApi";
import type { Inventory, Medicine, StockTransaction } from "../types/inventory";
import { validateMedicineName, validateMinimumStock, validateUnit } from "../utils/inventoryValidation";

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
  const [editErrors, setEditErrors] = useState<{ name?: string; unit?: string; minimumStockLevel?: string }>({});

  const refresh = async () => {
    if (!id) return;
    setIsLoading(true); setError("");
    try {
      const balance = await inventoryApi.get(id);
      const [medicineData, history] = await Promise.all([inventoryApi.medicine(balance.medicineId), inventoryApi.transactions(balance.medicineId, balance.facilityId)]);
      setItem(balance); setMedicine(medicineData); setTransactions(history);
    } catch (e) { setError((e as Error).message); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { void refresh(); }, [id]);

  const adjust = async (event: FormEvent) => {
    event.preventDefault(); if (!item) return;
    setIsSubmitting(true); setError(""); setMessage("");
    try { await inventoryApi.adjust({ medicineId: item.medicineId, facilityId: item.facilityId, quantityDelta: Number(delta), reason }); setMessage("Stock adjustment recorded."); setDelta("0"); setReason(""); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  const edit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!medicine) return;
    const form = new FormData(event.currentTarget);
    const values = { name: String(form.get("name")), unit: String(form.get("unit")), minimumStockLevel: String(form.get("minimumStockLevel")) };
    const validation = { name: validateMedicineName(values.name), unit: validateUnit(values.unit), minimumStockLevel: validateMinimumStock(values.minimumStockLevel) };
    setEditErrors(validation);
    if (Object.values(validation).some(Boolean)) return;
    setIsSubmitting(true); setError(""); setMessage("");
    try { const updated = await medicineApi.update(medicine.id, { name: values.name.trim(), unit: values.unit.trim(), minimumStockLevel: Number(values.minimumStockLevel) }); setMedicine(updated); setMessage("Medicine details updated."); setEditErrors({}); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  const archive = async () => {
    if (!item || !medicine || !archiveReason.trim() || !window.confirm("Archive this medicine? Stock records and audit history will be preserved.")) return;
    setIsSubmitting(true); setError(""); setMessage("");
    try { const archived = await inventoryApi.archiveMedicine(item.medicineId, archiveReason); setMedicine(archived); setMessage("Medicine archived. Stock and transaction history remain available."); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  return <main>
    <Link to="/inventory">← Back to inventory</Link>
    {isLoading && <p role="status">Loading balance and transaction history…</p>}
    {error && <p className="error" role="alert">{error} <button type="button" onClick={() => void refresh()}>Retry</button></p>}
    {message && <p role="status">{message}</p>}
    {item && medicine && <>
      <p className="eyebrow">MEDICINE / BALANCE DETAIL</p><h1>{item.medicineName}</h1>
      <p>{medicine.code} · {medicine.unit} · {medicine.isActive ? "Active" : "Archived"}</p>
      <section className="detail-grid"><span>Facility</span><strong>{item.facilityName}</strong><span>On hand</span><strong>{item.quantityOnHand} {medicine.unit}</strong><span>Reserved</span><strong>{item.quantityReserved}</strong><span>Available</span><strong>{item.availableQuantity}</strong><span>Minimum</span><strong>{item.minimumStockLevel}</strong><span>Status</span><strong className={item.isBelowMinimum ? "danger" : "status"}>{item.isBelowMinimum ? "Below minimum" : "Normal"}</strong></section>
      {medicine.isActive && <>
        <section><p className="eyebrow">EDIT MEDICINE</p><form noValidate onSubmit={edit}>
          <label>Medicine name<input name="name" required aria-invalid={Boolean(editErrors.name)} aria-describedby="edit-medicine-name-error" defaultValue={medicine.name} onChange={e => setEditErrors(errors => ({ ...errors, name: validateMedicineName(e.target.value) }))} />{editErrors.name && <small id="edit-medicine-name-error" className="error" role="alert">{editErrors.name}</small>}</label>
          <label>Unit<input name="unit" required aria-invalid={Boolean(editErrors.unit)} aria-describedby="edit-medicine-unit-error" defaultValue={medicine.unit} onChange={e => setEditErrors(errors => ({ ...errors, unit: validateUnit(e.target.value) }))} />{editErrors.unit && <small id="edit-medicine-unit-error" className="error" role="alert">{editErrors.unit}</small>}</label>
          <label>Minimum stock level<input name="minimumStockLevel" required type="text" inputMode="numeric" aria-invalid={Boolean(editErrors.minimumStockLevel)} aria-describedby="edit-minimum-stock-error" defaultValue={medicine.minimumStockLevel} onChange={e => setEditErrors(errors => ({ ...errors, minimumStockLevel: validateMinimumStock(e.target.value) }))} />{editErrors.minimumStockLevel && <small id="edit-minimum-stock-error" className="error" role="alert">{editErrors.minimumStockLevel}</small>}</label>
          <button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : "Save medicine details"}</button></form></section>
        <section><p className="eyebrow">ADJUST STOCK</p><form onSubmit={adjust}><label>Quantity delta<input required type="number" step="1" value={delta} onChange={e => setDelta(e.target.value)} /></label><label>Reason<input required value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : "Record adjustment"}</button></form></section>
        <section><p className="eyebrow">ARCHIVE MEDICINE</p><p>Archiving is available when all on-hand and reserved stock has been cleared.</p><form onSubmit={e => { e.preventDefault(); void archive(); }}><label>Archive reason<input required value={archiveReason} onChange={e => setArchiveReason(e.target.value)} /></label><button disabled={isSubmitting} className="danger" type="submit">{isSubmitting ? "Saving…" : "Archive medicine"}</button></form></section>
      </>}
      <section><p className="eyebrow">AUDIT TRAIL</p><h2>Stock transactions</h2>{transactions.length === 0 ? <p>No transactions recorded for this balance.</p> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Quantity</th><th>Reason</th><th>Batch</th><th>Balance after</th></tr></thead><tbody>{transactions.map(tx => <tr key={tx.id}><td>{new Date(tx.createdAtUtc).toLocaleString()}</td><td>{tx.type}</td><td>{tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}</td><td>{tx.reason}</td><td>{tx.batchNumber ?? "—"}</td><td>{tx.balanceAfter}</td></tr>)}</tbody></table></div>}</section>
    </>}
  </main>;
}
