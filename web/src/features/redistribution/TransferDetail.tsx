/**
 * One transfer: where it is in its lifecycle, who can supply it, the route, the
 * manager's decision and the full audit trail. Redistribution vertical (Member 3).
 *
 * Buttons are offered only when the backend says the transition is allowed
 * (allowedNextStatuses) and the signed-in role may perform it, so the page never
 * offers an action the API will refuse.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useAuth } from '@/features/auth/AuthContext';
import { Icon } from '@/features/demand/components/Icon';
import { PageHeader, Panel } from '@/features/demand/components/Panel';
import { SkeletonDetail, SkeletonRegion } from '@/features/demand/components/Skeleton';
import { formatDate } from '@/features/demand/format';

import {
  type Candidate,
  TRANSFER_PIPELINE,
  type Transfer,
  type TransferStatus,
  transferApi,
  useCandidates,
  useRoute,
  useTransfer,
  useTransferMutation,
} from './api';
import { PriorityBadge, TransferStatusBadge, statusLabel } from './badges';
import { RedistributionAgentPanel } from './RedistributionAgentPanel';
import { RouteMap } from './RouteMap';

function Pipeline({ status }: { status: TransferStatus }) {
  const ended = status === 'Rejected' || status === 'Cancelled';
  const reached = TRANSFER_PIPELINE.indexOf(status);

  return (
    <ol aria-label="Transfer status pipeline" style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0, flexWrap: 'wrap' }}>
      {TRANSFER_PIPELINE.map((step, index) => {
        const done = !ended && index <= reached;
        const current = !ended && index === reached;
        return (
          <li key={step} style={{ flex: '1 1 90px', textAlign: 'center' }} aria-current={current ? 'step' : undefined}>
            <div
              style={{
                width: 34,
                height: 34,
                margin: '0 auto 6px',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                color: done ? '#fff' : 'var(--text-muted, #64748b)',
                background: done ? 'var(--series-1, #0f766e)' : 'var(--accent-wash, #f1f5f9)',
                outline: current ? '3px solid rgba(15,118,110,0.25)' : 'none',
              }}
            >
              {done ? '✓' : index + 1}
            </div>
            <div style={{ fontSize: 12, fontWeight: current ? 800 : 600 }}>{statusLabel(step)}</div>
          </li>
        );
      })}
      {ended && (
        <li style={{ flex: '1 1 90px', textAlign: 'center' }}>
          <TransferStatusBadge status={status} />
        </li>
      )}
    </ol>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="cell-secondary">{label}</div>
      <div className="cell-primary">{children}</div>
    </div>
  );
}

export function TransferDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const isManager = hasRole('FACILITY_MANAGER') || hasRole('FacilityManager');

  const transfer = useTransfer(id);
  const t = transfer.data;
  const next = t?.allowedNextStatuses ?? [];
  const canPropose = isManager && next.includes('Proposed');

  const candidates = useCandidates(id, !!t && canPropose);
  const route = useRoute(id, !!t?.sourceFacilityId);

  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const action = useTransferMutation(async (run: () => Promise<Transfer>) => run());

  async function perform(run: () => Promise<Transfer>) {
    setActionError(null);
    try {
      await action.mutateAsync(run);
      setReason('');
    } catch (error) {
      setActionError((error as Error).message);
    }
  }

  if (transfer.isLoading) {
    return (
      <section className="demand-vertical stack" data-theme="light">
        <SkeletonRegion label="Loading transfer…">
          <SkeletonDetail />
        </SkeletonRegion>
      </section>
    );
  }

  if (transfer.isError || !t) {
    return (
      <section className="demand-vertical stack" data-theme="light">
        <ErrorState title="Unable to load the transfer" message={(transfer.error as Error)?.message ?? 'Not found.'} onRetry={() => transfer.refetch()} />
        <Link to="/redistribution/transfers">← Back to transfers</Link>
      </section>
    );
  }

  const busy = action.isPending;

  const candidateColumns: Column<Candidate & { id: string }>[] = [
    { key: 'facility', header: 'Facility', render: (c) => <span className="cell-primary">{c.facilityName}</span> },
    { key: 'surplus', header: 'Surplus', render: (c) => <span className="cell-emphasis">{c.availableSurplus}</span> },
    { key: 'stock', header: 'On hand / reserved / min', render: (c) => `${c.quantityOnHand} / ${c.quantityReserved} / ${c.minimumStock}` },
    { key: 'distance', header: 'Distance', render: (c) => `${c.distanceKm} km · ~${Math.round(c.durationMinutes)} min` },
    { key: 'expiry', header: 'Nearest expiry', render: (c) => (c.nearestExpiryUtc ? formatDate(c.nearestExpiryUtc) : '—') },
    { key: 'score', header: 'Score', render: (c) => <span className="cell-emphasis">{c.score}</span> },
    {
      key: 'propose',
      header: '',
      render: (c) =>
        c.canFulfil ? (
          <button type="button" className="button" disabled={busy} onClick={() => perform(() => transferApi.propose(t.id, c.facilityId))}>
            Propose
          </button>
        ) : (
          <span className="cell-secondary">Too little surplus</span>
        ),
    },
  ];

  return (
    <section className="demand-vertical stack" data-theme="light" aria-labelledby="transfer-detail-heading">
      <PageHeader
        title={t.transferNumber}
        subtitle={`${t.medicineName} · ${t.quantity} ${t.unit} to ${t.destinationFacilityName}`}
        actions={
          <span className="row-actions">
            <TransferStatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
          </span>
        }
      >
        <h2 id="transfer-detail-heading" className="visually-hidden">
          Transfer {t.transferNumber}
        </h2>
        <Link to="/redistribution/transfers">← Back to transfers</Link>
      </PageHeader>

      <Panel title="Status pipeline" description="Each step is recorded in the audit log below" icon="trend">
        <Pipeline status={t.status} />
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5, 20px)' }}>
        <Panel title="Medicine & stock" icon="package">
          <div className="stack" style={{ gap: 12 }}>
            <Fact label="Medicine">{t.medicineName}</Fact>
            <Fact label="Requested quantity">
              <span className="cell-emphasis" style={{ fontSize: 20 }}>
                {t.quantity} {t.unit}
              </span>
            </Fact>
            <Fact label="Batch">{t.batchNumber ?? 'Allocated when stock is reserved (earliest expiry first)'}</Fact>
            <Fact label="Priority">
              <PriorityBadge priority={t.priority} />
            </Fact>
          </div>
        </Panel>

        <Panel title="Facilities" icon="activity">
          <div className="stack" style={{ gap: 12 }}>
            <Fact label="Source (sender)">{t.sourceFacilityName ?? 'Not chosen yet'}</Fact>
            <Fact label="Destination (shortage)">{t.destinationFacilityName}</Fact>
            <Fact label="Estimated road transit">
              {t.estimatedDistanceKm != null ? `${t.estimatedDistanceKm} km (~${Math.round(t.estimatedDurationMinutes ?? 0)} mins)` : '—'}
            </Fact>
            <Fact label="Request notes">{t.notes ?? '—'}</Fact>
            {t.rejectionReason && <Fact label="Rejection reason">{t.rejectionReason}</Fact>}
          </div>
        </Panel>
      </div>

      {canPropose && (
        <>
          <RedistributionAgentPanel transfer={t} />

          <Panel
            title="Candidate source facilities"
            description="Ranked by score: 60 for how much of the request the surplus covers, 40 for proximity. Surplus = on hand − reserved − minimum."
            icon="chart"
            flush
          >
            {candidates.isLoading && <div className="panel__body">Ranking candidates…</div>}
            {candidates.isError && (
              <div className="panel__body">
                <ErrorState title="Unable to rank candidates" message={(candidates.error as Error).message} />
              </div>
            )}
            {candidates.data && candidates.data.length === 0 && (
              <div className="panel__body">
                <EmptyState
                  label="No facility can spare this medicine"
                  hint="Every other facility is at or below its minimum stock. Consider procurement instead."
                  icon={<Icon name="warning" size={20} />}
                />
              </div>
            )}
            {candidates.data && candidates.data.length > 0 && (
              <div className="table-wrap">
                <DataTable
                  caption="Candidate source facilities"
                  columns={candidateColumns}
                  rows={candidates.data.map((c) => ({ ...c, id: c.facilityId }))}
                />
              </div>
            )}
          </Panel>
        </>
      )}

      {t.sourceFacilityId && (
        <Panel title="Transit route" description="Source in green, destination in red" icon="trend">
          {route.data ? <RouteMap route={route.data} /> : <span className="cell-secondary">Loading route…</span>}
        </Panel>
      )}

      <Panel title="Workflow & management decision" icon="shield">
        <div className="stack" style={{ gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {[
              { title: 'Shortage & context', done: true, note: 'Destination need recorded' },
              { title: 'Source proposal', done: !!t.sourceFacilityId, note: 'Agent recommends, manager proposes' },
              { title: 'Deterministic rules', done: ['Reserved', 'InTransit', 'Delivered'].includes(t.status), note: 'Minimum stock & expiry checked at reservation' },
              { title: 'Manager approval', done: ['Approved', 'Reserved', 'InTransit', 'Delivered'].includes(t.status), note: 'Human sign-off required' },
            ].map((step) => (
              <div key={step.title} className="panel" style={{ padding: 12 }}>
                <div className="cell-primary">
                  {step.done ? '✓ ' : '○ '}
                  {step.title}
                </div>
                <div className="cell-secondary">{step.note}</div>
              </div>
            ))}
          </div>

          {(next.includes('Rejected') || next.includes('Cancelled')) && (
            <label className="field" style={{ display: 'grid' }}>
              Reason (required to reject, optional otherwise)
              <input value={reason} aria-label="Decision reason" onChange={(e) => setReason(e.target.value)} placeholder="e.g. Source stock needed locally" />
            </label>
          )}

          <div className="row-actions" style={{ flexWrap: 'wrap' }}>
            {next.includes('Requested') && (
              <button type="button" className="button button--primary" disabled={busy} onClick={() => perform(() => transferApi.submit(t.id))}>
                Submit request
              </button>
            )}
            {isManager && next.includes('Approved') && t.sourceFacilityId && (
              <button type="button" className="button button--primary" disabled={busy} onClick={() => perform(() => transferApi.approve(t.id, reason || undefined))}>
                Approve plan
              </button>
            )}
            {isManager && next.includes('Rejected') && (
              <button type="button" className="button--destructive" disabled={busy || !reason.trim()} onClick={() => perform(() => transferApi.reject(t.id, reason))}>
                Reject plan
              </button>
            )}
            {isManager && next.includes('Reserved') && (
              <button type="button" className="button button--primary" disabled={busy} onClick={() => perform(() => transferApi.reserve(t.id))}>
                Reserve stock at source
              </button>
            )}
            {next.includes('InTransit') && (
              <button type="button" className="button button--primary" disabled={busy} onClick={() => perform(() => transferApi.dispatch(t.id))}>
                Confirm pickup (dispatch)
              </button>
            )}
            {next.includes('Delivered') && (
              <button type="button" className="button button--primary" disabled={busy} onClick={() => perform(() => transferApi.deliver(t.id))}>
                Confirm delivery
              </button>
            )}
            {['Draft', 'Requested'].includes(t.status) && <Link to={`/redistribution/transfers/${t.id}/edit`}>Edit request</Link>}
            {isManager && next.includes('Cancelled') && (
              <button type="button" className="button--destructive" disabled={busy} onClick={() => perform(() => transferApi.cancel(t.id, reason || undefined))}>
                Cancel transfer
              </button>
            )}
          </div>

          {t.status === 'Proposed' && !isManager && <p className="cell-secondary">Waiting for a facility manager to approve or reject this plan.</p>}
          {!t.sourceFacilityId && next.includes('Approved') && isManager && (
            <p className="cell-secondary">Propose a source facility from the candidates before approving.</p>
          )}

          {actionError && <ErrorState title="That action was refused" message={actionError} />}
        </div>
      </Panel>

      <Panel title="Status audit log" description="Every transition, who made it and why. Never edited." icon="clock" flush>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {t.history
            .slice()
            .reverse()
            .map((h, index) => (
              <li key={index} className="panel__body" style={{ borderTop: index ? '1px solid var(--border, #e2e8f0)' : 'none' }}>
                <div className="cell-primary">
                  {h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : 'Created → '}
                  <strong>{statusLabel(h.toStatus)}</strong>
                </div>
                <div className="cell-secondary">
                  {h.reason ?? '—'} · {h.changedBy ?? 'system'} · {new Date(h.changedAtUtc).toLocaleString()}
                </div>
              </li>
            ))}
        </ol>
      </Panel>
    </section>
  );
}

export default TransferDetail;
