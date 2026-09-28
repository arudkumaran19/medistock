/**
 * Shortage detail - the full derivation behind one alert.
 * Sathurstiga S. (IT24103156).
 *
 * Shows every input the deterministic calculation used, so a manager can see why the
 * alert was raised rather than being handed a bare conclusion. The reasoning strip
 * lays the arithmetic out as an equation, because "6 < 10" is the whole argument.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import { toErrorMessage } from './errors';
import { AgentPanel } from './AgentPanel';
import { DemandChain } from './DemandChain';
import { ForecastTimeline } from './components/ForecastTimeline';
import { Icon } from './components/Icon';
import { PageHeader, Panel } from './components/Panel';
import { SeverityBadge, StatusChip } from './components/SeverityBadge';
import { SkeletonDetail, SkeletonRegion } from './components/Skeleton';
import { explainRisk, formatDate, formatDaysRemaining, formatNumber } from './format';
import { facilityName, medicineName } from './reference';
import { useDeleteShortage, useResolveShortage, useShortage } from './hooks';

export function ShortageDetail({ shortageId }: { shortageId?: string }) {
  const params = useParams<{ id: string }>();
  const id = shortageId ?? params.id;
  const navigate = useNavigate();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const resolveShortage = useResolveShortage();
  const deleteShortage = useDeleteShortage();

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

  return (
    <section aria-labelledby="shortage-detail-heading" className="stack">
      <PageHeader
        title={medicineName(alert.medicineId)}
        subtitle={`${facilityName(alert.facilityId)} · raised ${formatDate(alert.generatedAt)}`}
        actions={
          <span className="row-actions">
            <Link to={`/demand/shortages/${alert.id}/edit`}>
              <button type="button">Edit</button>
            </Link>
            {alert.status !== 'RESOLVED' && (
              <button
                type="button"
                disabled={resolveShortage.isPending}
                onClick={() => resolveShortage.mutate(alert.id)}
              >
                {resolveShortage.isPending ? 'Resolving…' : 'Resolve'}
              </button>
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
        </p>

        <p className="page-head__subtitle" data-testid="risk-explanation">
          {explainRisk(alert)}
        </p>

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
          </dl>
        </Panel>

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
