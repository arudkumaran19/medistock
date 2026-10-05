/**
 * Demand & Shortage data hooks.
 * Sathurstiga S. (IT24103156).
 *
 * Server state goes through TanStack Query; component state stays local.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createForecast,
  createShortage,
  deleteConsumption,
  deleteForecast,
  deleteShortage,
  getConsumption,
  getCurrentStock,
  getForecasts,
  getShortageById,
  getShortages,
  recalculateShortage,
  resolveShortage,
  scanShortages,
  updateConsumption,
  updateShortage,
} from '@/services/demandApi';
import type {
  ConsumptionQuery,
  ConsumptionRequest,
  ForecastQuery,
  ShortageQuery,
  ShortageUpdateRequest,
} from '@/types/demand';

/** Facility used by the seeded demonstration dataset. */
export const DEMO_FACILITY_ID = 'b1000000-0000-0000-0000-000000000002';

export const demandKeys = {
  all: ['demand'] as const,
  consumption: (query: ConsumptionQuery) => ['demand', 'consumption', query] as const,
  forecasts: (query: ForecastQuery) => ['demand', 'forecasts', query] as const,
  shortages: (query: ShortageQuery) => ['demand', 'shortages', query] as const,
  shortage: (id: string) => ['demand', 'shortage', id] as const,
  currentStock: (facilityId: string, medicineId: string) =>
    ['demand', 'current-stock', facilityId, medicineId] as const,
};

/**
 * Inventory stock for a facility and medicine. Only runs once both are chosen.
 * Data is null when Inventory holds no balance.
 */
export function useCurrentStock(facilityId: string, medicineId: string, enabled = true) {
  return useQuery({
    queryKey: demandKeys.currentStock(facilityId, medicineId),
    queryFn: () => getCurrentStock(facilityId, medicineId),
    enabled: enabled && Boolean(facilityId) && Boolean(medicineId),
  });
}

export function useConsumption(query: ConsumptionQuery) {
  return useQuery({
    queryKey: demandKeys.consumption(query),
    queryFn: () => getConsumption(query),
    placeholderData: (previous) => previous,
  });
}

export function useForecasts(query: ForecastQuery) {
  return useQuery({
    queryKey: demandKeys.forecasts(query),
    queryFn: () => getForecasts(query),
    placeholderData: (previous) => previous,
  });
}

export function useShortages(query: ShortageQuery) {
  return useQuery({
    queryKey: demandKeys.shortages(query),
    queryFn: () => getShortages(query),
    // Keep the previous page on screen while the next one loads. Without this the
    // list blanks out on every keystroke of a search, which makes filtering feel
    // broken and unmounts the controls mid-interaction.
    placeholderData: (previous) => previous,
  });
}

export function useShortage(id: string | undefined) {
  return useQuery({
    queryKey: demandKeys.shortage(id ?? ''),
    queryFn: () => getShortageById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateForecast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createForecast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: demandKeys.all });
    },
  });
}

export function useRecalculateShortage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recalculateShortage,
    onSuccess: () => {
      // A recalculation writes a new alert and a new forecast, so both lists are stale.
      queryClient.invalidateQueries({ queryKey: demandKeys.all });
    },
  });
}

/**
 * Every mutation below invalidates the whole demand key space rather than a single
 * list. Correcting one consumption record changes the averages later forecasts read,
 * and updating an alert changes the dashboard counts, so a narrower invalidation would
 * leave stale figures on screen.
 */
function useDemandMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: demandKeys.all }),
  });
}

export function useCreateShortage() {
  return useDemandMutation(createShortage);
}

export function useUpdateShortage() {
  return useDemandMutation(({ id, request }: { id: string; request: ShortageUpdateRequest }) =>
    updateShortage(id, request),
  );
}

export function useResolveShortage() {
  return useDemandMutation((id: string) => resolveShortage(id));
}

export function useDeleteShortage() {
  return useDemandMutation((id: string) => deleteShortage(id));
}

export function useScanShortages() {
  return useDemandMutation(() => scanShortages());
}

export function useUpdateConsumption() {
  return useDemandMutation(({ id, request }: { id: string; request: ConsumptionRequest }) =>
    updateConsumption(id, request),
  );
}

export function useDeleteConsumption() {
  return useDemandMutation((id: string) => deleteConsumption(id));
}

export function useDeleteForecast() {
  return useDemandMutation((id: string) => deleteForecast(id));
}
