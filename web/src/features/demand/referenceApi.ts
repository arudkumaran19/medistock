/**
 * Medicine and facility reference data for the Demand screens.
 * Sathurstiga S. (IT24103156).
 *
 * The Demand API speaks in identifiers only - names belong to the Inventory vertical
 * (Vaisnavi L., IT24102469). Those tables now exist on develop and are served by
 * GET /api/medicines and GET /api/facilities, so this vertical reads them rather
 * than carrying a hard-coded map of seeded identifiers.
 *
 * This replaces the stopgap in reference.ts, which existed only because the
 * Inventory tables had not been built yet.
 */
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/services/apiClient';

import { registerReferenceNames } from './reference';

export interface MedicineRef {
  id: string;
  code: string;
  name: string;
  unit?: string;
  isActive?: boolean;
}

export interface FacilityRef {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
}

export async function getMedicines(): Promise<MedicineRef[]> {
  return apiRequest<MedicineRef[]>('/api/medicines');
}

export async function getFacilities(): Promise<FacilityRef[]> {
  return apiRequest<FacilityRef[]>('/api/facilities');
}

/** Reference data changes rarely, so it is cached for the session. */
const REFERENCE_STALE_MS = 5 * 60 * 1000;

export function useMedicines() {
  return useQuery({
    queryKey: ['reference', 'medicines'],
    queryFn: getMedicines,
    staleTime: REFERENCE_STALE_MS,
  });
}

export function useFacilities() {
  return useQuery({
    queryKey: ['reference', 'facilities'],
    queryFn: getFacilities,
    staleTime: REFERENCE_STALE_MS,
  });
}

/** True when a string is a well-formed GUID. */
export function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * Loads the Inventory reference data and registers the names for the display
 * helpers in reference.ts. Call this from any screen that renders medicine or
 * facility names so it re-renders when they arrive.
 */
export function useReferenceData() {
  const medicines = useMedicines();
  const facilities = useFacilities();

  if (medicines.data || facilities.data) {
    registerReferenceNames(medicines.data ?? [], facilities.data ?? []);
  }

  return {
    isLoading: medicines.isLoading || facilities.isLoading,
    medicines: medicines.data ?? [],
    facilities: facilities.data ?? [],
  };
}
