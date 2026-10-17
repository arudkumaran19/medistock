/**
 * Shortage detail - the full derivation behind one alert.
 * Sathurstiga S. (IT24103156).
 *
 * Shows every input the deterministic calculation used, so a manager can see why the
 * alert was raised rather than being handed a bare conclusion. The reasoning strip
 * lays the arithmetic out as an equation, because "6 < 10" is the whole argument.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { toErrorMessage } from './errors';
import { AgentPanel } from './AgentPanel';
import { DemandChain } from './DemandChain';
import { useReferenceData } from './referenceApi';
import { ForecastTimeline } from './components/ForecastTimeline';
import { Icon } from './components/Icon';
import { PageHeader, Panel } from './components/Panel';
import { SeverityBadge, StatusChip } from './components/SeverityBadge';
import { SkeletonDetail, SkeletonRegion } from './components/Skeleton';
import { explainRisk, formatDate, formatDaysRemaining, formatNumber } from './format';
import { facilityName, medicineName } from './reference';
import {
  useDeleteShortage,
  useDismissShortage,
  useLinkShortagePurchaseOrder,
  useLinkShortageTransfer,
  useResolveShortage,
  useShortage,
} from './hooks';

export function ShortageDetail({ shortageId }: { shortageId?: string }) {
  // Medicine and facility names come from the Inventory API.
  useReferenceData();

  const params = useParams<{ id: string }>();
  const id = shortageId ?? params.id;
  const navigate = useNavigate();
  // Set by the Raise alert form when it refreshed an existing alert.
  const notice = (useLocation().state as { notice?: string; newlyCreated?: boolean } | null)?.notice;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<string>('STOCK_AUDIT');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifiedStock, setVerifiedStock] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Dismiss Modal state
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [dismissError, setDismissError] = useState<string | null>(null);

  // Link transfer / PO modal states
  const [linkTransferOpen, setLinkTransferOpen] = useState(false);
  const [transferIdInput, setTransferIdInput] = useState('');
  const [linkTransferError, setLinkTransferError] = useState<string | null>(null);

  const [linkPOOpen, setLinkPOOpen] = useState(false);
  const [poIdInput, setPoIdInput] = useState('');
  const [linkPOError, setLinkPOError] = useState<string | null>(null);

  const resolveShortage = useResolveShortage();
  const dismissShortage = useDismissShortage();
  const deleteShortage = useDeleteShortage();
  const linkTransfer = useLinkShortageTransfer();
  const linkPO = useLinkShortagePurchaseOrder();

  const { data: alert, isLoading, isError, error, refetch } = useShortage(id);

  if (!id) {
    return <ErrorState title="Nothing to show" message="No shortage alert was specified." />;
  }

  if (isLoading) {
    return (
      <SkeletonRegion label="Loading shortage alert…">
        <SkeletonDetail />
      </SkeletonRegion>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load this shortage alert"
        message={toErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );
  }

  if (!alert) {
    return <ErrorState title="Not found" message="Shortage alert not found." />;
  }

  const requiredCoverageStock = Math.ceil(alert.leadTimeDays * alert.averageDailyConsumption);
  const stockCoversRequirement = alert.currentStock >= requiredCoverageStock;

  async function handleConfirmResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationNotes.trim()) {
      setResolveError('Clinical justification / verification rationale is required.');
      return;
    }
    setResolveError(null);

    try {
      await resolveShortage.mutateAsync({
        id: alert!.id,
        request: {
          verificationMethod,
          verificationNotes: verificationNotes.trim(),
          verifiedCurrentStock: verifiedStock !== '' ? Number(verifiedStock) : undefined,
          transferId: alert?.transferId ?? undefined,
          purchaseOrderId: alert?.purchaseOrderId ?? undefined,
        },
      });
      setResolveModalOpen(false);
    } catch (err) {
      setResolveError(toErrorMessage(err));
    }
  }

  async function handleConfirmDismiss(e: React.FormEvent) {
    e.preventDefault();
    if (!dismissReason.trim()) {
      setDismissError('A dismissal reason is required.');
      return;
    }
    setDismissError(null);

    try {
      await dismissShortage.mutateAsync({
        id: alert!.id,
        request: { reason: dismissReason.trim() },
      });
      setDismissModalOpen(false);
    } catch (err) {
      setDismissError(toErrorMessage(err));
    }
  }

  async function handleLinkTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferIdInput.trim()) {
      setLinkTransferError('Enter a valid Transfer ID.');
      return;
    }
    setLinkTransferError(null);
    try {
      await linkTransfer.mutateAsync({ id: alert!.id, transferId: transferIdInput.trim() });
      setLinkTransferOpen(false);
      setTransferIdInput('');
    } catch (err) {
      setLinkTransferError(toErrorMessage(err));
    }
  }

  async function handleLinkPO(e: React.FormEvent) {
    e.preventDefault();
    if (!poIdInput.trim()) {
      setLinkPOError('Enter a valid Purchase Order ID.');
      return;
    }
    setLinkPOError(null);
    try {
      await linkPO.mutateAsync({ id: alert!.id, purchaseOrderId: poIdInput.trim() });
      setLinkPOOpen(false);
      setPoIdInput('');
    } catch (err) {
      setLinkPOError(toErrorMessage(err));
    }
  }

  return (
    <section aria-labelledby="shortage-detail-heading" className="demand-vertical stack" data-theme="light">
      <PageHeader
        title={medicineName(alert.medicineId)}
        subtitle={`${facilityName(alert.facilityId)} · raised ${formatDate(alert.generatedAt)}`}
        actions={
          <span className="row-actions">
            <Link to={`/demand/shortages/${alert.id}/edit`}>
              <button type="button">Edit</button>
            </Link>
            {alert.status !== 'RESOLVED' && alert.status !== 'DISMISSED' && (
              <>
                <button
                  type="button"
                  className="button--primary"
                  disabled={resolveShortage.isPending}
                  onClick={() => {
                    setVerifiedStock(String(alert.currentStock));
                    setResolveModalOpen(true);
                  }}
                >
                  {resolveShortage.isPending ? 'Resolving…' : 'Resolve'}
                </button>
                <button
                  type="button"
                  disabled={dismissShortage.isPending}
                  onClick={() => {
                    setDismissReason('');
                    setDismissError(null);
                    setDismissModalOpen(true);
                  }}
                >
                  Dismiss
                </button>
              </>
            )}
            <button
              type="button"
              className="button--destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          </span>
        }
      >
        <h2 id="shortage-detail-heading" className="visually-hidden">
          Shortage alert
        </h2>

        <p className="row-actions" style={{ marginTop: 'var(--space-3)' }}>
          <SeverityBadge level={alert.riskLevel} />
          <StatusChip status={alert.status} />
          {alert.resolutionVerified && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 9999,
                fontSize: '0.75rem',
                fontWeight: 600,
                background: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
              }}
            >
              <Icon name="check" size={13} /> Verified Resolution
            </span>
          )}
        </p>

        {notice && (
          <p className="card__hint" role="status" data-testid="alert-notice">
            {notice}
          </p>
        )}

        <p className="page-head__subtitle" data-testid="risk-explanation">
          {explainRisk(alert)}
        </p>

        {alert.resolutionReason && (
          <p className="card__hint" data-testid="resolution-reason">
            Resolved automatically: {alert.resolutionReason}
            {alert.resolvedAt ? ` (${formatDate(alert.resolvedAt)})` : ''}.
          </p>
        )}

        <p className="card__hint" style={{ marginTop: 'var(--space-3)' }}>
          <Link to="/demand/shortages">← Back to shortage dashboard</Link>
        </p>

        <DemandChain active="alert" />
      </PageHeader>

      {/* The argument, as arithmetic. */}
      <div className="reasoning">
        <span className="reasoning__term">
          <span className="reasoning__value">{formatNumber(alert.currentStock)}</span>
          <span className="reasoning__label">units in stock</span>
        </span>
        <span className="reasoning__op" aria-hidden="true">
          ÷
        </span>
        <span className="reasoning__term">
          <span className="reasoning__value">{formatNumber(alert.averageDailyConsumption)}</span>
          <span className="reasoning__label">used per day</span>
        </span>
        <span className="reasoning__op" aria-hidden="true">
          =
        </span>
        <span className="reasoning__term">
          <span className="reasoning__value">{formatDaysRemaining(alert.daysRemaining)}</span>
          <span className="reasoning__label">of cover</span>
        </span>
        <span className="reasoning__op" aria-hidden="true">
          vs
        </span>
        <span className="reasoning__term">
          <span className="reasoning__value">{alert.leadTimeDays} days</span>
          <span className="reasoning__label">supplier lead time</span>
        </span>
        <span className="reasoning__verdict">
          <SeverityBadge level={alert.riskLevel} />
        </span>
      </div>

      <div className="split">
        <div className="stack">
          <Panel
            title="Risk summary"
            description="Every figure the calculation used"
            icon="shield"
          >
            <dl className="derivation" data-testid="risk-summary">
              <dt>Stock on hand</dt>
              <dd>{formatNumber(alert.currentStock)}</dd>

              <dt>Average daily consumption</dt>
              <dd>{formatNumber(alert.averageDailyConsumption)} per day</dd>

              <dt>Days of cover</dt>
              <dd data-testid="days-remaining">{formatDaysRemaining(alert.daysRemaining)}</dd>

              <dt>Projected stockout</dt>
              <dd>{formatDate(alert.projectedStockoutDate)}</dd>

              <dt>Lead time</dt>
              <dd>{alert.leadTimeDays} days</dd>

              <dt>Requires transfer</dt>
              <dd>{alert.requiresTransfer ? 'Yes' : 'No'}</dd>

              <dt>Status</dt>
              <dd>{alert.status}</dd>

              <dt>Generated</dt>
              <dd>{formatDate(alert.generatedAt)}</dd>

              {alert.updatedAt && (
                <>
                  <dt>Last updated</dt>
                  <dd>{formatDate(alert.updatedAt)}</dd>
                </>
              )}

              {alert.resolvedAt && (
                <>
                  <dt>Resolved</dt>
                  <dd>{formatDate(alert.resolvedAt)}</dd>
                </>
              )}
            </dl>
          </Panel>

          {/* Verified Resolution Audit Block */}
          {alert.status === 'RESOLVED' && (
            <Panel title="Verification & Closure Record" description="Clinical audit trail for this resolution" icon="check">
              <dl className="derivation">
                <dt>Verification Status</dt>
                <dd style={{ color: '#059669', fontWeight: 600 }}>
                  {alert.resolutionVerified ? 'Formally Verified' : 'Standard Closure'}
                </dd>

                <dt>Verification Method</dt>
                <dd>{alert.verificationMethod ?? alert.resolutionReason ?? 'Stock Level Recovery'}</dd>

                <dt>Verified By</dt>
                <dd>{alert.verifiedBy ?? 'System Recalculation Engine'}</dd>

                <dt>Resolution Notes</dt>
                <dd>{alert.verificationNotes ?? alert.resolutionReason ?? 'Stock replenished above lead time threshold.'}</dd>

                {alert.transferId && (
                  <>
                    <dt>Linked Transfer</dt>
                    <dd>
                      <Link to={`/redistribution/transfers/${alert.transferId}`} style={{ color: '#0d9488' }}>
                        {alert.transferId}
                      </Link>
                    </dd>
                  </>
                )}

                {alert.purchaseOrderId && (
                  <>
                    <dt>Linked Purchase Order</dt>
                    <dd>
                      <Link to="/procurement/orders" style={{ color: '#0d9488' }}>
                        {alert.purchaseOrderId}
                      </Link>
                    </dd>
                  </>
                )}
              </dl>
            </Panel>
          )}

          {/* Interventions & Supply Chain Actions */}
          <Panel title="Shortage Interventions" description="Active supply chain links and remediation" icon="activity">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Transfer section */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                    Inter-Hospital Transfer
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {alert.transferId ? (
                      <span>Linked: <code>{alert.transferId}</code></span>
                    ) : (
                      'No transfer linked to this shortage alert'
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {alert.transferId ? (
                    <Link to={`/redistribution/transfers/${alert.transferId}`}>
                      <button type="button" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                        View Transfer
                      </button>
                    </Link>
                  ) : alert.status !== 'RESOLVED' ? (
                    <>
                      <Link to={`/redistribution/transfers/new?facilityId=${alert.facilityId}&medicineId=${alert.medicineId}`}>
                        <button type="button" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                          Request Transfer
                        </button>
                      </Link>
                      <button
                        type="button"
                        style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        onClick={() => setLinkTransferOpen(true)}
                      >
                        Link Existing
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Purchase Order section */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                    Procurement Purchase Order
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {alert.purchaseOrderId ? (
                      <span>Linked: <code>{alert.purchaseOrderId}</code></span>
                    ) : (
                      'No purchase order linked to this shortage alert'
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {alert.purchaseOrderId ? (
                    <Link to="/procurement/orders">
                      <button type="button" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                        View Orders
                      </button>
                    </Link>
                  ) : alert.status !== 'RESOLVED' ? (
                    <>
                      <Link to="/procurement/orders">
                        <button type="button" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                          Create PO
                        </button>
                      </Link>
                      <button
                        type="button"
                        style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        onClick={() => setLinkPOOpen(true)}
                      >
                        Link Existing
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>

          {/* Status History Audit Trail */}
          {alert.statusHistory && alert.statusHistory.length > 0 && (
            <Panel title="Status History Audit Trail" description="Immutable lifecycle state transitions" icon="clock">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {alert.statusHistory.map((item, index) => (
                  <div
                    key={item.id || index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderLeft: '3px solid #0d9488',
                      borderRadius: '0 8px 8px 0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                        {item.fromStatus} → {item.toStatus}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {formatDate(item.changedAt)}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      <strong>Actor:</strong> {item.changedBy}
                      {item.verificationMethod && <span> · <strong>Method:</strong> {item.verificationMethod}</span>}
                    </div>

                    {(item.reason || item.notes) && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                        {item.reason ? `${item.reason}: ` : ''}{item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel title="Timeline" description="The derivation in time order" icon="clock">
            <ForecastTimeline
              averageDailyConsumption={alert.averageDailyConsumption}
              currentStock={alert.currentStock}
              daysRemaining={alert.daysRemaining}
              leadTimeDays={alert.leadTimeDays}
              projectedStockout={formatDate(alert.projectedStockoutDate)}
            />
          </Panel>

          <Panel title="Provenance" description="Where these numbers came from" icon="activity">
            {alert.demandForecastId ? (
              <p data-testid="forecast-link">
                Derived from forecast <code>{alert.demandForecastId}</code>.
              </p>
            ) : (
              <p data-testid="forecast-link">
                Calculated from a consumption rate supplied with the request rather than from a
                stored forecast.
              </p>
            )}
            <p className="cell-secondary" style={{ marginTop: 'var(--space-3)' }}>
              <Icon name="shield" size={13} /> Every figure above is computed by the backend.
              Nothing on this page is estimated in the browser.
            </p>
          </Panel>
        </div>
      </div>

      <AgentPanel
        facilityId={alert.facilityId}
        medicineId={alert.medicineId}
        currentStock={alert.currentStock ?? undefined}
      />

      {/* Verified Resolution Modal */}
      {resolveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-dialog-title"
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
              padding: 28,
              maxWidth: 540,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 id="resolve-dialog-title" style={{ margin: '0 0 6px', fontSize: '1.25rem', color: '#0f172a' }}>
              Verify & Resolve Shortage Alert
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Shortages cannot be closed without verification evidence under hospital safety compliance rules.
            </p>

            <form onSubmit={handleConfirmResolve} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Stock Coverage Status Banner */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: stockCoversRequirement ? '#ecfdf5' : '#fffbeb',
                    border: `1px solid ${stockCoversRequirement ? '#a7f3d0' : '#fef3c7'}`,
                    fontSize: '0.85rem',
                    color: stockCoversRequirement ? '#065f46' : '#92400e',
                  }}
                >
                  <strong>Stock Coverage: </strong>
                  {stockCoversRequirement
                    ? `Current stock of ${alert.currentStock} units covers the required lead time buffer of ${requiredCoverageStock} units.`
                    : `Stock on hand (${alert.currentStock} units) is below the lead time threshold (${requiredCoverageStock} units). Clinical justification or delivered replenishment is required.`}
                </div>

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
                  Verification Rationale & Notes (Required for Audit Trail)
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
                  <div style={{ color: '#be123c', fontSize: '0.85rem', background: '#ffe4e6', padding: '8px 12px', borderRadius: 6 }}>
                    {resolveError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setResolveModalOpen(false);
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
                    {resolveShortage.isPending ? 'Verifying…' : 'Confirm Verified Resolution'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dismiss Shortage Modal */}
      {dismissModalOpen && (
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
              <strong>{medicineName(alert.medicineId)}</strong> as invalid, duplicate, or clinically mitigated.
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
                      setDismissModalOpen(false);
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

      {/* Link Transfer Modal */}
      {linkTransferOpen && (
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
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>
              Link Existing Transfer
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Associate an ongoing or completed Inter-Hospital Transfer with this shortage alert.
            </p>

            <form onSubmit={handleLinkTransfer}>
              <label className="field">
                Transfer ID (GUID)
                <input
                  type="text"
                  aria-label="Transfer ID"
                  placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                  value={transferIdInput}
                  onChange={(e) => setTransferIdInput(e.target.value)}
                />
              </label>

              {linkTransferError && (
                <div style={{ color: '#be123c', fontSize: '0.85rem', margin: '8px 0' }}>
                  {linkTransferError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    setLinkTransferOpen(false);
                    setLinkTransferError(null);
                  }}
                  disabled={linkTransfer.isPending}
                >
                  Cancel
                </button>
                <button type="submit" className="button--primary" disabled={linkTransfer.isPending}>
                  {linkTransfer.isPending ? 'Linking…' : 'Link Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Purchase Order Modal */}
      {linkPOOpen && (
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
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>
              Link Existing Purchase Order
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Associate an issued or received procurement Purchase Order with this shortage alert.
            </p>

            <form onSubmit={handleLinkPO}>
              <label className="field">
                Purchase Order ID (GUID)
                <input
                  type="text"
                  aria-label="Purchase Order ID"
                  placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                  value={poIdInput}
                  onChange={(e) => setPoIdInput(e.target.value)}
                />
              </label>

              {linkPOError && (
                <div style={{ color: '#be123c', fontSize: '0.85rem', margin: '8px 0' }}>
                  {linkPOError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    setLinkPOOpen(false);
                    setLinkPOError(null);
                  }}
                  disabled={linkPO.isPending}
                >
                  Cancel
                </button>
                <button type="submit" className="button--primary" disabled={linkPO.isPending}>
                  {linkPO.isPending ? 'Linking…' : 'Link Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this alert?"
          message={
            'Deleting removes the record that this shortage ever happened. ' +
            'If the shortage is over, resolve it instead so the history is kept.'
          }
          confirmLabel="Delete"
          destructive
          busy={deleteShortage.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteShortage.mutateAsync(alert.id);
            navigate('/demand/shortages');
          }}
        />
      )}
    </section>
  );
}

export default ShortageDetail;
