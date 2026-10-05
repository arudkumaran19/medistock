/**
 * Forecast page tests.
 * Sathurstiga S. (IT24103156).
 *
 * Covers form validation, the generate operation, method filtering and the
 * loading, empty and error states.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForecastPage } from './ForecastPage';
import { demandForecast, page, renderWithProviders } from './testUtils';

/**
 * Waits for the forecast history table to render and returns it.
 *
 * Queries are scoped to the table because the method names also appear as options in
 * the two select elements, so an unscoped text query matches three nodes.
 */
async function findForecastTable(): Promise<HTMLElement> {
  return screen.findByRole('table');
}

vi.mock('@/services/demandApi', () => ({
  getShortages: vi.fn(),
  getForecasts: vi.fn(),
  getConsumption: vi.fn(),
  getShortageById: vi.fn(),
  createForecast: vi.fn(),
  recalculateShortage: vi.fn(),
}));

const { createForecast, getForecasts } = await import('@/services/demandApi');
const mockGetForecasts = vi.mocked(getForecasts);
const mockCreateForecast = vi.mocked(createForecast);

describe('ForecastPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetForecasts.mockResolvedValue(page([demandForecast()]));
  });

  it('lists the stored forecasts', async () => {
    renderWithProviders(<ForecastPage />);

    const table = await findForecastTable();

    expect(within(table).getByText('MOVING AVERAGE')).toBeInTheDocument();
    expect(within(table).getByText('600')).toBeInTheDocument();
    expect(within(table).getByText('100%')).toBeInTheDocument();
  });

  it('offers only the sanctioned forecasting methods', async () => {
    renderWithProviders(<ForecastPage />);

    const select = await screen.findByLabelText('Forecast method');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);

    expect(options).toEqual(['MOVING_AVERAGE', 'WEIGHTED_MOVING_AVERAGE', 'SIMPLE_TREND']);
  });

  it('generates a forecast with the chosen parameters', async () => {
    const user = userEvent.setup();
    mockCreateForecast.mockResolvedValue(demandForecast());

    renderWithProviders(<ForecastPage />);
    await findForecastTable();

    await user.selectOptions(screen.getByLabelText('Forecast method'), 'SIMPLE_TREND');
    await user.click(screen.getByRole('button', { name: 'Generate forecast' }));

    // TanStack Query calls mutationFn with a second context argument, so the request
    // itself is asserted rather than the whole argument list.
    await waitFor(() => {
      expect(mockCreateForecast).toHaveBeenCalled();
    });

    expect(mockCreateForecast.mock.calls[0][0]).toEqual(
      expect.objectContaining({ method: 'SIMPLE_TREND', windowDays: 30, horizonDays: 30 }),
    );
  });

  it('reports the generated figures back to the manager', async () => {
    const user = userEvent.setup();
    mockCreateForecast.mockResolvedValue(demandForecast());

    renderWithProviders(<ForecastPage />);
    await findForecastTable();

    await user.click(screen.getByRole('button', { name: 'Generate forecast' }));

    expect(await screen.findByTestId('forecast-result')).toHaveTextContent(
      '20 units per day',
    );
  });

  it('rejects an out-of-range window before calling the API', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ForecastPage />);
    await findForecastTable();

    const windowInput = screen.getByLabelText('History window in days');
    await user.clear(windowInput);
    await user.type(windowInput, '400');
    await user.click(screen.getByRole('button', { name: 'Generate forecast' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Window must be between 1 and 365 days.',
    );
    expect(mockCreateForecast).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range horizon before calling the API', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ForecastPage />);
    await findForecastTable();

    const horizonInput = screen.getByLabelText('Horizon in days');
    await user.clear(horizonInput);
    await user.type(horizonInput, '0');
    await user.click(screen.getByRole('button', { name: 'Generate forecast' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Horizon must be between 1 and 365 days.',
    );
    expect(mockCreateForecast).not.toHaveBeenCalled();
  });

  it('surfaces a rejection from the backend', async () => {
    const user = userEvent.setup();
    mockCreateForecast.mockRejectedValue(new Error('Forecast rejected'));

    renderWithProviders(<ForecastPage />);
    await findForecastTable();

    await user.click(screen.getByRole('button', { name: 'Generate forecast' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Forecast rejected');
  });

  it('passes the method filter to the API', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ForecastPage />);
    await findForecastTable();

    await user.selectOptions(
      screen.getByLabelText('Filter forecasts by method'),
      'WEIGHTED_MOVING_AVERAGE',
    );

    await waitFor(() => {
      expect(mockGetForecasts).toHaveBeenLastCalledWith(
        expect.objectContaining({ method: 'WEIGHTED_MOVING_AVERAGE' }),
      );
    });
  });

  it('shows an empty state when nothing has been forecast', async () => {
    mockGetForecasts.mockResolvedValue(page([]));

    renderWithProviders(<ForecastPage />);

    expect(await screen.findByText('No forecasts generated yet.')).toBeInTheDocument();
  });

  it('shows an error state when the list cannot be loaded', async () => {
    mockGetForecasts.mockRejectedValue(new Error('Forecast service down'));

    renderWithProviders(<ForecastPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Forecast service down');
  });
});

