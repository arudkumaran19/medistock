/**
 * TEMPORARY DEVELOPMENT SIGN-IN CLIENT. DELETE ON INTEGRATION.
 *
 * Authentication is owned by Vaisnavi L. (IT24102469). This calls the development-only
 * /api/dev/token endpoint so the Demand pages are usable before her real sign-in lands,
 * and is replaced wholesale by it.
 */
import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/demand';

export type UserRole = 'STORE_OFFICER' | 'FACILITY_MANAGER' | 'SUPPLIER_OFFICER' | 'ADMIN';

export interface Session {
  accessToken: string;
  role: UserRole;
  displayName: string;
  expiresAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  STORE_OFFICER: 'Store Officer',
  FACILITY_MANAGER: 'Facility Manager',
  SUPPLIER_OFFICER: 'Supplier Officer',
  ADMIN: 'Administrator',
};

export async function requestDevToken(role: UserRole): Promise<Session> {
  const response = await apiClient.post<ApiResponse<Session>>('/api/dev/token', { role });

  return response.data.data;
}
