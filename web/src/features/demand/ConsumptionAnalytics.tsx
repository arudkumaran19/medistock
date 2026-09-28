/**
 * Consumption analytics - the management view of recorded usage.
 * Sathurstiga S. (IT24103156).
 *
 * Analysis only. Recording consumption is a field operation and belongs to Flutter;
 * this page corrects and interprets what the field recorded.
 *
 * One chart, deliberately. Daily quantity is the series that answers the question this
 * page exists for; stacking weekly and monthly roll-ups beside it would repeat the
 * same numbers at three resolutions and make the page slower to read, not richer.
 */
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagination } from '@/components/Pagination';
import { SearchBar } from '@/components/SearchBar';
import { toErrorMessage } from './errors';
import type { ConsumptionRecord } from '@/types/demand';
import { ChartTooltip } from './ChartTooltip';
import { DemandChain } from './DemandChain';
import { Icon } from './components/Icon';
import { MetricCard } from './components/MetricCard';
import { PageHeader, Panel } from './components/Panel';
import { SkeletonChart, SkeletonMetrics, SkeletonRegion, SkeletonTable } from './components/Skeleton';
import { formatDate, formatNumber } from './format';
import { KNOWN_MEDICINES, facilityName, medicineName } from './reference';
import {
  DEMO_FACILITY_ID,
  useConsumption,
  useDeleteConsumption,
  useUpdateConsumption,
} from './hooks';

const PAGE_SIZE = 10;

export function ConsumptionAnalytics({ facilityId = DEMO_FACILITY_ID }: { facilityId?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('consumptionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [editing, setEditing] = useState<ConsumptionRecord | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ConsumptionRecord | null>(null);

  const updateConsumption = useUpdateConsumption();
  const deleteConsumption = useDeleteConsumption();

  const query = useMemo(
    () => ({
      facilityId,
      medicineId: medicineId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      sortBy,
      sortOrder,
    }),
    [facilityId, medicineId, fromDate, toDate, page, search, sortBy, sortOrder],
  );

  const { data, isLoading, isError, error, refetch } = useConsumption(query);

  const items = data?.items ?? [];

  const totalOnPage = items.reduce((sum, record) => sum + record.quantityUsed, 0);
  const averageOnPage = items.length > 0 ? totalOnPage / items.length : 0;
  const peak = items.reduce((max, record) => Math.max(max, record.quantityUsed), 0);

  // Oldest first, so the chart reads left to right in time order.
  const chartData = items
    .slice()
    .reverse()
    .map((record) => ({
      date: formatDate(record.consumptionDate),
      quantityUsed: record.quantityUsed,
    }));

  const columns: Column<ConsumptionRecord>[] = [
    {
      key: 'medicine',
      header: 'Medicine',
      render: (row) => (
        <>
          <div className="cell-primary">{medicineName(row.medicineId)}</div>
          <div className="cell-secondary">{facilityName(row.facilityId)}</div>
        </>
      ),
    },
    { key: 'date', header: 'Date', render: (row) => formatDate(row.consumptionDate) },
    {
      key: 'quantity',
      header: 'Quantity used',
      render: (row) => <span className="cell-emphasis">{formatNumber(row.quantityUsed)}</span>,
    },
    { key: 'source', header: 'Source', render: (row) => row.source },
    { key: 'notes', header: 'Notes', render: (row) => row.notes ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <span className="row-actions">
          {editing?.id === row.id ? (
            <>
              <input
                type="number"
                aria-label={`Corrected quantity for ${row.id}`}
                value={editQuantity}
                min={0}
                style={{ width: 90 }}
                onChange={(event) => setEditQuantity(event.target.value)}
              />
              <button
                type="button"
                disabled={updateConsumption.isPending}
                onClick={async () => {
                  const quantity = Number(editQuantity);

                  if (editQuantity === '' || Number.isNaN(quantity) || quantity <= 0) {
                    setEditError('Quantity must be greater than zero.');
                    return;
                  }

                  setEditError(null);
                  await updateConsumption.mutateAsync({
                    id: row.id,
                    request: {
                      facilityId: row.facilityId,
                      medicineId: row.medicineId,
                      quantityUsed: quantity,
                      consumptionDate: row.consumptionDate,
                      source: row.source,
                      notes: row.notes,
                    },
                  });
                  setEditing(null);
                }}
              >
                Save
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(row);
                  setEditQuantity(String(row.quantityUsed));
                  setEditError(null);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="button--destructive"
                onClick={() => setPendingDelete(row)}
              >
                Delete
              </button>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="consumption-analytics-heading" className="stack">
      <PageHeader
        title="Consumption Analytics"
        subtitle="Analyze historical medicine consumption across facilities and identify demand patterns."
      >
        <h2 id="consumption-analytics-heading" className="visually-hidden">
          Consumption analytics
        </h2>
        <DemandChain active="consumption" />
      </PageHeader>

      {isLoading && (
        <SkeletonRegion label="Loading consumption…">
          <SkeletonMetrics count={3} />
          <div className="panel">
            <SkeletonChart />
          </div>
          <div className="panel">
            <SkeletonTable columns={5} />
          </div>
        </SkeletonRegion>
      )}

      {isError && (
        <ErrorState
          title="Unable to load consumption data"
          message={toErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      {data && items.length > 0 && (
        <div className="metrics" data-testid="consumption-summary">
          <MetricCard
            index={0}
            icon="inbox"
            label="Records shown"
            value={items.length}
            note={`Of ${data.totalCount} recorded for this facility`}
          />
          <MetricCard
            index={1}
            icon="package"
            label="Total quantity"
            value={totalOnPage}
            unit="units"
            note="Across these records"
          />
          <MetricCard
            index={2}
            icon="activity"
            label="Average per record"
            value={Math.round(averageOnPage)}
            note="Not the daily rate — the backend derives that"
          />
        </div>
      )}

      {data && (
        <Panel
          title="Consumption records"
          description="Quantity used per day, oldest to newest"
          icon="chart"
          actions={
            <div className="toolbar">
              <SearchBar
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                label="Search consumption records"
                placeholder="Search by source or notes"
              />

              <label className="field">
                Medicine
                <select
                  value={medicineId}
                  aria-label="Filter by medicine"
                  onChange={(event) => {
                    setMedicineId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All medicines</option>
                  {KNOWN_MEDICINES.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                From
                <input
                  type="date"
                  aria-label="From date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setPage(1);
                  }}
                />
              </label>

              <label className="field">
                To
                <input
                  type="date"
                  aria-label="To date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setPage(1);
                  }}
                />
              </label>

              <label className="field">
                Sort by
                <select
                  value={sortBy}
                  aria-label="Sort consumption records"
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="consumptionDate">Date</option>
                  <option value="quantityUsed">Quantity</option>
                  <option value="source">Source</option>
                </select>
              </label>

              <label className="field">
                Order
                <select
                  value={sortOrder}
                  aria-label="Sort order"
                  onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>
          }
        >
          {items.length === 0 ? (
            <EmptyState
              label="No consumption data available"
              hint="No consumption recorded for these filters. Widen the date range or clear the medicine filter."
              icon={<Icon name="inbox" size={20} />}
            />
          ) : (
            <div className="chart" data-testid="consumption-chart">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
                  <CartesianGrid stroke="var(--gridline)" vertical={false} />
                  <XAxis
                    dataKey="date"
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
                    domain={[0, Math.ceil(peak * 1.15)]}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--accent-wash)' }}
                    content={<ChartTooltip unit="units" />}
                  />
                  <Bar
                    dataKey="quantityUsed"
                    name="Quantity used"
                    fill="var(--series-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                    animationDuration={400}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      )}

      {data && items.length > 0 && (
        <Panel title="Records" description="Correct a mis-keyed entry inline" icon="inbox" flush>
          <div className="table-wrap">
            <DataTable caption="Consumption records" columns={columns} rows={items} />
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />

          {editError && (
            <div className="panel__body">
              <ErrorState title="Check the quantity" message={editError} />
            </div>
          )}
        </Panel>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this consumption record?"
          message={
            `Removing ${formatNumber(pendingDelete.quantityUsed)} units recorded on ` +
            `${formatDate(pendingDelete.consumptionDate)} changes the history every ` +
            'later forecast is derived from.'
          }
          confirmLabel="Delete"
          destructive
          busy={deleteConsumption.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteConsumption.mutateAsync(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

export default ConsumptionAnalytics;
