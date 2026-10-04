import { pageCount } from '@/types/demand';
/**
 * Forecast page - generate and review demand forecasts.
 * Sathurstiga S. (IT24103156).
 *
 * Generating a forecast is the non-CRUD business operation of this component. The
 * calculation itself is deterministic backend code; this page requests it and charts
 * the result.
 *
 * Chart note: the chart plots average daily consumption only. Predicted demand is
 * average daily consumption multiplied by the horizon, so plotting both would show the
 * same information twice on one axis at two very different scales - which flattens the
 * rate line into the baseline and reads as a dual-scale chart. The horizon and the
 * predicted total stay in the table, where the exact figures belong.
 */
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagination } from '@/components/Pagination';
import { toErrorMessage } from './errors';
import { FORECAST_METHODS, type DemandForecast, type ForecastMethod } from '@/types/demand';
import { ChartTooltip } from './ChartTooltip';
import { DemandChain } from './DemandChain';
import { useReferenceData } from './referenceApi';
import { ForecastTimeline } from './components/ForecastTimeline';
import { Icon } from './components/Icon';
import { MetricCard } from './components/MetricCard';
import { PageHeader, Panel } from './components/Panel';
import { SkeletonChart, SkeletonRegion, SkeletonTable } from './components/Skeleton';
import { formatDate, formatNumber, formatPercent } from './format';
import { knownFacilities, knownMedicines, medicineName, optionLabel } from './reference';
import { DEMO_FACILITY_ID, useCreateForecast, useDeleteForecast, useForecasts } from './hooks';

const PAGE_SIZE = 10;
const DEMO_MEDICINE_ID = 'c1000000-0000-0000-0000-000000000001';

function methodLabel(method: string): string {
  // Not replaceAll: the tsconfig lib target is ES2020, where it does not exist.
  return method.replace(/_/g, ' ');
}

export function ForecastPage({
  facilityId: initialFacilityId = DEMO_FACILITY_ID,
  medicineId: initialMedicineId = DEMO_MEDICINE_ID,
}: {
  facilityId?: string;
  medicineId?: string;
}) {
  // Medicine and facility names come from the Inventory API. Re-renders when they
  // arrive, which is what lets the dropdowns below list the full catalogue.
  useReferenceData();

  // Starts on the demonstration facility, where the seeded history lives. Unlike the
  // consumption page there is no "all facilities" here: a forecast is always for one
  // facility and one medicine, and the backend rejects a request without them.
  const [facilityId, setFacilityId] = useState(initialFacilityId);
  const [page, setPage] = useState(1);
  const [medicineId, setMedicineId] = useState(initialMedicineId);
  const [methodFilter, setMethodFilter] = useState<ForecastMethod | ''>('');
  const [method, setMethod] = useState<ForecastMethod>('MOVING_AVERAGE');
  const [windowDays, setWindowDays] = useState(30);
  const [horizonDays, setHorizonDays] = useState(30);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DemandForecast | null>(null);

  const deleteForecast = useDeleteForecast();

  const query = useMemo(
    () => ({
      facilityId,
      medicineId,
      page,
      pageSize: PAGE_SIZE,
      method: methodFilter || undefined,
      sortBy: 'generatedAt',
      sortOrder: 'desc' as const,
    }),
    [facilityId, medicineId, page, methodFilter],
  );

  const { data, isLoading, isError, error, refetch } = useForecasts(query);
  const createForecast = useCreateForecast();

  function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Mirrors the backend rule, so an obviously invalid request is caught before the
    // round trip. The backend remains authoritative.
    if (windowDays < 1 || windowDays > 365) {
      setFormError('Window must be between 1 and 365 days.');
      return;
    }

    if (horizonDays < 1 || horizonDays > 365) {
      setFormError('Horizon must be between 1 and 365 days.');
      return;
    }

    createForecast.mutate({ facilityId, medicineId, method, windowDays, horizonDays });
  }

  const columns: Column<DemandForecast>[] = [
    { key: 'generatedAt', header: 'Generated', render: (row) => formatDate(row.generatedAt) },
    {
      key: 'method',
      header: 'Method',
      render: (row) => <span className="badge">{methodLabel(row.method)}</span>,
    },
    {
      key: 'average',
      header: 'Avg/day',
      render: (row) => (
        <span className="cell-emphasis">{formatNumber(row.averageDailyConsumption)}</span>
      ),
    },
    {
      key: 'predicted',
      header: 'Predicted demand',
      render: (row) => formatNumber(row.predictedDemand),
    },
    { key: 'horizon', header: 'Horizon', render: (row) => `${row.horizonDays} days` },
    { key: 'confidence', header: 'Confidence', render: (row) => formatPercent(row.confidenceScore) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <span className="row-actions">
          <button
            type="button"
            className="button--destructive"
            onClick={() => setPendingDelete(row)}
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  const items = data?.items ?? [];
  const latest = items[0];

  // Oldest first, so the chart reads left to right in time order.
  const chartData = items
    .slice()
    .reverse()
    .map((forecast) => ({
      generatedAt: formatDate(forecast.generatedAt),
      averageDailyConsumption: forecast.averageDailyConsumption,
    }));

  return (
    <section aria-labelledby="forecast-heading" className="demand-vertical stack" data-theme="light">
      <PageHeader
        title="Demand Forecast"
        subtitle="Understand future medicine demand and projected stock levels."
      >
        <h2 id="forecast-heading" className="visually-hidden">
          Demand forecast
        </h2>
        <DemandChain active="forecast" />
      </PageHeader>

      <Panel
        title="Generate a forecast"
        description="Deterministic statistics, calculated by the backend and never by the model"
        icon="trend"
      >
        {/*
          noValidate: the min/max attributes below would otherwise trigger native
          constraint validation, which blocks submission before handleGenerate runs and
          replaces our message with a browser tooltip. The explicit checks in
          handleGenerate are authoritative here, and the backend remains authoritative
          overall.
        */}
        <form onSubmit={handleGenerate} aria-label="Generate forecast" noValidate>
          <div className="toolbar">
            <label className="field">
              Facility
              <select
                value={facilityId}
                aria-label="Facility"
                onChange={(event) => {
                  setFacilityId(event.target.value);
                  setPage(1);
                }}
              >
                {knownFacilities().map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {optionLabel(facility)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Medicine
              <select
                value={medicineId}
                aria-label="Medicine"
                onChange={(event) => {
                  setMedicineId(event.target.value);
                  setPage(1);
                }}
              >
                {knownMedicines().map((medicine) => (
                  <option key={medicine.id} value={medicine.id}>
                    {optionLabel(medicine)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Method
              <select
                value={method}
                aria-label="Forecast method"
                onChange={(event) => setMethod(event.target.value as ForecastMethod)}
              >
                {FORECAST_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {methodLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              History window (days)
              <input
                type="number"
                aria-label="History window in days"
                value={windowDays}
                min={1}
                max={365}
                onChange={(event) => setWindowDays(Number(event.target.value))}
              />
            </label>

            <label className="field">
              Horizon (days)
              <input
                type="number"
                aria-label="Horizon in days"
                value={horizonDays}
                min={1}
                max={365}
                onChange={(event) => setHorizonDays(Number(event.target.value))}
              />
            </label>

            <button type="submit" disabled={createForecast.isPending}>
              {createForecast.isPending ? 'Generating…' : 'Generate forecast'}
            </button>
          </div>
        </form>

        {formError && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <ErrorState title="Check the forecast settings" message={formError} />
          </div>
        )}

        {createForecast.isError && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <ErrorState
              title="Unable to generate the forecast"
              message={toErrorMessage(createForecast.error)}
            />
          </div>
        )}
      </Panel>

      {/* Forecast summary — every figure comes from the stored forecast. */}
      {latest && (
        <div className="metrics">
          <MetricCard
            index={0}
            icon="activity"
            label="Average per day"
            value={latest.averageDailyConsumption}
            note={
              <span data-testid="forecast-result">
                {formatNumber(latest.averageDailyConsumption)} units per day
              </span>
            }
          />
          <MetricCard
            index={1}
            icon="trend"
            label="Projected demand"
            value={latest.predictedDemand}
            note={`Over a ${latest.horizonDays} day horizon`}
          />
          <MetricCard
            index={2}
            icon="calendar"
            label="Forecast period"
            value={`${latest.windowDays}d → ${latest.horizonDays}d`}
            note="History window to forward horizon"
          />
          <MetricCard
            index={3}
            icon="shield"
            label="Confidence"
            value={`${Math.round(latest.confidenceScore * 100)}%`}
            note="Share of days in the window carrying data"
            tone={latest.confidenceScore >= 0.8 ? 'positive' : 'caution'}
          />
        </div>
      )}

      <div className="split">
        <Panel
          title="Average daily consumption by forecast"
          description={`${medicineName(medicineId)} · each point is one stored forecast`}
          icon="chart"
          actions={
            <label className="field">
              Filter by method
              <select
                value={methodFilter}
                aria-label="Filter forecasts by method"
                onChange={(event) => {
                  setMethodFilter(event.target.value as ForecastMethod | '');
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {FORECAST_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {methodLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          {isLoading && (
            <SkeletonRegion label="Loading forecasts…">
              <SkeletonChart />
            </SkeletonRegion>
          )}

          {isError && (
            <ErrorState
              title="Unable to load forecasts"
              message={toErrorMessage(error)}
              onRetry={() => refetch()}
            />
          )}

          {data && items.length === 0 && (
            <EmptyState
              label="No forecasts generated yet."
              hint="Generate one above to see how demand is trending for this medicine."
              icon={<Icon name="trend" size={20} />}
            />
          )}

          {data && items.length > 0 && (
            <div className="chart" data-testid="forecast-chart">
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
                  <defs>
                    <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--gridline)" vertical={false} />
                  <XAxis
                    dataKey="generatedAt"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border-strong)' }}
                    tickMargin={8}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                    content={<ChartTooltip unit="units/day" />}
                  />
                  <Area
                    type="monotone"
                    dataKey="averageDailyConsumption"
                    name="Average per day"
                    stroke="var(--series-1)"
                    strokeWidth={2}
                    fill="url(#forecastFill)"
                    dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }}
                    activeDot={{ r: 5 }}
                    animationDuration={400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          title="Forecast timeline"
          description="How the derivation runs in time order"
          icon="clock"
        >
          {latest ? (
            <ForecastTimeline
              averageDailyConsumption={latest.averageDailyConsumption}
              currentStock={null}
              daysRemaining={null}
              leadTimeDays={latest.leadTimeDays}
              projectedStockout={formatDate(latest.forecastDate)}
            />
          ) : (
            <EmptyState
              label="No forecast available for this selection"
              hint="Generate a forecast to see the timeline."
              icon={<Icon name="clock" size={20} />}
            />
          )}
        </Panel>
      </div>

      <Panel title="Forecast history" description="Every forecast stored for this medicine" icon="chart" flush>
        {isLoading && <SkeletonTable columns={6} />}

        {data && items.length > 0 && (
          <>
            <div className="table-wrap">
              <DataTable caption="Forecast history" columns={columns} rows={items} />
            </div>
            <Pagination page={data.page} totalPages={pageCount(data)} onPageChange={setPage} />
          </>
        )}
      </Panel>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this forecast?"
          message={
            'A forecast records what the calculation produced from a given window. ' +
            'Any shortage alert derived from it keeps its own figures.'
          }
          confirmLabel="Delete"
          destructive
          busy={deleteForecast.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteForecast.mutateAsync(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

export default ForecastPage;
