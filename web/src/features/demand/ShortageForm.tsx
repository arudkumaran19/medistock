/**
 * Shortage create and edit form.
 * Sathurstiga S. (IT24103156).
 *
 * React is the management application, so raising, correcting and resolving alerts
 * belongs here rather than in the Flutter field app.
 *
 * The form only ever collects observed facts - stock on hand, consumption rate, lead
 * time. Days of cover, the projected stockout date and the risk level are derived by
 * the backend and are deliberately not editable: letting a manager type "6 days" while
 * stock says otherwise would make the alert unreproducible.
 *
 * Stock on hand is pre-filled from the Inventory balance (on hand - reserved) once a
 * facility and medicine are chosen, and stays editable for a physical count. Raising
 * an alert that is already active updates it instead of creating a duplicate.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { toErrorMessage } from './errors';
import { SHORTAGE_STATUSES, type ShortageStatus } from '@/types/demand';
import { DemandChain } from './DemandChain';
import { EXISTING_ALERT_UPDATED_NOTICE, formatNumber } from './format';
import { useCreateShortage, useCurrentStock, useShortage, useUpdateShortage } from './hooks';
import { isGuid, useFacilities, useMedicines } from './referenceApi';

export function ShortageForm({ shortageId }: { shortageId?: string }) {
  const params = useParams<{ id: string }>();
  const id = shortageId ?? params.id;
  const isEdit = Boolean(id);

  const navigate = useNavigate();
  const createShortage = useCreateShortage();
  const updateShortage = useUpdateShortage();
  const { data: existing, isLoading } = useShortage(isEdit ? id : undefined);
  const { data: medicines, isLoading: medicinesLoading } = useMedicines();
  const { data: facilities, isLoading: facilitiesLoading } = useFacilities();

  // Empty by default: the facility and medicine must be chosen from the real
  // Inventory reference data, not guessed.
  const [facilityId, setFacilityId] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [averageDaily, setAverageDaily] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [status, setStatus] = useState<ShortageStatus>('OPEN');
  const [formError, setFormError] = useState<string | null>(null);
  // Once the user types a stock figure, an Inventory pre-fill must not overwrite it.
  const [stockEdited, setStockEdited] = useState(false);

  const { data: inventoryStock, isFetching: stockLoading } = useCurrentStock(
    facilityId,
    medicineId,
    !isEdit && isGuid(facilityId) && isGuid(medicineId),
  );

  useEffect(() => {
    if (!isEdit && !stockEdited && inventoryStock) {
      setCurrentStock(String(inventoryStock.availableQuantity));
    }
  }, [isEdit, stockEdited, inventoryStock, facilityId, medicineId]);

  function selectTarget(update: () => void) {
    update();
    // A new facility or medicine means a new Inventory figure.
    setStockEdited(false);
    setCurrentStock('');
  }

  // Populate from the stored alert once it loads.
  useEffect(() => {
    if (existing) {
      setFacilityId(existing.facilityId);
      setMedicineId(existing.medicineId);
      setCurrentStock(String(existing.currentStock));
      setAverageDaily(String(existing.averageDailyConsumption));
      setLeadTimeDays(String(existing.leadTimeDays));
      setStatus(existing.status as ShortageStatus);
    }
  }, [existing]);

  const pending = createShortage.isPending || updateShortage.isPending;

  function validate(): string | null {
    // Both are identifiers on the wire. Checking the shape here means a bad value
    // is reported in place instead of costing a round trip and coming back as a
    // bare "HTTP 400" the user cannot act on.
    if (!facilityId.trim()) return 'Select a facility.';
    if (!isGuid(facilityId)) return 'Select a facility from the list.';
    if (!medicineId.trim()) return 'Select a medicine.';
    if (!isGuid(medicineId)) return 'Select a medicine from the list.';

    const stock = Number(currentStock);
    if (currentStock === '' || Number.isNaN(stock)) return 'Enter the stock on hand.';
    if (stock < 0) return 'Stock on hand cannot be negative.';

    if (averageDaily !== '') {
      const rate = Number(averageDaily);
      if (Number.isNaN(rate) || rate < 0) return 'Average per day cannot be negative.';
    }

    if (leadTimeDays !== '') {
      const lead = Number(leadTimeDays);
      if (Number.isNaN(lead) || lead < 0) return 'Lead time cannot be negative.';
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const problem = validate();

    if (problem) {
      setFormError(problem);
      return;
    }

    setFormError(null);

    try {
      if (isEdit && id) {
        await updateShortage.mutateAsync({
          id,
          request: {
            status,
            currentStock: Number(currentStock),
            leadTimeDays: leadTimeDays === '' ? undefined : Number(leadTimeDays),
          },
        });
        navigate(`/demand/shortages/${id}`);
      } else {
        const created = await createShortage.mutateAsync({
          facilityId,
          medicineId,
          currentStock: Number(currentStock),
          averageDailyConsumption: averageDaily === '' ? undefined : Number(averageDaily),
          leadTimeDays: leadTimeDays === '' ? undefined : Number(leadTimeDays),
        });
        navigate(`/demand/shortages/${created.id}`, {
          state: created.existingAlertUpdated ? { notice: EXISTING_ALERT_UPDATED_NOTICE } : undefined,
        });
      }
    } catch (cause) {
      setFormError(toErrorMessage(cause));
    }
  }

  if (isEdit && isLoading) {
    return <LoadingState label="Loading shortage alert…" />;
  }

  // Live calculation for preview
  const numStock = currentStock !== '' ? Number(currentStock) : null;
  const numDaily = averageDaily !== '' ? Number(averageDaily) : null;
  const numLead = leadTimeDays !== '' ? Number(leadTimeDays) : null;

  const isDormant = numDaily !== null && !Number.isNaN(numDaily) && numDaily === 0;

  const previewDaysCover =
    numStock !== null && !Number.isNaN(numStock) && numDaily !== null && !Number.isNaN(numDaily) && numDaily > 0
      ? numStock / numDaily
      : null;

  const previewStockoutDate =
    previewDaysCover !== null
      ? new Date(Date.now() + previewDaysCover * 86400000).toISOString().split('T')[0]
      : null;

  const previewRiskLevel: 'HIGH' | 'MEDIUM' | null =
    numStock !== null && !Number.isNaN(numStock) && numDaily !== null && !Number.isNaN(numDaily)
      ? isDormant
        ? 'MEDIUM'
        : previewDaysCover !== null
          ? numLead !== null && !Number.isNaN(numLead) && numLead > 0
            ? previewDaysCover <= numLead
              ? 'HIGH'
              : 'MEDIUM'
            : previewDaysCover <= 7
              ? 'HIGH'
              : 'MEDIUM'
          : null
      : null;

  const previewRequiresTransfer =
    previewDaysCover !== null && numLead !== null && !Number.isNaN(numLead) && numLead > 0
      ? previewDaysCover <= numLead
      : false;

  const leadTimeDeficit =
    previewDaysCover !== null && numLead !== null && !Number.isNaN(numLead)
      ? Math.round((numLead - previewDaysCover) * 10) / 10
      : null;

  return (
    <section aria-labelledby="shortage-form-heading" className="demand-vertical stack" data-theme="light">
      <header className="page-header">
        <h2 id="shortage-form-heading">{isEdit ? 'Edit shortage alert' : 'Raise shortage alert'}</h2>
        <p className="page-header__lead">
          {isEdit
            ? 'Correcting stock or lead time re-runs the calculation.'
            : 'Record an observed shortage. The backend derives the risk.'}
        </p>
        <DemandChain active="alert" />
      </header>

      <div className="split">
        {/* Left Column: Form & Clinical Inputs */}
        <div className="card">
          <div className="card__header">
            <div>
              <span className="card__title">{isEdit ? 'Correct Alert Parameters' : 'Clinical Inputs & Observed Figures'}</span>
              <p className="card__hint" style={{ marginTop: 2 }}>
                Risk is calculated deterministically by the system, never typed manually.
              </p>
            </div>
          </div>

          <div className="card__body">
            <form onSubmit={handleSubmit} aria-label="Shortage alert" noValidate>
              <div className="form-grid">
                <label className="field">
                  Facility
                  <select
                    aria-label="Facility"
                    value={facilityId}
                    disabled={isEdit || facilitiesLoading}
                    onChange={(event) => selectTarget(() => setFacilityId(event.target.value))}
                  >
                    <option value="">
                      {facilitiesLoading ? 'Loading facilities…' : 'Select a facility'}
                    </option>
                    {(facilities ?? []).map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                    {facilityId && !(facilities ?? []).some((f) => f.id === facilityId) && (
                      <option value={facilityId}>{facilityId}</option>
                    )}
                  </select>
                </label>

                <label className="field">
                  Medicine
                  <select
                    aria-label="Medicine"
                    value={medicineId}
                    disabled={isEdit || medicinesLoading}
                    onChange={(event) => selectTarget(() => setMedicineId(event.target.value))}
                  >
                    <option value="">
                      {medicinesLoading ? 'Loading medicines…' : 'Select a medicine'}
                    </option>
                    {(medicines ?? []).map((medicine) => (
                      <option key={medicine.id} value={medicine.id}>
                        {medicine.name}
                      </option>
                    ))}
                    {medicineId && !(medicines ?? []).some((m) => m.id === medicineId) && (
                      <option value={medicineId}>{medicineId}</option>
                    )}
                  </select>
                </label>

                {/* Inventory Balances Badge Strip */}
                {!isEdit && facilityId && medicineId && inventoryStock && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '10px 14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ color: '#64748b' }}>Inventory Balances:</span>
                    <strong style={{ color: '#0f172a' }}>{formatNumber(inventoryStock.quantityOnHand)} On Hand</strong>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span style={{ color: '#e11d48' }}>{formatNumber(inventoryStock.quantityReserved)} Reserved</span>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <strong style={{ color: '#059669' }}>{formatNumber(inventoryStock.availableQuantity)} Available</strong>
                  </div>
                )}

                <label className="field">
                  Stock on hand
                  <input
                    type="number"
                    aria-label="Stock on hand"
                    value={currentStock}
                    min={0}
                    onChange={(event) => {
                      setStockEdited(true);
                      setCurrentStock(event.target.value);
                    }}
                  />
                  {!isEdit && facilityId && medicineId && (
                    <span className="card__hint" data-testid="stock-source">
                      {stockLoading
                        ? 'Reading Inventory…'
                        : inventoryStock
                          ? `From Inventory: ${formatNumber(inventoryStock.quantityOnHand)} on hand − ` +
                            `${formatNumber(inventoryStock.quantityReserved)} reserved. You can change it.`
                          : inventoryStock === null
                            ? 'Inventory has no balance for this medicine here. Enter the stock on hand.'
                            : null}
                    </span>
                  )}
                </label>

                <label className="field">
                  Average per day
                  <input
                    type="number"
                    aria-label="Average per day"
                    value={averageDaily}
                    min={0}
                    disabled={isEdit}
                    placeholder="Derived from history"
                    onChange={(event) => setAverageDaily(event.target.value)}
                  />
                  <span className="card__hint">Units consumed per 24-hour cycle</span>
                </label>

                <label className="field">
                  Lead time (days)
                  <input
                    type="number"
                    aria-label="Lead time in days"
                    value={leadTimeDays}
                    min={0}
                    placeholder="From reorder rule"
                    onChange={(event) => setLeadTimeDays(event.target.value)}
                  />
                  <span className="card__hint">Supplier turnaround window</span>
                </label>

                {isEdit && (
                  <label className="field">
                    Status
                    <select
                      value={status}
                      aria-label="Status"
                      onChange={(event) => setStatus(event.target.value as ShortageStatus)}
                    >
                      {SHORTAGE_STATUSES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="form-actions" style={{ marginTop: 'var(--space-5)' }}>
                <button type="submit" disabled={pending} className="button--primary">
                  {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Raise alert'}
                </button>
                <button type="button" onClick={() => navigate('/demand/shortages')} disabled={pending}>
                  Cancel
                </button>
              </div>
            </form>

            {formError && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <ErrorState message={formError} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Clinical Risk Assessment Preview */}
        <div className="stack">
          <div className="card">
            <div className="card__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e2e8f0' }}>
              <span className="card__title">Real-Time Risk Preview</span>
              {previewRiskLevel ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: previewRiskLevel === 'HIGH' ? '#ffe4e6' : '#fef3c7',
                    color: previewRiskLevel === 'HIGH' ? '#be123c' : '#92400e',
                    border: `1px solid ${previewRiskLevel === 'HIGH' ? '#fecdd3' : '#fde68a'}`,
                  }}
                >
                  {previewRiskLevel} Risk
                </span>
              ) : (
                <span className="card__hint">Awaiting input</span>
              )}
            </div>

            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {previewDaysCover !== null ? (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Days of Cover
                      </div>
                      <div
                        style={{
                          fontSize: '1.4rem',
                          fontWeight: 700,
                          color: previewDaysCover <= (numLead ?? 7) ? '#be123c' : '#0f172a',
                          marginTop: 4,
                        }}
                      >
                        {previewDaysCover < 1 ? previewDaysCover.toFixed(1) : Math.floor(previewDaysCover)} days
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                        {numStock ?? 0} units ÷ {numDaily ?? 1}/day
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Projected Stockout
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: 6 }}>
                        {previewStockoutDate ?? '—'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                        Depletion timeline
                      </div>
                    </div>
                  </div>

                  {numLead !== null && !Number.isNaN(numLead) && numLead > 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: previewRequiresTransfer ? '#fff1f2' : '#f0fdf4',
                        border: `1px solid ${previewRequiresTransfer ? '#fecdd3' : '#bbf7d0'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: previewRequiresTransfer ? '#9f1239' : '#166534' }}>
                          {previewRequiresTransfer ? 'Supply Deficit Detected' : 'Cover Exceeds Lead Time'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: previewRequiresTransfer ? '#e11d48' : '#16a34a',
                            color: '#ffffff',
                          }}
                        >
                          {previewRequiresTransfer ? 'Transfer Required' : 'Buffer Intact'}
                        </span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: previewRequiresTransfer ? '#be123c' : '#15803d' }}>
                        {previewRequiresTransfer
                          ? `Stock will be exhausted ${Math.abs(leadTimeDeficit ?? 0)} days before supplier replenishment can arrive (${numLead} days lead time).`
                          : `Current stock covers the full ${numLead} day lead time with surplus buffer.`}
                      </p>
                    </div>
                  )}
                </>
              ) : isDormant && numStock !== null ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Days of Cover
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706', marginTop: 4 }}>
                        Dormant
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                        0 units consumed / day
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Projected Stockout
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                        No Runout
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                        Stock not depleting
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      color: '#92400e',
                      lineHeight: 1.4,
                    }}
                  >
                    Zero units consumed per 24 hours. The alert will be recorded and tracked under <strong>MEDIUM</strong> risk without raising false emergency transfer requisitions.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                    Parameters needed to derive risk
                  </p>
                  <ul
                    style={{
                      margin: '10px 0 0',
                      padding: '0 0 0 20px',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      color: '#64748b',
                      lineHeight: 1.6,
                    }}
                  >
                    {!facilityId && <li>Select an operational facility</li>}
                    {!medicineId && <li>Select a medicine catalogue item</li>}
                    {currentStock === '' && <li>Enter or verify stock on hand</li>}
                    {averageDaily === '' && <li>Enter daily consumption rate</li>}
                    {leadTimeDays === '' && <li>Specify supplier lead time</li>}
                  </ul>
                </div>
              )}

              {/* Clinical Protocol & Audit Notice */}
              <div
                style={{
                  padding: '12px 14px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  color: '#475569',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: '#1e293b' }}>Clinical Governance:</strong> Raising this alert records a
                tamper-evident audit event (<code>SHORTAGE_ALERT_RAISED</code>). If an active alert already exists for
                this facility and medicine, it will be updated rather than duplicated. Shortages cannot be resolved without
                verified stock coverage or delivery confirmation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ShortageForm;
