/**
 * Shortage dashboard - the management view of shortage risk.
 * Sathurstiga S. (IT24103156).
 *
 * React is the management application: monitor, analyse and report. Recording
 * consumption in the field belongs to Flutter.
 *
 * Redesigned for high information density, responsive layout, verified resolution,
 * manager dismissal workflows, and sticky headers.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagination } from '@/components/Pagination';
import { SearchBar } from '@/components/SearchBar';
import { toErrorMessage } from './errors';
import { pageCount } from '@/types/demand';
import type { ShortageAlert, ShortageRiskLevel } from '@/types/demand';
import { DemandChain } from './DemandChain';
import { useReferenceData } from './referenceApi';
import { Icon } from './components/Icon';
import { MetricCard } from './components/MetricCard';
import { PageHeader, Panel } from './components/Panel';
import { RiskDistribution } from './components/RiskDistribution';
import { SeverityBadge, StatusChip } from './components/SeverityBadge';
import { SkeletonMetrics, SkeletonRegion, SkeletonTable } from './components/Skeleton';
import { describeScan, formatDate, formatDaysRemaining, formatNumber } from './format';
import { facilityName, knownFacilities, medicineName, optionLabel } from './reference';
import {
  useDeleteShortage,
  useDismissShortage,
  useResolveShortage,
  useScanShortages,
  useShortages,
} from './hooks';

const PAGE_SIZE = 10;

export function ShortageDashboard({
  facilityId: initialFacilityId = '',
}: {
  facilityId?: string;
}) {
  // Medicine and facility names come from the Inventory API. Re-renders when they
  // arrive, which is what lets the facility dropdown list every facility.
  useReferenceData();

  // Every facility by default. This page used to be pinned to the demonstration
  // facility, so an alert raised anywhere else was saved but never shown here.
  const [facilityId, setFacilityId] = useState(initialFacilityId);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState<ShortageRiskLevel | ''>('');
  const [sortBy, setSortBy] = useState('generatedAt');
  const [pendingDelete, setPendingDelete] = useState<ShortageAlert | null>(null);

  // Verified Resolution Modal state
  const [resolveTarget, setResolveTarget] = useState<ShortageAlert | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<string>('STOCK_AUDIT');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifiedStock, setVerifiedStock] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Dismiss Modal state
  const [dismissTarget, setDismissTarget] = useState<ShortageAlert | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [dismissError, setDismissError] = useState<string | null>(null);

  const resolveShortage = useResolveShortage();
  const dismissShortage = useDismissShortage();
  const deleteShortage = useDeleteShortage();
  const scanShortages = useScanShortages();

  const query = useMemo(
    () => ({
      facilityId: facilityId || undefined,
      status: status || undefined,
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      riskLevel: riskLevel || undefined,
      sortBy,
      sortOrder: 'desc' as const,
    }),
    [facilityId, status, page, search, riskLevel, sortBy],
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

  function openResolveModal(alert: ShortageAlert) {
    setResolveTarget(alert);
    setVerificationMethod('STOCK_AUDIT');
    setVerificationNotes('');
    setVerifiedStock(String(alert.currentStock));
    setResolveError(null);
  }

  function openDismissModal(alert: ShortageAlert) {
    setDismissTarget(alert);
    setDismissReason('');
    setDismissError(null);
  }

  async function handleConfirmResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveTarget) return;
    if (!verificationNotes.trim()) {
      setResolveError('Clinical justification / verification rationale is required.');
      return;
    }
    setResolveError(null);

    try {
      await resolveShortage.mutateAsync({
        id: resolveTarget.id,
        request: {
          verificationMethod,
          verificationNotes: verificationNotes.trim(),
          verifiedCurrentStock: verifiedStock !== '' ? Number(verifiedStock) : undefined,
          transferId: resolveTarget.transferId ?? undefined,
          purchaseOrderId: resolveTarget.purchaseOrderId ?? undefined,
        },
      });
      setResolveTarget(null);
    } catch (err) {
      setResolveError(toErrorMessage(err));
    }
  }

  async function handleConfirmDismiss(e: React.FormEvent) {
    e.preventDefault();
    if (!dismissTarget) return;
    if (!dismissReason.trim()) {
      setDismissError('A dismissal reason is required.');
      return;
    }
    setDismissError(null);

    try {
      await dismissShortage.mutateAsync({
        id: dismissTarget.id,
        request: { reason: dismissReason.trim() },
      });
      setDismissTarget(null);
    } catch (err) {
      setDismissError(toErrorMessage(err));
    }
  }

  const columns: Column<ShortageAlert>[] = [
    {
      key: 'medicine',
      header: 'Medicine',
      render: (row) => (
        <div style={{ minWidth: 200 }}>
          <div className="cell-primary">{medicineName(row.medicineId)}</div>
          <div className="cell-secondary">{facilityName(row.facilityId)}</div>
        </div>
      ),
    },
    {
      key: 'facility',
      header: 'Facility',
      render: (row) => (
        <div style={{ minWidth: 140 }}>
          <span className="cell-primary" style={{ fontSize: '0.8125rem' }}>
            {facilityName(row.facilityId)}
          </span>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (row) => (
        <div style={{ minWidth: 110 }}>
          <div className="cell-emphasis">{formatNumber(row.currentStock)}</div>
          <div className="cell-secondary">{formatNumber(row.averageDailyConsumption)}/day</div>
        </div>
      ),
    },
    {
      key: 'daysRemaining',
      header: 'Days of cover',
      render: (row) => (
        <div style={{ minWidth: 110 }}>
          <span className={row.requiresTransfer ? 'cell-critical' : 'cell-emphasis'}>
            {formatDaysRemaining(row.daysRemaining)}
          </span>
        </div>
      ),
    },
    {
      key: 'leadTime',
      header: 'Lead time',
      render: (row) => <div style={{ minWidth: 90 }}>{`${row.leadTimeDays} days`}</div>,
    },
    {
      key: 'stockout',
      header: 'Projected stockout',
      render: (row) => (
        <div style={{ minWidth: 120 }}>{formatDate(row.projectedStockoutDate)}</div>
      ),
    },
    {
      key: 'risk',
      header: 'Severity',
      render: (row) => (
        <div style={{ minWidth: 100 }}>
          <SeverityBadge level={row.riskLevel} />
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div style={{ minWidth: 110 }}>
          <StatusChip status={row.status} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div style={{ minWidth: 160 }}>
          <span className="row-actions">
            <Link to={`/demand/shortages/${row.id}`}>View</Link>
            <Link to={`/demand/shortages/${row.id}/edit`}>Edit</Link>
            {row.status !== 'RESOLVED' && row.status !== 'DISMISSED' && (
              <>
                <button
                  type="button"
                  disabled={resolveShortage.isPending}
                  onClick={() => openResolveModal(row)}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={dismissShortage.isPending}
                  onClick={() => openDismissModal(row)}
                  style={{ color: '#64748b' }}
                >
                  Dismiss
                </button>
              </>
            )}
            <button
              type="button"
              className="button--destructive"
              onClick={() => setPendingDelete(row)}
            >
              Delete
            </button>
          </span>
        </div>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="shortage-dashboard-heading"
      className="demand-vertical stack"
      data-theme="light"
    >
      <PageHeader
        title="Demand & Shortage Monitoring"
        subtitle="Monitor consumption trends, forecast demand, and identify potential medicine shortages before they occur."
        actions={
          <span className="row-actions">
            <button
              type="button"
              disabled={scanShortages.isPending}
              onClick={() => scanShortages.mutate()}
            >
              {scanShortages.isPending ? 'Scanning…' : 'Scan now'}
            </button>
            <Link to="/demand/shortages/new">
              <button type="button">Raise alert</button>
            </Link>
          </span>
        }
      >
        <h2 id="shortage-dashboard-heading" className="visually-hidden">
          Shortage dashboard
        </h2>
        <DemandChain active="alert" />
      </PageHeader>

      {scanShortages.isSuccess && (
        <p className="card__hint" role="status" data-testid="scan-result">
          {describeScan(scanShortages.data)}
        </p>
      )}

      {scanShortages.isError && (
        <ErrorState title="Scan failed" message={toErrorMessage(scanShortages.error)} />
      )}

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
        <div
          className="metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
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
          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                }}
              >
                Risk distribution
              </span>
              <span
                className="cell-secondary"
                data-testid="high-risk-summary"
                style={{ fontSize: '0.6875rem' }}
              >
                {atRisk.length} of {items.length} alerts on this page require a transfer.
              </span>
            </div>
            <RiskDistribution high={highCount} medium={mediumCount} />
          </div>
        </div>
      )}

      {data && (
        <div style={{ width: '100%' }}>
          <Panel
            title="Shortage risk"
            description="Medicines whose cover is shorter than their supplier lead time"
            icon="activity"
            flush
            actions={
              <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
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
                  Facility
                  <select
                    value={facilityId}
                    aria-label="Filter by facility"
                    onChange={(event) => {
                      setFacilityId(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All facilities</option>
                    {knownFacilities().map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {optionLabel(facility)}
                      </option>
                    ))}
                  </select>
                </label>

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
                  Status
                  <select
                    value={status}
                    aria-label="Filter by status"
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Active (exclude dismissed)</option>
                    <option value="OPEN">Open</option>
                    <option value="ACKNOWLEDGED">Acknowledged</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="DISMISSED">Dismissed</option>
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
                <div
                  className="table-wrap shortage-table-wrap"
                  style={{
                    overflowX: 'auto',
                    maxHeight: 'calc(100vh - 360px)',
                    minHeight: 280,
                  }}
                >
                  <DataTable caption="Shortage alerts" columns={columns} rows={items} />
                </div>
                <Pagination page={data.page} totalPages={pageCount(data)} onPageChange={setPage} />
              </>
            )}
          </Panel>
        </div>
      )}

      {/* Verified Resolution Modal */}
      {resolveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 520,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#0f172a' }}>
              Verified Resolution
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Confirm verified resolution for{' '}
              <strong>{medicineName(resolveTarget.medicineId)}</strong> at{' '}
              <strong>{facilityName(resolveTarget.facilityId)}</strong>.
            </p>

            <form onSubmit={handleConfirmResolve}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="field">
                  Verification Method
                  <select
                    value={verificationMethod}
                    aria-label="Verification Method"
                    onChange={(e) => setVerificationMethod(e.target.value)}
                  >
                    <option value="STOCK_AUDIT">Physical Stock Count / Audit Recheck</option>
                    <option value="TRANSFER_RECEIPT">Delivered Inter-Hospital Transfer</option>
                    <option value="PROCUREMENT_RECEIPT">Received Supplier Purchase Order</option>
                    <option value="CLINICAL_WAIVER">Clinical Protocol Substitution / Safety Waiver</option>
                  </select>
                </label>

                {verificationMethod === 'STOCK_AUDIT' && (
                  <label className="field">
                    Verified Physical Stock Count
                    <input
                      type="number"
                      min={0}
                      aria-label="Verified Physical Stock Count"
                      value={verifiedStock}
                      onChange={(e) => setVerifiedStock(e.target.value)}
                    />
                  </label>
                )}

                <label className="field">
                  Verification Rationale & Evidence (Required for Audit Trail)
                  <textarea
                    rows={3}
                    aria-label="Verification Rationale"
                    value={verificationNotes}
                    placeholder="Document physical inventory audit result, transfer delivery confirmation, or medical waiver reason…"
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>

                {resolveError && (
                  <div
                    style={{
                      color: '#be123c',
                      fontSize: '0.85rem',
                      background: '#ffe4e6',
                      padding: '8px 12px',
                      borderRadius: 6,
                    }}
                  >
                    {resolveError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setResolveTarget(null);
                      setResolveError(null);
                    }}
                    disabled={resolveShortage.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button--primary"
                    disabled={resolveShortage.isPending}
                  >
                    {resolveShortage.isPending ? 'Verifying…' : 'Confirm Resolution'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dismiss Shortage Modal */}
      {dismissTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#0f172a' }}>
              Dismiss Shortage Alert
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Dismiss this alert for{' '}
              <strong>{medicineName(dismissTarget.medicineId)}</strong> as invalid, duplicate, or clinically mitigated.
            </p>

            <form onSubmit={handleConfirmDismiss}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="field">
                  Dismissal Reason (Required for Audit Trail)
                  <textarea
                    rows={3}
                    aria-label="Dismissal Reason"
                    value={dismissReason}
                    placeholder="Provide justification for dismissing this alert (e.g. duplicate notification, seasonal pause, alternate formulary available)…"
                    onChange={(e) => setDismissReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>

                {dismissError && (
                  <div
                    style={{
                      color: '#be123c',
                      fontSize: '0.85rem',
                      background: '#ffe4e6',
                      padding: '8px 12px',
                      borderRadius: 6,
                    }}
                  >
                    {dismissError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissTarget(null);
                      setDismissError(null);
                    }}
                    disabled={dismissShortage.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button--primary"
                    disabled={dismissShortage.isPending}
                  >
                    {dismissShortage.isPending ? 'Dismissing…' : 'Confirm Dismissal'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
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

      <style>{`
        .shortage-table-wrap thead th {
          position: sticky !important;
          top: 0 !important;
          z-index: 2 !important;
          background: #f8fafc !important;
          box-shadow: 0 1px 0 #e2e8f0;
        }
        .shortage-table-wrap tbody td {
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }
      `}</style>
    </section>
  );
}

export default ShortageDashboard;
