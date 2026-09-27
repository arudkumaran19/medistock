/**
 * Shortage dashboard - the management view of shortage risk.
 * Sathurstiga S. (IT24103156).
 *
 * React is the management application: monitor, analyse and report. Recording
 * consumption in the field belongs to Flutter.
 *
 * The page is ordered so the answer arrives before the detail: headline figures, then
 * the split of severities, then the per-medicine rows.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagination } from '@/components/Pagination';
import { SearchBar } from '@/components/SearchBar';
import { toErrorMessage } from '@/services/apiClient';
import type { ShortageAlert, ShortageRiskLevel } from '@/types/demand';
import { DemandChain } from './DemandChain';
import { Icon } from './components/Icon';
import { MetricCard } from './components/MetricCard';
import { PageHeader, Panel } from './components/Panel';
import { RiskDistribution } from './components/RiskDistribution';
import { SeverityBadge, StatusChip } from './components/SeverityBadge';
import { SkeletonMetrics, SkeletonRegion, SkeletonTable } from './components/Skeleton';
import { formatDate, formatDaysRemaining, formatNumber } from './format';
import { facilityName, medicineName } from './reference';
import {
  DEMO_FACILITY_ID,
  useDeleteShortage,
  useResolveShortage,
  useShortages,
} from './hooks';

const PAGE_SIZE = 10;

export function ShortageDashboard({ facilityId = DEMO_FACILITY_ID }: { facilityId?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState<ShortageRiskLevel | ''>('');
  const [sortBy, setSortBy] = useState('generatedAt');
  const [pendingDelete, setPendingDelete] = useState<ShortageAlert | null>(null);

  const resolveShortage = useResolveShortage();
  const deleteShortage = useDeleteShortage();

  const query = useMemo(
    () => ({
      facilityId,
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      riskLevel: riskLevel || undefined,
      sortBy,
      sortOrder: 'desc' as const,
    }),
    [facilityId, page, search, riskLevel, sortBy],
  );

  const { data, isLoading, isError, error, refetch } = useShortages(query);

  const items = data?.items ?? [];
  const atRisk = items.filter((alert) => alert.requiresTransfer);
  const highCount = items.filter((alert) => alert.riskLevel === 'HIGH').length;
  const mediumCount = items.length - highCount;

  const medicinesAtRisk = new Set(atRisk.map((alert) => alert.medicineId)).size;

  // Mean days of cover, ignoring alerts with no projected stockout: averaging a
  // "never runs out" as zero would understate the position badly.
  const withCover = items.filter((alert) => alert.daysRemaining !== null);
  const averageCover =
    withCover.length > 0
      ? Math.round(
          withCover.reduce((sum, alert) => sum + (alert.daysRemaining ?? 0), 0) / withCover.length,
        )
      : 0;

  const earliest = atRisk
    .map((alert) => alert.projectedStockoutDate)
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  const columns: Column<ShortageAlert>[] = [
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
    {
      key: 'stock',
      header: 'Stock',
      render: (row) => (
        <>
          <div className="cell-emphasis">{formatNumber(row.currentStock)}</div>
          <div className="cell-secondary">{formatNumber(row.averageDailyConsumption)}/day</div>
        </>
      ),
    },
    {
      key: 'daysRemaining',
      header: 'Days of cover',
      render: (row) => (
        <span className={row.requiresTransfer ? 'cell-critical' : 'cell-emphasis'}>
          {formatDaysRemaining(row.daysRemaining)}
        </span>
      ),
    },
    { key: 'leadTime', header: 'Lead time', render: (row) => `${row.leadTimeDays} days` },
    {
      key: 'stockout',
      header: 'Projected stockout',
      render: (row) => formatDate(row.projectedStockoutDate),
    },
    {
      key: 'risk',
      header: 'Severity',
      render: (row) => <SeverityBadge level={row.riskLevel} />,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <span className="row-actions">
          <Link to={`/demand/shortages/${row.id}`}>View</Link>
          <Link to={`/demand/shortages/${row.id}/edit`}>Edit</Link>
          {row.status !== 'RESOLVED' && (
            <button
              type="button"
              disabled={resolveShortage.isPending}
              onClick={() => resolveShortage.mutate(row.id)}
            >
              Resolve
            </button>
          )}
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

  return (
    <section aria-labelledby="shortage-dashboard-heading" className="stack">
      <PageHeader
        title="Demand & Shortage Monitoring"
        subtitle="Monitor consumption trends, forecast demand, and identify potential medicine shortages before they occur."
        actions={
          <Link to="/demand/shortages/new">
            <button type="button">Raise alert</button>
          </Link>
        }
      >
        <h2 id="shortage-dashboard-heading" className="visually-hidden">
          Shortage dashboard
        </h2>
        <DemandChain active="alert" />
      </PageHeader>

      {isLoading && (
        <SkeletonRegion label="Loading shortage alerts…">
          <SkeletonMetrics />
          <div className="panel">
            <SkeletonTable columns={6} />
          </div>
        </SkeletonRegion>
      )}

      {isError && (
        <ErrorState
          title="Unable to load shortage information"
          message={toErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      {data && items.length > 0 && (
        <div className="metrics">
          <MetricCard
            index={0}
            icon="alert"
            label="Active alerts"
            value={items.length}
            note={`${atRisk.length} require a transfer`}
            tone={atRisk.length > 0 ? 'critical' : 'neutral'}
          />
          <MetricCard
            index={1}
            icon="package"
            label="Medicines at risk"
            value={medicinesAtRisk}
            note="Distinct medicines needing action"
            tone={medicinesAtRisk > 0 ? 'caution' : 'neutral'}
          />
          <MetricCard
            index={2}
            icon="clock"
            label="Average cover"
            value={averageCover}
            unit="days"
            note="Mean across alerts with a projected stockout"
          />
          <MetricCard
            index={3}
            icon="calendar"
            label="Earliest stockout"
            value={earliest ? formatDate(earliest) : 'None'}
            note="Soonest projected across alerts at risk"
            tone={earliest ? 'critical' : 'positive'}
          />
        </div>
      )}

      {data && (
        <div className="split">
          {/*
            The filter controls live outside every data conditional. They are controls,
            not results: unmounting them while a query reloads throws away focus
            mid-keystroke and makes the search box vanish as you type.
          */}
          <Panel
            title="Shortage risk"
            description="Medicines whose cover is shorter than their supplier lead time"
            icon="activity"
            flush
            actions={
              <div className="toolbar">
                <SearchBar
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  label="Search shortage alerts"
                  placeholder="Search by risk or status"
                />

                <label className="field">
                  Risk level
                  <select
                    value={riskLevel}
                    aria-label="Filter by risk level"
                    onChange={(event) => {
                      setRiskLevel(event.target.value as ShortageRiskLevel | '');
                      setPage(1);
                    }}
                  >
                    <option value="">All</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                  </select>
                </label>

                <label className="field">
                  Sort by
                  <select
                    value={sortBy}
                    aria-label="Sort shortage alerts"
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option value="generatedAt">Most recent</option>
                    <option value="daysRemaining">Days of cover</option>
                    <option value="projectedStockoutDate">Projected stockout</option>
                    <option value="currentStock">Stock on hand</option>
                  </select>
                </label>
              </div>
            }
          >
            {items.length === 0 ? (
              <div className="panel__body">
                <EmptyState
                  label="No shortage risks detected"
                  hint="No alert matches these filters. Clear the search or risk level to see everything for this facility."
                  icon={<Icon name="shield" size={20} />}
                />
              </div>
            ) : (
              <>
                <div className="table-wrap">
                  <DataTable caption="Shortage alerts" columns={columns} rows={items} />
                </div>
                <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
              </>
            )}
          </Panel>

          {items.length > 0 && (
            <Panel
              title="Risk distribution"
              description="Severity split across the alerts shown"
              icon="chart"
            >
              <RiskDistribution high={highCount} medium={mediumCount} />
              <p className="cell-secondary" style={{ marginTop: 'var(--space-4)' }}>
                <span data-testid="high-risk-summary">
                  {atRisk.length} of {items.length} alerts on this page require a transfer.
                </span>
              </p>
            </Panel>
          )}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this alert?"
          message={
            'Deleting removes the record that this shortage ever happened. ' +
            'If the shortage is over, resolve it instead so the history is kept.'
          }
          confirmLabel="Delete"
          destructive
          busy={deleteShortage.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteShortage.mutateAsync(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

export default ShortageDashboard;
