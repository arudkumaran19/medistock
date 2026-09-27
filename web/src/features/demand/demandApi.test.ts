/**
 * Demand API client tests.
 * Sathurstiga S. (IT24103156).
 *
 * Checks that the client speaks the frozen contract: the right paths, the envelope
 * unwrapped, and only real filters placed on the query string.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/apiClient';
import {
  createForecast,
  getConsumption,
  getForecasts,
  getShortageById,
  getShortages,
  recalculateShortage,
} from '@/services/demandApi';
import { consumptionRecord, demandForecast, page, shortageAlert } from './testUtils';

describe('demandApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('gets consumption from the contract path and unwraps the envelope', async () => {
    const payload = page([consumptionRecord()]);
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: payload } });

    const result = await getConsumption({ facilityId: 'facility-1' });

    expect(get).toHaveBeenCalledWith('/api/consumption', {
      params: { facilityId: 'facility-1' },
    });
    expect(result).toEqual(payload);
  });

  it('omits undefined and empty filters from the query string', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: page([]) },
    });

    await getShortages({
      facilityId: 'facility-1',
      medicineId: undefined,
      search: '',
      riskLevel: 'HIGH',
      page: 2,
    });

    expect(get).toHaveBeenCalledWith('/api/shortages', {
      params: { facilityId: 'facility-1', riskLevel: 'HIGH', page: 2 },
    });
  });

  it('keeps a false filter value rather than dropping it', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: page([]) },
    });

    await getShortages({ requiresTransfer: false });

    expect(get).toHaveBeenCalledWith('/api/shortages', {
      params: { requiresTransfer: false },
    });
  });

  it('gets forecasts from the contract path', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: page([demandForecast()]) },
    });

    await getForecasts({ facilityId: 'facility-1' });

    expect(get).toHaveBeenCalledWith('/api/demand/forecasts', expect.anything());
  });

  it('posts a forecast request to the contract path', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { success: true, data: demandForecast() },
    });

    await createForecast({
      facilityId: 'facility-1',
      medicineId: 'medicine-1',
      method: 'MOVING_AVERAGE',
    });

    expect(post).toHaveBeenCalledWith('/api/demand/forecast', {
      facilityId: 'facility-1',
      medicineId: 'medicine-1',
      method: 'MOVING_AVERAGE',
    });
  });

  it('gets a single shortage alert by id', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: shortageAlert() },
    });

    await getShortageById('alert-42');

    expect(get).toHaveBeenCalledWith('/api/shortages/alert-42');
  });

  it('posts a recalculation to the contract path', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { success: true, data: shortageAlert() },
    });

    const result = await recalculateShortage({
      facilityId: 'facility-1',
      medicineId: 'medicine-1',
      currentStock: 120,
    });

    expect(post).toHaveBeenCalledWith('/api/shortages/recalculate', {
      facilityId: 'facility-1',
      medicineId: 'medicine-1',
      currentStock: 120,
    });
    expect(result.daysRemaining).toBe(6);
  });
});
