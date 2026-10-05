/**
 * Transfer management dashboard. Redistribution vertical (Member 3).
 * Same design system as the Demand pages, so the vertical reads as part of one product.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagination } from '@/components/Pagination';
import { SearchBar } from '@/components/SearchBar';
import { Icon } from '@/features/demand/components/Icon';
import { MetricCard } from '@/features/demand/components/MetricCard';
import { PageHeader, Panel } from '@/features/demand/components/Panel';
import { SkeletonMetrics, SkeletonRegion, SkeletonTable } from '@/features/demand/components/Skeleton';
import { formatDate } from '@/features/demand/format';

import { type Transfer, useTransfers, useTransferSummary } from './api';
import { PriorityBadge, TransferStatusBadge } from './badges';

const PAGE_SIZE = 10;

const FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All transfers', value: '' },
  { label: 'Requested', value: 'Requested' },
  { label: 'Proposed', value: 'Proposed' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Reserved', value: 'Reserved' },
  { label: 'In transit', value: 'InTransit' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
];

export function TransferDashboard() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({ status: status || undefined, search: search || undefined, page, pageSize: PAGE_SIZE }),
    [status, search, page],
  );

  const summary = useTransferSummary();
  const { data, isLoading, isError, error, refetch } = useTransfers(query);
  const items = data?.items ?? [];

  const columns: Column<Transfer>[] = [
    {
      key: 'number',
      header: 'Transfer #',
      render: (row) => (
        <Link to={`/redistribution/transfers/${row.id}`} className="cell-emphasis">
          {row.transferNumber}
        </Link>
      ),
    },
    {
      key: 'medicine',
      header: 'Medicine',
      render: (row) => (
        <>
          <div className="cell-primary">{row.medicineName}</div>
          <div className="cell-secondary">{row.batchNumber ? `Batch ${row.batchNumber}` : 'Batch on reservation'}</div>
        </>
      ),
    },
    { key: 'source', header: 'Source', render: (row) => row.sourceFacilityName ?? <span className="cell-secondary">Not chosen</span> },
    { key: 'destination', header: 'Destination', render: (row) => row.destinationFacilityName },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (row) => (
        <span className="cell-emphasis">
          {row.quantity} <span className="cell-secondary">{row.unit}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <TransferStatusBadge status={row.status} /> },
    { key: 'priority', header: 'Priority', render: (row) => <PriorityBadge priority={row.priority} /> },
    { key: 'created', header: 'Raised', render: (row) => formatDate(row.createdAtUtc) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <span className="row-actions">
          <Link to={`/redistribution/transfers/${row.id}`}>Details</Link>
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="transfer-dashboard-heading" className="demand-vertical stack" data-theme="light">
      <PageHeader
        title="Transfer Management"
        subtitle="Move medicine from facilities with surplus to facilities facing a shortage."
        actions={
          <Link to="/redistribution/transfers/new" className="button button--primary">
            New transfer
          </Link>
        }
      >
        <h2 id="transfer-dashboard-heading" className="visually-hidden">
          Transfer management
        </h2>
      </PageHeader>

      {summary.isLoading ? (
        <SkeletonRegion label="Loading transfer summary…">
          <SkeletonMetrics count={4} />
        </SkeletonRegion>
      ) : (
        summary.data && (
          <div className="metrics">
            <MetricCard index={0} icon="clock" tone="caution" label="Pending approval" value={summary.data.pendingApproval} note="Requested or proposed, awaiting a manager" />
            <MetricCard index={1} icon="shield" label="Approved / reserved" value={summary.data.approvedOrReserved} note="Stock locked at the source facility" />
            <MetricCard index={2} icon="activity" label="In transit" value={summary.data.inTransit} note="On the road to the destination" />
            <MetricCard index={3} icon="check" tone="positive" label="Delivered" value={summary.data.delivered} note="Received and added to stock" />
          </div>
        )
      )}

      <Panel
        title="Transfers"
        description="Every transfer and where it is in its lifecycle"
        icon="package"
        flush
        actions={
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              label="Search transfers"
              placeholder="Medicine, facility or TR number"
            />
            <label className="field">
              Status
              <select
                value={status}
                aria-label="Filter by status"
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                {FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        {isLoading && (
          <SkeletonRegion label="Loading transfers…">
            <SkeletonTable columns={7} />
          </SkeletonRegion>
        )}

        {isError && (
          <div className="panel__body">
            <ErrorState title="Unable to load transfers" message={(error as Error).message} onRetry={() => refetch()} />
          </div>
        )}

        {data && items.length === 0 && (
          <div className="panel__body">
            <EmptyState
              label="No transfers yet"
              hint="Raise one when a facility is short of a medicine another facility holds in surplus."
              icon={<Icon name="inbox" size={20} />}
            />
          </div>
        )}

        {data && items.length > 0 && (
          <>
            <div className="table-wrap">
              <DataTable caption="Transfers" columns={columns} rows={items} />
            </div>
            <Pagination page={data.page} totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))} onPageChange={setPage} />
          </>
        )}
      </Panel>
    </section>
  );
}

export default TransferDashboard;
