import { apiRequest } from './apiClient';
import type { AuditLogQuery, AuditStatsResponse, SystemAuditLog } from '@/types/audit';
import type { PagedResponse } from '@/types/demand';

function qs(query: object): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });

  const text = params.toString();
  return text ? `?${text}` : '';
}

export async function getAuditLogs(query: AuditLogQuery): Promise<PagedResponse<SystemAuditLog>> {
  return apiRequest<PagedResponse<SystemAuditLog>>(`/api/admin/audit-logs${qs(query)}`);
}

export async function getAuditStats(): Promise<AuditStatsResponse> {
  return apiRequest<AuditStatsResponse>('/api/admin/audit-logs/stats');
}

export async function getAuditLogById(id: string): Promise<SystemAuditLog> {
  return apiRequest<SystemAuditLog>(`/api/admin/audit-logs/${id}`);
}

export async function exportAuditLogsCsv(query: AuditLogQuery): Promise<Blob> {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/admin/audit-logs/export${qs(query)}`, {
    headers: {
      Accept: 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }

  return response.blob();
}
