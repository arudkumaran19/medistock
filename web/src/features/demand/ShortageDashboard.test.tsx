/**
 * Shortage dashboard tests.
 * Sathurstiga S. (IT24103156).
 *
 * Covers rendering, filtering, search, pagination, and the loading, empty and error
 * states required of every React feature.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShortageDashboard } from './ShortageDashboard';
import { page, renderWithProviders, shortageAlert } from './testUtils';

vi.mock('@/services/demandApi', () => ({
  getShortages: vi.fn(),
  getForecasts: vi.fn(),
  getConsumption: vi.fn(),
  getShortageById: vi.fn(),
  createForecast: vi.fn(),
  recalculateShortage: vi.fn(),
}));

const { getShortages } = await import('@/services/demandApi');
const mockGetShortages = vi.mocked(getShortages);

describe('ShortageDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state while alerts are being fetched', () => {
    mockGetShortages.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<ShortageDashboard />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading shortage alerts');
  });

  it('renders the derived figures for each alert', async () => {
    mockGetShortages.mockResolvedValue(page([shortageAlert()]));

    renderWithProviders(<ShortageDashboard />);

    expect(await screen.findByText('HIGH')).toBeInTheDocument();
    // 120 units at 20/day is 6 days of cover against a 10 day lead time.
    expect(screen.getByText('6 days')).toBeInTheDocument();
    expect(screen.getByText('10 days')).toBeInTheDocument();
  });

  it('reports no projected stockout rather than zero days when nothing is consumed', async () => {
    mockGetShortages.mockResolvedValue(
      page([
        shortageAlert({
          daysRemaining: null,
          projectedStockoutDate: null,
          averageDailyConsumption: 0,
          riskLevel: 'MEDIUM',
          requiresTransfer: false,
        }),
      ]),
    );

    renderWithProviders(<ShortageDashboard />);

    expect(await screen.findByText('No stockout projected')).toBeInTheDocument();
  });

  it('summarises how many alerts require a transfer', async () => {
    mockGetShortages.mockResolvedValue(
      page([
        shortageAlert({ id: 'a1', requiresTransfer: true }),
        shortageAlert({ id: 'a2', requiresTransfer: false, riskLevel: 'MEDIUM' }),
      ]),
    );

    renderWithProviders(<ShortageDashboard />);

    expect(await screen.findByTestId('high-risk-summary')).toHaveTextContent(
      '1 of 2 alerts on this page require a transfer',
    );
  });

  it('passes the selected risk level to the API as a filter', async () => {
    const user = userEvent.setup();
    mockGetShortages.mockResolvedValue(page([shortageAlert()]));

    renderWithProviders(<ShortageDashboard />);
    await screen.findByText('HIGH');

    await user.selectOptions(screen.getByLabelText('Filter by risk level'), 'HIGH');

    await waitFor(() => {
      expect(mockGetShortages).toHaveBeenLastCalledWith(
        expect.objectContaining({ riskLevel: 'HIGH' }),
      );
    });
  });

  it('passes the search term to the API', async () => {
    const user = userEvent.setup();
    mockGetShortages.mockResolvedValue(page([shortageAlert()]));

    renderWithProviders(<ShortageDashboard />);
    await screen.findByText('HIGH');

    await user.type(screen.getByLabelText('Search shortage alerts'), 'high');

    await waitFor(() => {
      expect(mockGetShortages).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'high' }),
      );
    });
  });

  it('passes the chosen sort field to the API', async () => {
    const user = userEvent.setup();
    mockGetShortages.mockResolvedValue(page([shortageAlert()]));

    renderWithProviders(<ShortageDashboard />);
    await screen.findByText('HIGH');

    await user.selectOptions(screen.getByLabelText('Sort shortage alerts'), 'daysRemaining');

    await waitFor(() => {
      expect(mockGetShortages).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'daysRemaining' }),
      );
    });
  });

  it('requests the next page when pagination advances', async () => {
    const user = userEvent.setup();
    mockGetShortages.mockResolvedValue(
      page([shortageAlert()], { total: 25 }),
    );

    renderWithProviders(<ShortageDashboard />);
    await screen.findByText('HIGH');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(mockGetShortages).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it('disables the previous control on the first page', async () => {
    mockGetShortages.mockResolvedValue(
      page([shortageAlert()], { total: 25 }),
    );

    renderWithProviders(<ShortageDashboard />);
    await screen.findByText('HIGH');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('shows an empty state when no alerts match', async () => {
    mockGetShortages.mockResolvedValue(page([]));

    renderWithProviders(<ShortageDashboard />);

    expect(await screen.findByText('No shortage risks detected')).toBeInTheDocument();
  });

  it('shows the API error message when the request fails', async () => {
    mockGetShortages.mockRejectedValue(new Error('Service unavailable'));

    renderWithProviders(<ShortageDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  });

  it('refetches when the error state is retried', async () => {
    const user = userEvent.setup();
    mockGetShortages.mockRejectedValueOnce(new Error('Service unavailable'));
    mockGetShortages.mockResolvedValue(page([shortageAlert()]));

    renderWithProviders(<ShortageDashboard />);
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('HIGH')).toBeInTheDocument();
  });

  it('links each alert to its detail view', async () => {
    mockGetShortages.mockResolvedValue(page([shortageAlert({ id: 'alert-42' })]));

    renderWithProviders(<ShortageDashboard />);

    expect(await screen.findByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/demand/shortages/alert-42',
    );
  });
});
