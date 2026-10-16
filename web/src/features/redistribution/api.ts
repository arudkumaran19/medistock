/**
 * Redistribution API client and React Query hooks. Redistribution vertical (Member 3).
 * Talks only to ASP.NET Core (/api/transfers); never to the agent service directly.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/services/apiClient';

export type TransferStatus =
  | 'Draft'
  | 'Requested'
  | 'Proposed'
  | 'Approved'
  | 'Reserved'
  | 'InTransit'
  | 'Delivered'
  | 'Rejected'
  | 'Cancelled';

export type TransferPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export const TRANSFER_PRIORITIES: TransferPriority[] = ['Low', 'Medium', 'High', 'Critical'];

/** The forward path drawn by the pipeline stepper. Rejected and Cancelled end it early. */
export const TRANSFER_PIPELINE: TransferStatus[] = [
  'Draft',
  'Requested',
  'Proposed',
  'Approved',
  'Reserved',
  'InTransit',
  'Delivered',
];

export interface TransferHistory {
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  changedAtUtc: string;
  reason: string | null;
}

export interface Transfer {
  id: string;
  transferNumber: string;
  medicineId: string;
  medicineName: string;
  unit: string;
  sourceFacilityId: string | null;
  sourceFacilityName: string | null;
  destinationFacilityId: string;
  destinationFacilityName: string;
  quantity: number;
  priority: TransferPriority;
  status: TransferStatus;
  batchNumber: string | null;
  estimatedDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  routingProvider: string | null;
  notes: string | null;
  rejectionReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  dispatchedAtUtc: string | null;
  deliveredAtUtc: string | null;
  allowedNextStatuses: TransferStatus[];
  history: TransferHistory[];
}

export interface TransferSummary {
  pendingApproval: number;
  approvedOrReserved: number;
  inTransit: number;
  delivered: number;
}

export interface Candidate {
  facilityId: string;
  facilityName: string;
  quantityOnHand: number;
  quantityReserved: number;
  minimumStock: number;
  availableSurplus: number;
  canFulfil: boolean;
  nearestExpiryUtc: string | null;
  distanceKm: number;
  durationMinutes: number;
  score: number;
}

export interface TransferRoute {
  sourceFacilityId: string;
  sourceFacilityName: string;
  sourceLatitude: number;
  sourceLongitude: number;
  destinationFacilityId: string;
  destinationFacilityName: string;
  destinationLatitude: number;
  destinationLongitude: number;
  distanceKm: number;
  durationMinutes: number;
  provider: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransferInput {
  medicineId: string;
  destinationFacilityId: string;
  quantity: number;
  priority: TransferPriority;
  notes?: string;
  submit?: boolean;
}

export interface TransferQuery {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const transferApi = {
  list: (query: TransferQuery) =>
    apiRequest<Paged<Transfer>>(`/api/transfers${qs({ ...query })}`),
  summary: () => apiRequest<TransferSummary>('/api/transfers/summary'),
  get: (id: string) => apiRequest<Transfer>(`/api/transfers/${id}`),
  candidates: (id: string) => apiRequest<Candidate[]>(`/api/transfers/${id}/candidates`),
  route: (id: string) => apiRequest<TransferRoute>(`/api/transfers/${id}/route`),
  create: (input: TransferInput) => apiRequest<Transfer>('/api/transfers', post(input)),
  update: (id: string, input: Pick<TransferInput, 'quantity' | 'priority' | 'notes'>) =>
    apiRequest<Transfer>(`/api/transfers/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  cancel: (id: string, reason?: string) =>
    apiRequest<Transfer>(`/api/transfers/${id}${qs({ reason })}`, { method: 'DELETE' }),
  submit: (id: string) => apiRequest<Transfer>(`/api/transfers/${id}/submit`, post()),
  propose: (id: string, sourceFacilityId: string, reason?: string) =>
    apiRequest<Transfer>(`/api/transfers/${id}/propose`, post({ sourceFacilityId, reason })),
  approve: (id: string, reason?: string) => apiRequest<Transfer>(`/api/transfers/${id}/approve`, post({ reason })),
  reject: (id: string, reason: string) => apiRequest<Transfer>(`/api/transfers/${id}/reject`, post({ reason })),
  reserve: (id: string) => apiRequest<Transfer>(`/api/transfers/${id}/reserve`, post()),
  dispatch: (id: string, reason?: string) => apiRequest<Transfer>(`/api/transfers/${id}/dispatch`, post({ reason })),
  deliver: (id: string, reason?: string) => apiRequest<Transfer>(`/api/transfers/${id}/deliver`, post({ reason })),
};

export const transferKeys = {
  all: ['transfers'] as const,
  list: (query: TransferQuery) => ['transfers', 'list', query] as const,
  summary: ['transfers', 'summary'] as const,
  detail: (id: string) => ['transfers', 'detail', id] as const,
  candidates: (id: string) => ['transfers', 'candidates', id] as const,
  route: (id: string) => ['transfers', 'route', id] as const,
};

export function useTransfers(query: TransferQuery) {
  return useQuery({
    queryKey: transferKeys.list(query),
    queryFn: () => transferApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useTransferSummary() {
  return useQuery({ queryKey: transferKeys.summary, queryFn: transferApi.summary });
}

export function useTransfer(id: string) {
  return useQuery({ queryKey: transferKeys.detail(id), queryFn: () => transferApi.get(id), enabled: !!id });
}

export function useCandidates(id: string, enabled: boolean) {
  return useQuery({ queryKey: transferKeys.candidates(id), queryFn: () => transferApi.candidates(id), enabled });
}

export function useRoute(id: string, enabled: boolean) {
  return useQuery({ queryKey: transferKeys.route(id), queryFn: () => transferApi.route(id), enabled, retry: false });
}

/** Any mutation refreshes every transfer query, so counts, list and detail stay in step. */
export function useTransferMutation<TArgs>(fn: (args: TArgs) => Promise<Transfer>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transferKeys.all }),
  });
}
