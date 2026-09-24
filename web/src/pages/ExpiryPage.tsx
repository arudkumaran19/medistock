import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { inventoryApi } from "../services/inventoryApi";
import type { Batch, Facility } from "../types/inventory";
import styles from "./ExpiryPage.module.css";

export function ExpiryPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [days, setDays] = useState(90);
  const [query, setQuery] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const requestKey = `${days}:${requestVersion}`;
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [requestError, setRequestError] = useState<{ key: string; message: string }>();
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    Promise.all([inventoryApi.expiring(days), inventoryApi.facilities()])
      .then(([rows, locations]) => { if (!cancelled) { setBatches(rows); setFacilities(locations); } })
      .catch((e: Error) => { if (!cancelled) setRequestError({ key: requestKey, message: e.message }); })
      .finally(() => { if (!cancelled) setLoadedRequestKey(requestKey); });
    return () => { cancelled = true; };
  }, [days, requestKey]);
  const isLoading = loadedRequestKey !== requestKey;
  const error = requestError?.key === requestKey ? requestError.message : "";
  const visible = useMemo(() => batches.filter(x => `${x.medicineName} ${x.batchNumber}`.toLowerCase().includes(query.trim().toLowerCase())), [batches, query]);
  const critical = batches.filter(x => new Date(x.expiryDateUtc).getTime() < now).length;
  return <main className={styles.page}>
    <Link to="/inventory">← Back to inventory</Link><p className="eyebrow">BATCH RISK MONITORING</p><h1>Expiry watch</h1>
    <p className={styles.description}>Review active batches by expiry date. Retire unusable stock through the audited batch action.</p>
    <div className={styles.summary}><article><span>Within selected window</span><strong>{batches.length}</strong></article><article className={critical ? styles.critical : ""}><span>Past expiry</span><strong>{critical}</strong></article><article><span>Units at risk</span><strong>{batches.reduce((sum, x) => sum + x.quantityOnHand, 0).toLocaleString()}</strong></article></div>
    <div className={styles.filters}><label>Expiry window<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={30}>Next 30 days</option><option value={90}>Next 90 days</option><option value={180}>Next 180 days</option></select></label><label>Search<input type="search" placeholder="Medicine or batch" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    {isLoading && <p role="status">Loading expiry data…</p>}{error && <p className="error" role="alert">{error} <button onClick={() => setRequestVersion(version => version + 1)} type="button">Retry</button></p>}
    {!isLoading && !error && visible.length === 0 && <p className={styles.empty}>No active batches match this expiry window and search.</p>}
    {!isLoading && !error && visible.length > 0 && <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Batch</th><th>Facility</th><th>Quantity</th><th>Expires</th><th>Alert</th><th>Action</th></tr></thead><tbody>{visible.map(batch => { const expired = new Date(batch.expiryDateUtc).getTime() < now; const daysLeft = Math.ceil((new Date(batch.expiryDateUtc).getTime() - now) / 86400000); return <tr key={batch.id}><td>{batch.medicineName}</td><td>{batch.batchNumber}</td><td>{facilities.find(f => f.id === batch.facilityId)?.name ?? "Unknown"}</td><td>{batch.quantityOnHand}</td><td>{new Date(batch.expiryDateUtc).toLocaleDateString()}</td><td><span className={`${styles.badge} ${expired ? styles.critical : styles.soon}`}>{expired ? "Expired" : daysLeft <= 30 ? "Expiring soon" : "Monitor"}</span></td><td><Link to={`/batches/${batch.id}`}>Review batch</Link></td></tr>; })}</tbody></table></div>}
  </main>;
}
