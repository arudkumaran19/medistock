/**
 * Shortage detail tests.
 * Sathurstiga S. (IT24103156).
 *
 * The detail view must show the derivation, not just the conclusion, and must read
 * the alert id from the route.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ShortageDetail } from './ShortageDetail';
import { EXISTING_ALERT_UPDATED_NOTICE } from './format';
import {
  createTestQueryClient,
  renderAtRoute,
  renderWithProviders,
  shortageAlert,
} from './testUtils';

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

  it('says why an alert resolved itself', async () => {
    mockGetShortageById.mockResolvedValue(
      shortageAlert({
        status: 'RESOLVED',
        riskLevel: 'MEDIUM',
        requiresTransfer: false,
        daysRemaining: 20,
        resolvedAt: '2026-10-05T10:00:00Z',
        resolutionReason: 'Stock now covers lead time',
      }),
    );

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    expect(await screen.findByTestId('resolution-reason')).toHaveTextContent(
      'Resolved automatically: Stock now covers lead time (2026-10-05).',
    );
  });

  it('shows the existing-alert notice passed by the raise form', async () => {
    mockGetShortageById.mockResolvedValue(shortageAlert());

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter
          initialEntries={[
            { pathname: '/demand/shortages/alert-42', state: { notice: EXISTING_ALERT_UPDATED_NOTICE } },
          ]}
        >
          <Routes>
            <Route path="/demand/shortages/:id" element={<ShortageDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('alert-notice')).toHaveTextContent('Existing alert updated');
  });

  it('does not show a notice when the alert was simply opened', async () => {
    mockGetShortageById.mockResolvedValue(shortageAlert());

    renderWithProviders(<ShortageDetail shortageId="alert-42" />);

    await screen.findByTestId('risk-explanation');
    expect(screen.queryByTestId('alert-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resolution-reason')).not.toBeInTheDocument();
  });

  it('does not call the API when no id is available', () => {
    renderWithProviders(<ShortageDetail />);

    expect(screen.getByRole('alert')).toHaveTextContent('No shortage alert was specified.');
    expect(mockGetShortageById).not.toHaveBeenCalled();
  });
});
