/**
 * Demand API client tests.
 * Sathurstiga S. (IT24103156).
 *
 * Checks that the client speaks the frozen contract: the right paths, only real
 * filters on the query string, and the payload returned as-is.
 *
 * develop's shared client is `apiRequest`, a fetch wrapper that already unwraps the
 * `data` envelope, so these tests assert the request it is asked to make and return
 * the unwrapped payload directly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@/services/apiClient';
import {
  createForecast,
  getConsumption,
  getForecasts,
  getShortageById,
  getShortages,
  recalculateShortage,
} from '@/services/demandApi';
import { consumptionRecord, demandForecast, page, shortageAlert } from './testUtils';

const request = vi.mocked(apiRequest);

describe('demandApi', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('gets consumption from the contract path and returns the payload', async () => {
    const payload = page([consumptionRecord()]);
    request.mockResolvedValue(payload);

    const result = await getConsumption({ facilityId: 'facility-1' });

    expect(request).toHaveBeenCalledWith('/api/consumption?facilityId=facility-1');
    expect(result).toEqual(payload);
  });

  it('omits undefined and empty filters from the query string', async () => {
    request.mockResolvedValue(page([]));

    await getShortages({
      facilityId: 'facility-1',
      medicineId: undefined,
      search: '',
      riskLevel: 'HIGH',
      page: 2,
    });

    const path = request.mock.calls[0][0] as string;
    expect(path).toContain('facilityId=facility-1');
    expect(path).toContain('riskLevel=HIGH');
    expect(path).toContain('page=2');
    expect(path).not.toContain('medicineId');
    expect(path).not.toContain('search');
  });

  it('keeps a false filter value rather than dropping it', async () => {
    request.mockResolvedValue(page([]));

    await getShortages({ requiresTransfer: false });

    expect(request.mock.calls[0][0]).toContain('requiresTransfer=false');
  });

  it('gets forecasts from the contract path', async () => {
    request.mockResolvedValue(page([demandForecast()]));

    await getForecasts({ facilityId: 'facility-1' });

    expect(request.mock.calls[0][0]).toContain('/api/demand/forecasts');
  });

  it('posts a forecast request to the contract path', async () => {
    request.mockResolvedValue(demandForecast());

    await createForecast({
      facilityId: 'facility-1',
      medicineId: 'medicine-1',
      method: 'MOVING_AVERAGE',
    });

    expect(request).toHaveBeenCalledWith('/api/demand/forecast', {
      method: 'POST',
      body: JSON.stringify({
        facilityId: 'facility-1',
        medicineId: 'medicine-1',
        method: 'MOVING_AVERAGE',
      }),
    });
  });

  it('gets a single shortage alert by id', async () => {
    request.mockResolvedValue(shortageAlert());

    await getShortageById('alert-42');

    expect(request).toHaveBeenCalledWith('/api/shortages/alert-42');
  });

  it('posts a recalculation to the contract path', async () => {
    request.mockResolvedValue(shortageAlert());

    const result = await recalculateShortage({
      facilityId: 'facility-1',
      medicineId: 'medicine-1',
      currentStock: 120,
    });

    expect(request).toHaveBeenCalledWith('/api/shortages/recalculate', {
      method: 'POST',
      body: JSON.stringify({
        facilityId: 'facility-1',
        medicineId: 'medicine-1',
        currentStock: 120,
      }),
    });
    expect(result.daysRemaining).toBe(6);
  });
});
