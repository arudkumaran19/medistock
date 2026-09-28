import { apiRequest } from "./apiClient";
import type { Batch, Facility, Inventory, Medicine, StockTransaction } from "../types/inventory";

export const inventoryApi = {
	list: (includeArchived = false) => apiRequest<Inventory[]>(`/api/inventory${includeArchived ? "?includeArchived=true" : ""}`), get: (id: string) => apiRequest<Inventory>(`/api/inventory/${id}`),
	receive: (payload: ReceivePayload) => apiRequest<Inventory>("/api/inventory/receive", { method: "POST", body: JSON.stringify(payload) }),
	adjust: (payload: AdjustPayload) => apiRequest<Inventory>("/api/inventory/adjust", { method: "POST", body: JSON.stringify(payload) }),
	reserve: (payload: ReservePayload) => apiRequest<Inventory>("/api/inventory/reserve", { method: "POST", body: JSON.stringify(payload) }),
	expiring: (days = 90) => apiRequest<Batch[]>(`/api/inventory/expiring?days=${days}`), batches: () => apiRequest<Batch[]>("/api/medicine-batches"), transactions: (medicineId: string, facilityId: string) => apiRequest<StockTransaction[]>(`/api/inventory/transactions?medicineId=${medicineId}&facilityId=${facilityId}`), medicines: (includeArchived = false) => apiRequest<Medicine[]>(`/api/medicines${includeArchived ? "?includeArchived=true" : ""}`),
	medicine: (id: string) => apiRequest<Medicine>(`/api/medicines/${id}`), facilities: () => apiRequest<Facility[]>("/api/facilities"), archiveMedicine: (id: string, reason: string) => apiRequest<Medicine>(`/api/medicines/${id}/archive`, { method: "POST", body: JSON.stringify({ reason }) }), createBatch: (payload: ReceivePayload) => apiRequest<Batch>("/api/medicine-batches", { method: "POST", body: JSON.stringify(payload) }), batch: (id: string) => apiRequest<Batch>(`/api/medicine-batches/${id}`), retireBatch: (id: string, reason: string) => apiRequest<Batch>(`/api/medicine-batches/${id}/retire`, { method: "POST", body: JSON.stringify({ reason }) })
};
export const medicineApi = {
	create: (payload: Omit<Medicine, "id" | "isActive">) => apiRequest<Medicine>("/api/medicines", { method: "POST", body: JSON.stringify(payload) }),
	update: (id: string, payload: Pick<Medicine, "name" | "unit" | "minimumStockLevel">) => apiRequest<Medicine>(`/api/medicines/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
};
export type ReceivePayload = { medicineId: string; facilityId: string; batchNumber: string; quantity: number; expiryDateUtc: string; manufacturingDateUtc: string };
export type AdjustPayload = { medicineId: string; facilityId: string; quantityDelta: number; reason: string };
export type ReservePayload = { medicineId: string; facilityId: string; quantity: number; reason: string };
