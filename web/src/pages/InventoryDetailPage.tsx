import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { inventoryApi } from "../services/inventoryApi";
import type { Inventory } from "../types/inventory";

export function InventoryDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Inventory>();
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    if (!id) return;
    setIsLoading(true);
    setError("");
    try { setItem(await inventoryApi.get(id)); }
    catch (e) { setError((e as Error).message); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { void refresh(); }, [id]);

  const adjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    setIsSubmitting(true); setError(""); setMessage("");
    try {
      await inventoryApi.adjust({ medicineId: item.medicineId, facilityId: item.facilityId, quantityDelta: Number(delta), reason });
      setMessage("Stock adjustment recorded."); setDelta("0"); setReason(""); await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  const archive = async () => {
    if (!item || !archiveReason.trim() || !window.confirm("Archive this medicine? Stock records and audit history will be preserved.")) return;
    setIsSubmitting(true); setError(""); setMessage("");
    try { await inventoryApi.archiveMedicine(item.medicineId, archiveReason); setMessage("Medicine archived."); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  return <main>
    <Link to="/inventory">Back to inventory</Link>
    {isLoading && <p>Loading balance...</p>}
    {error && <p className="error">{error}</p>}
    {message && <p>{message}</p>}
    {item && <>
      <p className="eyebrow">BALANCE DETAIL</p>
      <h1>{item.medicineName}</h1>
      <div className="detail-grid"><span>Facility</span><strong>{item.facilityName}</strong><span>On hand</span><strong>{item.quantityOnHand}</strong><span>Reserved</span><strong>{item.quantityReserved}</strong><span>Available</span><strong>{item.availableQuantity}</strong><span>Minimum</span><strong>{item.minimumStockLevel}</strong></div>
      <section><p className="eyebrow">ADJUST STOCK</p><form onSubmit={adjust}><label>Quantity delta<input required type="number" value={delta} onChange={e => setDelta(e.target.value)} /></label><label>Reason<input required value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving..." : "Record adjustment"}</button></form></section>
      <section><p className="eyebrow">ARCHIVE MEDICINE</p><form onSubmit={e => { e.preventDefault(); void archive(); }}><label>Archive reason<input required value={archiveReason} onChange={e => setArchiveReason(e.target.value)} /></label><button disabled={isSubmitting} className="danger" type="submit">{isSubmitting ? "Saving..." : "Archive medicine"}</button></form></section>
    </>}
  </main>;
}
