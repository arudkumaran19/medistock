import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { inventoryApi } from "../services/inventoryApi";
import type { Facility, Medicine } from "../types/inventory";

export function ReceiveStockPage() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ medicineId: "", facilityId: "", batchNumber: "", quantity: 1, expiryDateUtc: "", manufacturingDateUtc: "" });

  useEffect(() => {
    Promise.all([inventoryApi.medicines(), inventoryApi.facilities()]).then(([medicineList, facilityList]) => {
      const activeMedicines = medicineList.filter(x => x.isActive);
      setMedicines(activeMedicines); setFacilities(facilityList);
      setForm(x => ({ ...x, medicineId: activeMedicines[0]?.id ?? "", facilityId: facilityList[0]?.id ?? "" }));
    }).catch((e: Error) => setError(e.message)).finally(() => setIsLoading(false));
  }, []);

  const update = (key: string, value: string) => setForm(x => ({ ...x, [key]: key === "quantity" ? Number(value) : value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage(""); setError("");
    if (!form.batchNumber.trim() || form.batchNumber.trim() === "-1") { setError("Enter a meaningful batch number."); return; }
    if (form.quantity <= 0 || !Number.isInteger(form.quantity)) { setError("Quantity must be a positive whole number."); return; }
    if (!form.manufacturingDateUtc || !form.expiryDateUtc || new Date(form.expiryDateUtc) <= new Date(form.manufacturingDateUtc)) { setError("Expiry date must be later than manufacture date."); return; }
    setIsSubmitting(true);
    try { await inventoryApi.receive({ ...form, expiryDateUtc: new Date(form.expiryDateUtc).toISOString(), manufacturingDateUtc: new Date(form.manufacturingDateUtc).toISOString() }); setMessage("Stock received successfully."); setTimeout(() => navigate("/inventory"), 500); }
    catch (e) { setError((e as Error).message); }
    finally { setIsSubmitting(false); }
  };

  return <main><Link to="/inventory">Back to inventory</Link><p className="eyebrow">STOCK INTAKE</p><h1>Receive a medicine batch</h1>{isLoading && <p>Loading medicines and facilities...</p>}{error && <p className="error">{error}</p>}{message && <p>{message}</p>}{!isLoading && <form onSubmit={submit}><label>Medicine<select required value={form.medicineId} onChange={e => update("medicineId", e.target.value)}><option value="">Select medicine</option>{medicines.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label><label>Facility<select required value={form.facilityId} onChange={e => update("facilityId", e.target.value)}><option value="">Select facility</option>{facilities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{(["batchNumber", "quantity", "manufacturingDateUtc", "expiryDateUtc"] as const).map(key => <label key={key}>{key.replace("Utc", "")}<input required type={key.includes("Date") ? "date" : key === "quantity" ? "number" : "text"} placeholder={key === "batchNumber" ? "e.g. ABC-123" : undefined} value={form[key]} onChange={e => update(key, e.target.value)} /></label>)}<button disabled={isSubmitting || !medicines.length || !facilities.length} type="submit">{isSubmitting ? "Saving..." : "Record receipt"}</button></form>}</main>;
}
