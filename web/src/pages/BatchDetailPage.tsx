import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { inventoryApi } from "../services/inventoryApi";
import type { Batch, Facility, Inventory } from "../types/inventory";

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

  const refresh = async () => {
    if (!id) return;
    setLoading(true); setError("");
    try {
      const batchData = await inventoryApi.batch(id);
      const [facilityRows, balances] = await Promise.all([inventoryApi.facilities(), inventoryApi.list(true)]);
      setBatch(batchData); setFacility(facilityRows.find(x => x.id === batchData.facilityId));
      setBalance(balances.find(x => x.medicineId === batchData.medicineId && x.facilityId === batchData.facilityId));
    } catch (e) { setError(e instanceof Error ? e.message : "Batch could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [id]);

  const retire = async (event: FormEvent) => {
    event.preventDefault(); if (!id || !batch || !reason.trim() || batch.quantityOnHand <= 0) return;
    if (!window.confirm("Retire this batch? Its remaining quantity will be removed through an audited stock transaction. Batch and transaction history will be preserved.")) return;
    setIsSubmitting(true); setError(""); setMessage("");
    try { const retired = await inventoryApi.retireBatch(id, reason.trim()); setBatch(retired); setReason(""); setMessage("Batch retired. Its history and audit transaction were preserved."); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  const adjust = async (event: FormEvent) => {
    event.preventDefault(); if (!batch) return;
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0) { setError("Enter a non-zero whole-number adjustment."); return; }
    setIsSubmitting(true); setError(""); setMessage("");
    try { await inventoryApi.adjust({ medicineId: batch.medicineId, facilityId: batch.facilityId, quantityDelta: amount, reason: adjustReason.trim() }); setDelta(""); setAdjustReason(""); setMessage("Stock adjustment recorded in transaction history."); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  const expired = batch ? new Date(batch.expiryDateUtc).getTime() < Date.now() : false;
  return <main>
    <Link to="/inventory/expiry">← Back to expiry watch</Link>
    {loading && <p role="status">Loading batch details…</p>}
    {error && <p className="error" role="alert">{error} <button type="button" onClick={() => void refresh()}>Retry</button></p>}
    {message && <p role="status">{message}</p>}
    {batch && <>
      <p className="eyebrow">BATCH MANAGEMENT</p><h1>{batch.medicineName}</h1>
      <section className="detail-grid"><span>Medicine</span><strong>{batch.medicineName}</strong><span>Facility</span><strong>{facility?.name ?? batch.facilityId}</strong><span>Batch number</span><strong>{batch.batchNumber}</strong><span>On hand</span><strong>{batch.quantityOnHand}</strong><span>Available</span><strong>{balance?.availableQuantity ?? "—"}</strong><span>Reserved</span><strong>{balance?.quantityReserved ?? "—"}</strong><span>Manufactured</span><strong>{new Date(batch.manufacturingDateUtc).toLocaleDateString()}</strong><span>Expires</span><strong>{new Date(batch.expiryDateUtc).toLocaleDateString()}</strong><span>Status</span><strong className={batch.quantityOnHand <= 0 ? "status" : expired ? "danger" : "status"}>{batch.quantityOnHand <= 0 ? "Retired" : expired ? "Expired" : "Active"}</strong></section>
      {batch.quantityOnHand > 0 && <>
        <section><p className="eyebrow">ADJUST STOCK</p><form onSubmit={adjust}><label>Quantity delta<input required type="number" step="1" value={delta} onChange={e => setDelta(e.target.value)} /></label><label>Reason<input required value={adjustReason} onChange={e => setAdjustReason(e.target.value)} /></label><button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : "Record adjustment"}</button></form></section>
        <section><p className="eyebrow">RETIRE BATCH</p><p>Retirement sets this batch's operational quantity to zero and records the change for audit.</p><form onSubmit={retire}><label>Retirement reason<input required value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={isSubmitting} className="danger" type="submit">{isSubmitting ? "Saving…" : "Retire batch"}</button></form></section>
      </>}
      {batch.quantityOnHand <= 0 && <p>This batch is retired; its recorded history remains available.</p>}
    </>}
  </main>;
}
