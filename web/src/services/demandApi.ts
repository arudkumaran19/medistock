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
 *
 * Integration note
 * ----------------
 * This vertical originally shipped an axios placeholder at services/apiClient. The
 * shared client on develop is `apiRequest`, a fetch wrapper that already unwraps the
 * `data` envelope and throws an Error carrying `code` and `status`. The shared client
 * is authoritative, so this module was adapted to it.
 */
import { apiRequest } from './apiClient';
import type {
  AgentAnalyzeRequest,
  AgentRunResult,
  ConsumptionQuery,
  ConsumptionRecord,
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

/** Builds `?a=1&b=2`, dropping undefined and empty values. */
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

function body(payload: unknown): RequestInit {
  return { body: JSON.stringify(payload) };
}

// ---------------------------------------------------------------------------
// Consumption
// ---------------------------------------------------------------------------

export async function getConsumption(
  query: ConsumptionQuery,
): Promise<PagedResponse<ConsumptionRecord>> {
  return apiRequest<PagedResponse<ConsumptionRecord>>(`/api/consumption${qs(query)}`);
}

export async function getConsumptionById(id: string): Promise<ConsumptionRecord> {
  return apiRequest<ConsumptionRecord>(`/api/consumption/${id}`);
}

export async function updateConsumption(
  id: string,
  request: Partial<ConsumptionRecord>,
): Promise<ConsumptionRecord> {
  return apiRequest<ConsumptionRecord>(`/api/consumption/${id}`, {
    method: 'PUT',
    ...body(request),
  });
}

export async function deleteConsumption(id: string): Promise<void> {
  await apiRequest<void>(`/api/consumption/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Forecasts
// ---------------------------------------------------------------------------

export async function getForecasts(
  query: ForecastQuery,
): Promise<PagedResponse<DemandForecast>> {
  return apiRequest<PagedResponse<DemandForecast>>(`/api/demand/forecasts${qs(query)}`);
}

export async function createForecast(request: ForecastRequest): Promise<DemandForecast> {
  return apiRequest<DemandForecast>('/api/demand/forecast', {
    method: 'POST',
    ...body(request),
  });
}

export async function deleteForecast(id: string): Promise<void> {
  await apiRequest<void>(`/api/demand/forecasts/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Shortages
// ---------------------------------------------------------------------------

export async function getShortages(
  query: ShortageQuery,
): Promise<PagedResponse<ShortageAlert>> {
  return apiRequest<PagedResponse<ShortageAlert>>(`/api/shortages${qs(query)}`);
}

export async function getShortageById(id: string): Promise<ShortageAlert> {
  return apiRequest<ShortageAlert>(`/api/shortages/${id}`);
}

export async function recalculateShortage(
  request: ShortageRecalculateRequest,
): Promise<ShortageAlert> {
  return apiRequest<ShortageAlert>('/api/shortages/recalculate', {
    method: 'POST',
    ...body(request),
  });
}

export async function createShortage(
  request: ShortageCreateRequest,
): Promise<ShortageAlert> {
  return apiRequest<ShortageAlert>('/api/shortages', {
    method: 'POST',
    ...body(request),
  });
}

export async function updateShortage(
  id: string,
  request: ShortageUpdateRequest,
): Promise<ShortageAlert> {
  return apiRequest<ShortageAlert>(`/api/shortages/${id}`, {
    method: 'PUT',
    ...body(request),
  });
}

export async function resolveShortage(id: string): Promise<ShortageAlert> {
  return apiRequest<ShortageAlert>(`/api/shortages/${id}/resolve`, { method: 'POST' });
}

export async function deleteShortage(id: string): Promise<void> {
  await apiRequest<void>(`/api/shortages/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Agentic AI
//
// Not in the frozen contract (blueprint section 36). React calls ASP.NET, which
// calls the agent service - the client never reaches the agent directly
// (blueprint section 37).
// ---------------------------------------------------------------------------

export async function runAgentAnalysis(
  request: AgentAnalyzeRequest,
): Promise<AgentRunResult> {
  return apiRequest<AgentRunResult>('/api/demand/agent/analyze', {
    method: 'POST',
    ...body(request),
  });
}

export async function getAgentHealth(): Promise<boolean> {
  const result = await apiRequest<{ healthy: boolean }>('/api/demand/agent/health');
  return result.healthy;
}
