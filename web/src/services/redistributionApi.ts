import { apiClient } from './apiClient';
import {
  CandidateFacilityDto,
  CreateTransferRequest,
  ReceiveTransferRequest,
  ReserveStockRequest,
  RouteDetailsDto,
  TransferDto,
} from '../types/redistribution';

export interface TransferFilterParams {
  status?: string;
  sourceFacilityId?: string;
  destinationFacilityId?: string;
  medicineId?: string;
}

function normalizeTransfer(t: any): TransferDto {
  if (!t) return t;
  const firstItem = Array.isArray(t.items) && t.items.length > 0 ? t.items[0] : null;
  return {
    id: t.id,
    transferNumber: t.transferNumber || '',
    sourceFacilityId: t.sourceFacilityId || '',
    sourceFacilityName: t.sourceFacilityName || '',
    destinationFacilityId: t.destinationFacilityId || '',
    destinationFacilityName: t.destinationFacilityName || '',
    medicineId: t.medicineId || (firstItem ? firstItem.medicineId : ''),
    medicineName: t.medicineName || (firstItem ? firstItem.medicineName : 'Unknown Medicine'),
    medicineBatchNumber: t.medicineBatchNumber || (firstItem ? firstItem.batchNumber : '') || '',
    requestedQuantity: t.requestedQuantity ?? (firstItem ? firstItem.requestedQuantity : 0),
    allocatedQuantity: t.allocatedQuantity ?? (firstItem ? firstItem.allocatedQuantity : 0),
    status: t.status,
    priority: t.priority || 'Routine',
    distanceKm: t.distanceKm ?? t.estimatedDistanceKm ?? 0,
    estimatedDurationMinutes: t.estimatedDurationMinutes ?? 0,
    notes: t.notes || '',
    requestedAt: t.requestedAt || t.createdAt || new Date().toISOString(),
    approvedAt: t.approvedAt ?? null,
    reservedAt: t.reservedAt ?? null,
    dispatchedAt: t.dispatchedAt ?? null,
    deliveredAt: t.deliveredAt ?? null,
    workflowRunId: t.workflowRunId ?? null,
    items: t.items || [],
    statusHistories: t.statusHistories || t.statusHistory || [],
  };
}

function normalizeCandidate(c: any): CandidateFacilityDto {
  if (!c) return c;
  return {
    facilityId: c.facilityId,
    facilityName: c.facilityName || '',
    city: c.city || '',
    latitude: c.latitude ?? 0,
    longitude: c.longitude ?? 0,
    stockOnHand: c.stockOnHand ?? 0,
    safetyStock: c.safetyStock ?? c.safetyStockThreshold ?? 0,
    reservedStock: c.reservedStock ?? 0,
    availableSurplus: c.availableSurplus ?? 0,
    distanceKm: c.distanceKm ?? 0,
    estimatedDurationMinutes: c.estimatedDurationMinutes ?? 0,
    routingProvider: c.routingProvider || 'DeterministicHaversine',
    score: c.score ?? 0,
  };
}

function normalizeRoute(r: any): RouteDetailsDto {
  if (!r) return r;
  const raw = r.data || r;
  return {
    sourceFacilityId: raw.sourceFacilityId || '',
    sourceFacilityName: raw.sourceFacilityName || '',
    destinationFacilityId: raw.destinationFacilityId || '',
    destinationFacilityName: raw.destinationFacilityName || '',
    distanceKm: raw.distanceKm ?? 0,
    durationMinutes: raw.durationMinutes ?? raw.estimatedDurationMinutes ?? 0,
    provider: raw.provider || raw.routingProvider || 'HaversineFallback',
    isFallback: raw.isFallback ?? false,
    geometryGeoJson: raw.geometryGeoJson || raw.polylineGeometry || null,
    waypoints: (raw.waypoints || []).map((w: any) => ({
      latitude: w.latitude,
      longitude: w.longitude,
      label: w.label || '',
    })),
  };
}

export const redistributionApi = {
  // 1. GET /api/transfers
  getTransfers: async (params?: TransferFilterParams): Promise<TransferDto[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.sourceFacilityId) query.append('sourceFacilityId', params.sourceFacilityId);
    if (params?.destinationFacilityId) query.append('destinationFacilityId', params.destinationFacilityId);
    if (params?.medicineId) query.append('medicineId', params.medicineId);

    const queryString = query.toString();
    const res = await apiClient.get<any>(`/api/transfers${queryString ? `?${queryString}` : ''}`);
    const rawList: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.data?.items)
      ? res.data.items
      : Array.isArray(res?.data)
      ? res.data
      : [];
    return rawList.map(normalizeTransfer);
  },

  // 2. GET /api/transfers/{id}
  getTransferById: async (id: string): Promise<TransferDto> => {
    const res = await apiClient.get<any>(`/api/transfers/${id}`);
    const raw = res?.data || res;
    return normalizeTransfer(raw);
  },

  // 3. POST /api/transfers
  createTransfer: async (payload: CreateTransferRequest): Promise<TransferDto> => {
    const res = await apiClient.post<any>('/api/transfers', payload);
    const raw = res?.data || res;
    return normalizeTransfer(raw);
  },

  // 4. POST /api/transfers/{id}/request
  requestTransfer: async (id: string): Promise<TransferDto> => {
    const res = await apiClient.post<any>(`/api/transfers/${id}/request`);
    const raw = res?.data || res;
    return normalizeTransfer(raw);
  },

  // 5. POST /api/transfers/{id}/reserve
  reserveStock: async (id: string, payload: ReserveStockRequest): Promise<TransferDto> => {
    const res = await apiClient.post<any>(`/api/transfers/${id}/reserve`, payload);
    const raw = res?.data || res;
    return normalizeTransfer(raw);
  },

  // 6. POST /api/transfers/{id}/receive
  receiveTransfer: async (id: string, payload: ReceiveTransferRequest): Promise<TransferDto> => {
    const res = await apiClient.post<any>(`/api/transfers/${id}/receive`, payload);
    const raw = res?.data || res;
    return normalizeTransfer(raw);
  },

  // 7. GET /api/transfers/{id}/candidates
  getCandidates: async (id: string): Promise<CandidateFacilityDto[]> => {
    const res = await apiClient.get<any>(`/api/transfers/${id}/candidates`);
    const rawList: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
      ? res.data
      : [];
    return rawList.map(normalizeCandidate);
  },

  // 8. GET /api/transfers/{id}/route
  getRoute: async (id: string): Promise<RouteDetailsDto> => {
    const res = await apiClient.get<any>(`/api/transfers/${id}/route`);
    return normalizeRoute(res);
  },
};
