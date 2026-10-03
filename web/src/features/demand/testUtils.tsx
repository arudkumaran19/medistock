/**
 * Test helpers for the Demand & Shortage React feature.
 * Sathurstiga S. (IT24103156).
 */
import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import type { ConsumptionRecord, DemandForecast, PagedResponse, ShortageAlert } from '@/types/demand';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Retries would make a failure test wait for backoff before asserting.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

export function renderAtRoute(path: string, element: ReactElement, entry: string) {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function page<T>(items: T[], overrides: Partial<PagedResponse<T>> = {}): PagedResponse<T> {
  const pageSize = overrides.pageSize ?? 10;

  // develop's envelope is {items, total, page, pageSize} - no derived paging flags.
  return {
    items,
    page: overrides.page ?? 1,
    pageSize,
    total: overrides.total ?? items.length,
  };
}

/** The blueprint's worked example: 120 units, 20/day, lead time 10 => 6 days, HIGH. */
export function shortageAlert(overrides: Partial<ShortageAlert> = {}): ShortageAlert {
  return {
    id: 'a1000000-0000-0000-0000-000000000001',
    facilityId: 'b1000000-0000-0000-0000-000000000002',
    medicineId: 'c1000000-0000-0000-0000-000000000001',
    demandForecastId: 'f1000000-0000-0000-0000-000000000001',
    currentStock: 120,
    averageDailyConsumption: 20,
    daysRemaining: 6,
    projectedStockoutDate: '2026-09-27T00:00:00Z',
    leadTimeDays: 10,
    riskLevel: 'HIGH',
    requiresTransfer: true,
    generatedAt: '2026-09-21T08:00:00Z',
    status: 'OPEN',
    ...overrides,
  };
}

export function demandForecast(overrides: Partial<DemandForecast> = {}): DemandForecast {
  return {
    id: 'f1000000-0000-0000-0000-000000000001',
    facilityId: 'b1000000-0000-0000-0000-000000000002',
    medicineId: 'c1000000-0000-0000-0000-000000000001',
    forecastDate: '2026-10-21T00:00:00Z',
    predictedDemand: 600,
    averageDailyConsumption: 20,
    method: 'MOVING_AVERAGE',
    windowDays: 30,
    horizonDays: 30,
    confidenceScore: 1,
    leadTimeDays: 10,
    generatedAt: '2026-09-21T08:00:00Z',
    status: 'ACTIVE',
    ...overrides,
  };
}

export function consumptionRecord(overrides: Partial<ConsumptionRecord> = {}): ConsumptionRecord {
  return {
    id: 'r1000000-0000-0000-0000-000000000001',
    facilityId: 'b1000000-0000-0000-0000-000000000002',
    medicineId: 'c1000000-0000-0000-0000-000000000001',
    quantityUsed: 20,
    consumptionDate: '2026-09-20T00:00:00Z',
    source: 'FLUTTER_CONSUMPTION_ENTRY',
    notes: null,
    createdAt: '2026-09-20T09:00:00Z',
    ...overrides,
  };
}
