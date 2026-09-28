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
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { toErrorMessage } from './errors';
import { SHORTAGE_STATUSES, type ShortageStatus } from '@/types/demand';
import { DemandChain } from './DemandChain';
import { useCreateShortage, useShortage, useUpdateShortage } from './hooks';
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
        navigate(`/demand/shortages/${created.id}`);
      }
    } catch (cause) {
      setFormError(toErrorMessage(cause));
    }
  }

  if (isEdit && isLoading) {
    return <LoadingState label="Loading shortage alert…" />;
  }

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

      <div className="card">
        <div className="card__header">
          <span className="card__title">Observed figures</span>
          <span className="card__hint">Risk is calculated, never entered</span>
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
                  onChange={(event) => setFacilityId(event.target.value)}
                >
                  <option value="">
                    {facilitiesLoading ? 'Loading facilities…' : 'Select a facility'}
                  </option>
                  {(facilities ?? []).map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                  {/* An alert being edited may reference a facility the list no
                      longer returns; keep it selectable rather than silently blank. */}
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
                  onChange={(event) => setMedicineId(event.target.value)}
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

              <label className="field">
                Stock on hand
                <input
                  type="number"
                  aria-label="Stock on hand"
                  value={currentStock}
                  min={0}
                  onChange={(event) => setCurrentStock(event.target.value)}
                />
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

            <div className="form-actions">
              <button type="submit" disabled={pending}>
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
    </section>
  );
}

export default ShortageForm;
