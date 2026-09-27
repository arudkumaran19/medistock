/**
 * Demand & Shortage API client.
 * Sathurstiga S. (IT24103156).
 *
 * Follows the frozen Demand contract:
 *
 *   GET    /api/consumption
 *   POST   /api/consumption
 *   GET    /api/demand/forecasts
 *   POST   /api/demand/forecast
 *   GET    /api/shortages
 *   GET    /api/shortages/{id}
 *   POST   /api/shortages/recalculate
 */
import { apiClient } from './apiClient';
import type {
  ApiResponse,
  ConsumptionQuery,
  ConsumptionRecord,
  ConsumptionRequest,
  DemandForecast,
  ForecastQuery,
  ForecastRequest,
  PagedResponse,
  ShortageAlert,
  ShortageCreateRequest,
  ShortageQuery,
  ShortageRecalculateRequest,
  ShortageUpdateRequest,
} from '@/types/demand';

/**
 * Drops undefined and empty values so the query string carries only real filters.
 *
 * Generic rather than Record<string, unknown>: an interface has no implicit index
 * signature, so the query types would not be assignable to it.
 */
function toParams<T extends object>(query: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export async function getConsumption(
  query: ConsumptionQuery,
): Promise<PagedResponse<ConsumptionRecord>> {
  const response = await apiClient.get<ApiResponse<PagedResponse<ConsumptionRecord>>>(
    '/api/consumption',
    { params: toParams(query) },
  );

  return response.data.data;
}

export async function getForecasts(query: ForecastQuery): Promise<PagedResponse<DemandForecast>> {
  const response = await apiClient.get<ApiResponse<PagedResponse<DemandForecast>>>(
    '/api/demand/forecasts',
    { params: toParams(query) },
  );

  return response.data.data;
}

export async function createForecast(request: ForecastRequest): Promise<DemandForecast> {
  const response = await apiClient.post<ApiResponse<DemandForecast>>(
    '/api/demand/forecast',
    request,
  );

  return response.data.data;
}

export async function getShortages(query: ShortageQuery): Promise<PagedResponse<ShortageAlert>> {
  const response = await apiClient.get<ApiResponse<PagedResponse<ShortageAlert>>>('/api/shortages', {
    params: toParams(query),
  });

  return response.data.data;
}

export async function getShortageById(id: string): Promise<ShortageAlert> {
  const response = await apiClient.get<ApiResponse<ShortageAlert>>(`/api/shortages/${id}`);

  return response.data.data;
}

export async function recalculateShortage(
  request: ShortageRecalculateRequest,
): Promise<ShortageAlert> {
  const response = await apiClient.post<ApiResponse<ShortageAlert>>(
    '/api/shortages/recalculate',
    request,
  );

  return response.data.data;
}

// ---------------------------------------------------------------------------
// Shortage management
//
// These paths are not in the frozen API contract (blueprint section 36). They back the
// shortage management screen and follow the same conventions as the frozen endpoints.
// ---------------------------------------------------------------------------

export async function createShortage(request: ShortageCreateRequest): Promise<ShortageAlert> {
  const response = await apiClient.post<ApiResponse<ShortageAlert>>('/api/shortages', request);

  return response.data.data;
}

export async function updateShortage(
  id: string,
  request: ShortageUpdateRequest,
): Promise<ShortageAlert> {
  const response = await apiClient.put<ApiResponse<ShortageAlert>>(`/api/shortages/${id}`, request);

  return response.data.data;
}

export async function resolveShortage(id: string): Promise<ShortageAlert> {
  const response = await apiClient.post<ApiResponse<ShortageAlert>>(`/api/shortages/${id}/resolve`);

  return response.data.data;
}

export async function deleteShortage(id: string): Promise<void> {
  await apiClient.delete(`/api/shortages/${id}`);
}

// ---------------------------------------------------------------------------
// Consumption and forecast management
// ---------------------------------------------------------------------------

export async function getConsumptionById(id: string): Promise<ConsumptionRecord> {
  const response = await apiClient.get<ApiResponse<ConsumptionRecord>>(`/api/consumption/${id}`);

  return response.data.data;
}

export async function updateConsumption(
  id: string,
  request: ConsumptionRequest,
): Promise<ConsumptionRecord> {
  const response = await apiClient.put<ApiResponse<ConsumptionRecord>>(
    `/api/consumption/${id}`,
    request,
  );

  return response.data.data;
}

export async function deleteConsumption(id: string): Promise<void> {
  await apiClient.delete(`/api/consumption/${id}`);
}

export async function deleteForecast(id: string): Promise<void> {
  await apiClient.delete(`/api/demand/forecasts/${id}`);
}
