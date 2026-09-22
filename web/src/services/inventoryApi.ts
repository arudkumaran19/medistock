import { apiRequest } from "./apiClient";
import type { Batch, Facility, Inventory, Medicine } from "../types/inventory";

export const inventoryApi = {
	list: () => apiRequest<Inventory[]>("/api/inventory"), get: (id: string) => apiRequest<Inventory>(`/api/inventory/${id}`),
	receive: (payload: ReceivePayload) => apiRequest<Inventory>("/api/inventory/receive", { method: "POST", body: JSON.stringify(payload) }),
	adjust: (payload: AdjustPayload) => apiRequest<Inventory>("/api/inventory/adjust", { method: "POST", body: JSON.stringify(payload) }),
	reserve: (payload: ReservePayload) => apiRequest<Inventory>("/api/inventory/reserve", { method: "POST", body: JSON.stringify(payload) }),
	expiring: (days = 90) => apiRequest<Batch[]>(`/api/inventory/expiring?days=${days}`), medicines: () => apiRequest<Medicine[]>("/api/medicines"),
	medicine: (id: string) => apiRequest<Medicine>(`/api/medicines/${id}`), facilities: () => apiRequest<Facility[]>("/api/facilities"), archiveMedicine: (id: string, reason: string) => apiRequest<Medicine>(`/api/medicines/${id}/archive`, { method: "POST", body: JSON.stringify({ reason }) }), createBatch: (payload: ReceivePayload) => apiRequest<Batch>("/api/medicine-batches", { method: "POST", body: JSON.stringify(payload) }), batch: (id: string) => apiRequest<Batch>(`/api/medicine-batches/${id}`), retireBatch: (id: string, reason: string) => apiRequest<Batch>(`/api/medicine-batches/${id}/retire`, { method: "POST", body: JSON.stringify({ reason }) })
};
export type ReceivePayload = { medicineId: string; facilityId: string; batchNumber: string; quantity: number; expiryDateUtc: string; manufacturingDateUtc: string };
export type AdjustPayload = { medicineId: string; facilityId: string; quantityDelta: number; reason: string };
export type ReservePayload = { medicineId: string; facilityId: string; quantity: number; reason: string };
