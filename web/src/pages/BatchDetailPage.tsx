import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { inventoryApi } from "../services/inventoryApi";
import type { Batch } from "../types/inventory";

export function BatchDetailPage() {
  const { id } = useParams();
  const [batch, setBatch] = useState<Batch>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => { if (id) inventoryApi.batch(id).then(setBatch).catch((e: Error) => setError(e.message)); }, [id]);

  const retire = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !batch || !reason.trim() || batch.quantityOnHand <= 0) return;
    if (!window.confirm("Retire this batch? Its stock will be removed through an audited adjustment and the batch history will be preserved.")) return;
    setIsSubmitting(true); setError(""); setMessage("");
    try { const retired = await inventoryApi.retireBatch(id, reason); setBatch(retired); setReason(""); setMessage("Batch retired. Its history and audit transaction were preserved."); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  return <main><Link to="/inventory/expiry">Back to expiry</Link>{error && <p className="error">{error}</p>}{message && <p>{message}</p>}{!batch && !error && <p>Loading batch...</p>}{batch && <><p className="eyebrow">BATCH DETAIL</p><h1>{batch.medicineName}</h1><div className="detail-grid"><span>Batch</span><strong>{batch.batchNumber}</strong><span>Quantity</span><strong>{batch.quantityOnHand}</strong><span>Manufactured</span><strong>{new Date(batch.manufacturingDateUtc).toLocaleDateString()}</strong><span>Expires</span><strong>{new Date(batch.expiryDateUtc).toLocaleDateString()}</strong></div>{batch.quantityOnHand > 0 ? <section><p className="eyebrow">RETIRE BATCH</p><form onSubmit={retire}><label>Retirement reason<input required value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={isSubmitting} className="danger" type="submit">{isSubmitting ? "Saving..." : "Retire batch"}</button></form></section> : <p>Batch retired; audit history is preserved.</p>}</>}</main>;
}
