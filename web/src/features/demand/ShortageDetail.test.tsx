/**
 * Shortage detail tests.
 * Sathurstiga S. (IT24103156).
 *
 * The detail view must show the derivation, not just the conclusion, and must read
 * the alert id from the route.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { ShortageDetail } from './ShortageDetail';
import { renderAtRoute, renderWithProviders, shortageAlert } from './testUtils';

vi.mock('@/services/demandApi', () => ({
  getShortages: vi.fn(),
  getForecasts: vi.fn(),
  getConsumption: vi.fn(),
  getShortageById: vi.fn(),
  createForecast: vi.fn(),
  recalculateShortage: vi.fn(),
}));

const { getShortageById } = await import('@/services/demandApi');
const mockGetShortageById = vi.mocked(getShortageById);

describe('ShortageDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the alert id from the route', async () => {
    mockGetShortageById.mockResolvedValue(shortageAlert());

    renderAtRoute('/demand/shortages/:id', <ShortageDetail />, '/demand/shortages/alert-42');

    expect(await screen.findByRole('heading', { name: 'Shortage alert' })).toBeInTheDocument();
    expect(mockGetShortageById).toHaveBeenCalledWith('alert-42');
  });

  it('explains why the alert was raised', async () => {
    mockGetShortageById.mockResolvedValue(shortageAlert());

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(await screen.findByTestId('risk-explanation')).toHaveTextContent(
      '6 days of cover is less than the 10 day lead time',
    );
  });

  it('explains why no alert was raised when cover is sufficient', async () => {
    mockGetShortageById.mockResolvedValue(
      shortageAlert({
        currentStock: 400,
        daysRemaining: 20,
        riskLevel: 'MEDIUM',
        requiresTransfer: false,
      }),
    );

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(await screen.findByTestId('risk-explanation')).toHaveTextContent(
      '20 days of cover meets the 10 day lead time',
    );
  });

  it('shows every input the calculation used', async () => {
    mockGetShortageById.mockResolvedValue(shortageAlert());

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    // Scoped to the risk summary: the figures deliberately appear twice, once in the
    // reasoning equation above and once in this list.
    const summary = await screen.findByTestId('risk-summary');

    expect(within(summary).getByText('120')).toBeInTheDocument();
    expect(within(summary).getByText('20 per day')).toBeInTheDocument();
    expect(screen.getByTestId('days-remaining')).toHaveTextContent('6 days');
    expect(within(summary).getByText('2026-09-27')).toBeInTheDocument();
  });

  it('links back to the forecast the alert came from', async () => {
    mockGetShortageById.mockResolvedValue(shortageAlert());

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(await screen.findByTestId('forecast-link')).toHaveTextContent('Derived from forecast');
  });

  it('says so when the rate was supplied rather than forecast', async () => {
    mockGetShortageById.mockResolvedValue(shortageAlert({ demandForecastId: null }));

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(await screen.findByTestId('forecast-link')).toHaveTextContent(
      'supplied with the request',
    );
  });

  it('states plainly when no stockout is projected', async () => {
    mockGetShortageById.mockResolvedValue(
      shortageAlert({
        averageDailyConsumption: 0,
        daysRemaining: null,
        projectedStockoutDate: null,
        riskLevel: 'MEDIUM',
        requiresTransfer: false,
      }),
    );

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(await screen.findByTestId('risk-explanation')).toHaveTextContent(
      'No consumption is recorded',
    );
    expect(screen.getByTestId('days-remaining')).toHaveTextContent('No stockout projected');
  });

  it('shows a loading state while fetching', () => {
    mockGetShortageById.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading shortage alert');
  });

  it('shows an error state when the alert cannot be loaded', async () => {
    mockGetShortageById.mockRejectedValue(new Error('Alert not found'));

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Alert not found');
  });

  it('does not call the API when no id is available', () => {
    renderWithProviders(<ShortageDetail />);

    expect(screen.getByRole('alert')).toHaveTextContent('No shortage alert was specified.');
    expect(mockGetShortageById).not.toHaveBeenCalled();
  });
});
