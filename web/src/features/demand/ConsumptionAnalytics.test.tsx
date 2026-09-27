/**
 * Consumption analytics tests.
 * Sathurstiga S. (IT24103156).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsumptionAnalytics } from './ConsumptionAnalytics';
import { consumptionRecord, page, renderWithProviders } from './testUtils';

vi.mock('@/services/demandApi', () => ({
  getShortages: vi.fn(),
  getForecasts: vi.fn(),
  getConsumption: vi.fn(),
  getShortageById: vi.fn(),
  createForecast: vi.fn(),
  recalculateShortage: vi.fn(),
}));

const { getConsumption } = await import('@/services/demandApi');
const mockGetConsumption = vi.mocked(getConsumption);

describe('ConsumptionAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the recorded consumption', async () => {
    mockGetConsumption.mockResolvedValue(page([consumptionRecord()]));

    renderWithProviders(<ConsumptionAnalytics />);

    expect(await screen.findByText('FLUTTER_CONSUMPTION_ENTRY')).toBeInTheDocument();
    expect(screen.getByText('2026-09-20')).toBeInTheDocument();
  });

  it('summarises the page totals', async () => {
    mockGetConsumption.mockResolvedValue(
      page([
        consumptionRecord({ id: 'r1', quantityUsed: 20 }),
        consumptionRecord({ id: 'r2', quantityUsed: 10 }),
      ]),
    );

    renderWithProviders(<ConsumptionAnalytics />);

    const summary = await screen.findByTestId('consumption-summary');

    expect(summary).toHaveTextContent('30');
    expect(summary).toHaveTextContent('15');
  });

  it('passes the search term to the API', async () => {
    const user = userEvent.setup();
    mockGetConsumption.mockResolvedValue(page([consumptionRecord()]));

    renderWithProviders(<ConsumptionAnalytics />);
    await screen.findByText('FLUTTER_CONSUMPTION_ENTRY');

    await user.type(screen.getByLabelText('Search consumption records'), 'ward');

    await waitFor(() => {
      expect(mockGetConsumption).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'ward' }),
      );
    });
  });

  it('passes the sort field and order to the API', async () => {
    const user = userEvent.setup();
    mockGetConsumption.mockResolvedValue(page([consumptionRecord()]));

    renderWithProviders(<ConsumptionAnalytics />);
    await screen.findByText('FLUTTER_CONSUMPTION_ENTRY');

    await user.selectOptions(screen.getByLabelText('Sort consumption records'), 'quantityUsed');
    await user.selectOptions(screen.getByLabelText('Sort order'), 'asc');

    await waitFor(() => {
      expect(mockGetConsumption).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'quantityUsed', sortOrder: 'asc' }),
      );
    });
  });

  it('requests the next page when pagination advances', async () => {
    const user = userEvent.setup();
    mockGetConsumption.mockResolvedValue(
      page([consumptionRecord()], { totalCount: 30, totalPages: 3, hasNextPage: true }),
    );

    renderWithProviders(<ConsumptionAnalytics />);
    await screen.findByText('FLUTTER_CONSUMPTION_ENTRY');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(mockGetConsumption).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it('shows an empty state when nothing has been recorded', async () => {
    mockGetConsumption.mockResolvedValue(page([]));

    renderWithProviders(<ConsumptionAnalytics />);

    expect(await screen.findByText('No consumption data available')).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    mockGetConsumption.mockRejectedValue(new Error('Consumption service down'));

    renderWithProviders(<ConsumptionAnalytics />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Consumption service down');
  });
});
