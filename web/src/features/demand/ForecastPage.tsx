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
  Legend,
  Line,
  LineChart as RechartsLineChart,
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
import {
  DEMO_FACILITY_ID,
  useConsumption,
  useCreateForecast,
  useCurrentStock,
  useDeleteForecast,
  useForecasts,
} from './hooks';

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

  const [chartMode, setChartMode] = useState<'consumption_vs_forecast' | 'forecast_velocity'>(
    'consumption_vs_forecast',
  );

  const { data: stockData } = useCurrentStock(facilityId, medicineId);
  const { data: consumptionData } = useConsumption({
    facilityId,
    medicineId,
    pageSize: 90,
    sortBy: 'consumptionDate',
    sortOrder: 'desc',
  });

  const currentStock = stockData?.availableQuantity ?? null;
  const daysRemaining =
    latest && currentStock !== null && latest.averageDailyConsumption > 0
      ? Math.floor(currentStock / latest.averageDailyConsumption)
      : null;
  const projectedStockoutDate =
    daysRemaining !== null
      ? new Date(Date.now() + daysRemaining * 86400000).toISOString()
      : null;

  // Aggregate and sort chronologically (oldest to newest)
  const rawConsumption = useMemo(() => {
    const items = consumptionData?.items ?? [];
    const aggregated = new Map<string, { date: Date; qty: number }>();

    for (const c of items) {
      const d = new Date(c.consumptionDate);
      const dateKey = d.toISOString().split('T')[0];
      const existing = aggregated.get(dateKey);
      if (existing) {
        existing.qty += c.quantityUsed;
      } else {
        aggregated.set(dateKey, { date: d, qty: c.quantityUsed });
      }
    }

    return Array.from(aggregated.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }, [consumptionData]);

  const isHistorySparse = rawConsumption.length < 3;

  const consumptionHistorySeries = useMemo(() => {
    return rawConsumption.map((c) => ({
      timeLabel: formatDate(c.date.toISOString()),
      actualDispensed: c.qty,
      projectedDemand: null as number | null,
      lowerConfidence: null as number | null,
      upperConfidence: null as number | null,
    }));
  }, [rawConsumption]);

  const projectionSeries = useMemo(() => {
    if (!latest) return [];
    const points = [];
    const stepDays = Math.max(3, Math.floor(latest.horizonDays / 5));
    const rate = Math.round(latest.averageDailyConsumption * 10) / 10;
    const margin = (1 - Math.min(1, latest.confidenceScore)) * 0.35 * rate;

    // Calculate linear trend slope if method is SIMPLE_TREND
    let slope = 0;
    let intercept = rate;
    const n = rawConsumption.length;
    if (latest.method === 'SIMPLE_TREND' && n >= 2) {
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        const x = i;
        const y = rawConsumption[i].qty;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      }
      const denom = n * sumXX - sumX * sumX;
      if (Math.abs(denom) > 1e-6) {
        slope = (n * sumXY - sumX * sumY) / denom;
        intercept = (sumY - slope * sumX) / n;
      }
    }

    const lastObs = rawConsumption[rawConsumption.length - 1];
    const baseDate = lastObs ? lastObs.date : new Date();

    // Bridge point connecting actual to forecast
    if (lastObs) {
      const bridgeVal = Math.max(0, Math.round((slope !== 0 ? intercept + slope * (n - 1) : rate) * 10) / 10);
      points.push({
        timeLabel: formatDate(baseDate.toISOString()),
        actualDispensed: lastObs.qty,
        projectedDemand: bridgeVal,
        lowerConfidence: Math.max(0, Math.round((bridgeVal - margin) * 10) / 10),
        upperConfidence: Math.round((bridgeVal + margin) * 10) / 10,
      });
    }

    for (let day = stepDays; day <= latest.horizonDays; day += stepDays) {
      const projDate = new Date(baseDate.getTime() + day * 86400000);
      const x = n + day;
      const projVal = Math.max(0, Math.round((slope !== 0 ? intercept + slope * x : rate) * 10) / 10);
      points.push({
        timeLabel: formatDate(projDate.toISOString()),
        actualDispensed: null as number | null,
        projectedDemand: projVal,
        lowerConfidence: Math.max(0, Math.round((projVal - margin) * 10) / 10),
        upperConfidence: Math.round((projVal + margin) * 10) / 10,
      });
    }
    return points;
  }, [latest, rawConsumption]);

  const combinedTimeSeries = useMemo(() => {
    // If we have a bridge point, avoid duplicating the last historical point label
    if (consumptionHistorySeries.length > 0 && projectionSeries.length > 0) {
      return [...consumptionHistorySeries.slice(0, -1), ...projectionSeries];
    }
    return [...consumptionHistorySeries, ...projectionSeries];
  }, [consumptionHistorySeries, projectionSeries]);

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
          title="Demand run-rate and velocity"
          description={`${medicineName(medicineId)} · Genuine consumption data & forward projection`}
          icon="chart"
          actions={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: chartMode === 'consumption_vs_forecast' ? '#0d9488' : 'transparent',
                    color: chartMode === 'consumption_vs_forecast' ? '#ffffff' : '#475569',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setChartMode('consumption_vs_forecast')}
                >
                  Run-Rate vs Actuals
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: chartMode === 'forecast_velocity' ? '#0d9488' : 'transparent',
                    color: chartMode === 'forecast_velocity' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderLeft: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                  onClick={() => setChartMode('forecast_velocity')}
                >
                  Forecast History
                </button>
              </div>

              <label className="field" style={{ margin: 0 }}>
                <select
                  value={methodFilter}
                  aria-label="Filter forecasts by method"
                  onChange={(event) => {
                    setMethodFilter(event.target.value as ForecastMethod | '');
                    setPage(1);
                  }}
                >
                  <option value="">All methods</option>
                  {FORECAST_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {methodLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        >
          {isHistorySparse && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: 12,
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: 8,
                fontSize: '0.8rem',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="warning" size={16} />
              <span>
                <strong>Limited Historical Dispensing:</strong> Only {rawConsumption.length} daily consumption records on file for this facility/medicine pair. At least 14 days of recorded usage is recommended for tight statistical confidence.
              </span>
            </div>
          )}

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

          {chartMode === 'consumption_vs_forecast' ? (
            combinedTimeSeries.length === 0 ? (
              <EmptyState
                label="No recorded consumption history or projections available"
                hint="Log consumption or generate a forecast to visualize demand timelines."
                icon={<Icon name="trend" size={20} />}
              />
            ) : (
              <div className="chart" data-testid="forecast-chart">
                <ResponsiveContainer>
                  <RechartsLineChart data={combinedTimeSeries} margin={{ top: 12, right: 16, bottom: 8, left: -10 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ stroke: '#0d9488', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                      content={<ChartTooltip unit="units/day" />}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '8px' }} />
                    <Line
                      type="monotone"
                      dataKey="actualDispensed"
                      name="Actual Dispensed (Historical)"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 1.5, fill: '#ffffff', stroke: '#0d9488' }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="projectedDemand"
                      name="Projected Demand Run-Rate"
                      stroke="#0284c7"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 4, strokeWidth: 1.5, fill: '#0284c7', stroke: '#ffffff' }}
                      connectNulls={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="upperConfidence"
                      name="Upper Uncertainty Range"
                      stroke="#94a3b8"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      dot={false}
                      connectNulls={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="lowerConfidence"
                      name="Lower Uncertainty Range"
                      stroke="#94a3b8"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      dot={false}
                      connectNulls={true}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            data && items.length === 0 ? (
              <EmptyState
                label="No forecasts generated yet."
                hint="Generate one above to see how demand is trending for this medicine."
                icon={<Icon name="trend" size={20} />}
              />
            ) : (
              <div className="chart" data-testid="forecast-chart">
                {chartData.length === 1 && (
                  <div
                    style={{
                      padding: '10px 14px',
                      marginBottom: 12,
                      background: '#f0fdfa',
                      border: '1px solid #ccfbf1',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      color: '#0f766e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="trend" size={16} />
                    <span>
                      <strong>Initial Baseline Observation:</strong> Single forecast point on record ({chartData[0].generatedAt}). Generating additional forecast intervals plots rate velocity changes.
                    </span>
                  </div>
                )}
                <ResponsiveContainer>
                  <AreaChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: -10 }}>
                    <defs>
                      <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="generatedAt"
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ stroke: '#0d9488', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                      content={<ChartTooltip unit="units/day" />}
                    />
                    <Area
                      type="monotone"
                      dataKey="averageDailyConsumption"
                      name="Average per day"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fill="url(#forecastFill)"
                      dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: '#0d9488' }}
                      activeDot={{ r: 6, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                      animationDuration={400}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
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
              currentStock={currentStock}
              daysRemaining={daysRemaining}
              leadTimeDays={latest.leadTimeDays}
              projectedStockout={projectedStockoutDate ? formatDate(projectedStockoutDate) : formatDate(latest.forecastDate)}
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

        {data && items.length > 0 ? (
          <>
            <div className="table-wrap">
              <DataTable caption="Forecast history" columns={columns} rows={items} />
            </div>
            <Pagination page={data.page} totalPages={pageCount(data)} onPageChange={setPage} />
          </>
        ) : data && items.length === 0 ? (
          <EmptyState
            label="No forecasts generated yet."
            hint="Generate a forecast using the parameters above to begin tracking demand."
          />
        ) : null}
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
