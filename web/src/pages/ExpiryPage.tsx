import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { inventoryApi } from "../services/inventoryApi";
import type { Batch } from "../types/inventory";

export function ExpiryPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { inventoryApi.expiring().then(setBatches).catch((e: Error) => setError(e.message)).finally(() => setIsLoading(false)); }, []);
  return <main><Link to="/inventory">Back to inventory</Link><p className="eyebrow">RISK WINDOW / 90 DAYS</p><h1>Expiring stock</h1>{isLoading && <p>Loading expiring stock...</p>}{error && <p className="error">{error}</p>}{!isLoading && !error && !batches.length && <p>No stock is expiring in the next 90 days.</p>}{!isLoading && !error && !!batches.length && <div className="table-wrap"><table><thead><tr><th>Medicine</th><th>Batch</th><th>Quantity</th><th>Expires</th></tr></thead><tbody>{batches.map(batch => <tr key={batch.id}><td>{batch.medicineName}</td><td><Link to={`/batches/${batch.id}`}>{batch.batchNumber}</Link></td><td>{batch.quantityOnHand}</td><td>{new Date(batch.expiryDateUtc).toLocaleDateString()}</td></tr>)}</tbody></table></div>}</main>;
}
