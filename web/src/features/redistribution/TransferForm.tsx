/**
 * Create or edit a transfer request. Redistribution vertical (Member 3).
 * The source is not chosen here: candidates are ranked after the request exists.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ErrorState } from '@/components/ErrorState';
import { PageHeader, Panel } from '@/features/demand/components/Panel';
import { useFacilities, useMedicines } from '@/features/demand/referenceApi';

import { TRANSFER_PRIORITIES, type TransferPriority, transferApi, useTransfer, useTransferMutation } from './api';

export function TransferForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const medicines = useMedicines();
  const facilities = useFacilities();
  const existing = useTransfer(id ?? '');

  const [medicineId, setMedicineId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [priority, setPriority] = useState<TransferPriority>('Medium');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (existing.data) {
      setMedicineId(existing.data.medicineId);
      setDestinationId(existing.data.destinationFacilityId);
      setQuantity(String(existing.data.quantity));
      setPriority(existing.data.priority);
      setNotes(existing.data.notes ?? '');
    }
  }, [existing.data]);

  const create = useTransferMutation(transferApi.create);
  const update = useTransferMutation((input: { quantity: number; priority: TransferPriority; notes?: string }) =>
    transferApi.update(id!, input),
  );
  const pending = create.isPending || update.isPending;
  const mutationError = (create.error ?? update.error) as Error | null;

  async function handleSubmit(event: React.FormEvent, submit: boolean) {
    event.preventDefault();
    setFormError(null);

    const qty = Number(quantity);
    if (!isEdit && !medicineId) return setFormError('Select a medicine.');
    if (!isEdit && !destinationId) return setFormError('Select the facility that needs the stock.');
    if (!Number.isInteger(qty) || qty <= 0) return setFormError('Quantity must be a whole number greater than zero.');

    if (isEdit) {
      await update.mutateAsync({ quantity: qty, priority, notes: notes.trim() || undefined });
      navigate(`/redistribution/transfers/${id}`);
    } else {
      const created = await create.mutateAsync({
        medicineId,
        destinationFacilityId: destinationId,
        quantity: qty,
        priority,
        notes: notes.trim() || undefined,
        submit,
      });
      navigate(`/redistribution/transfers/${created.id}`);
    }
  }

  const activeMedicines = (medicines.data ?? []).filter((m) => m.isActive !== false);

  return (
    <section className="demand-vertical stack" data-theme="light" aria-labelledby="transfer-form-heading">
      <PageHeader
        title={isEdit ? `Edit ${existing.data?.transferNumber ?? 'transfer'}` : 'New transfer request'}
        subtitle={
          isEdit
            ? 'Quantity, priority and notes can change until a manager acts on the request.'
            : 'Ask for stock to be moved to a facility that is running short.'
        }
      >
        <h2 id="transfer-form-heading" className="visually-hidden">
          Transfer request form
        </h2>
      </PageHeader>

      <Panel title="Request details" icon="package">
        <form onSubmit={(event) => handleSubmit(event, true)} noValidate aria-label="Transfer request">
          <div className="toolbar" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field">
              Medicine
              <select value={medicineId} disabled={isEdit} aria-label="Medicine" onChange={(e) => setMedicineId(e.target.value)}>
                <option value="">Select a medicine</option>
                {activeMedicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Destination (facility in need)
              <select value={destinationId} disabled={isEdit} aria-label="Destination facility" onChange={(e) => setDestinationId(e.target.value)}>
                <option value="">Select a facility</option>
                {(facilities.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Quantity
              <input type="number" min={1} value={quantity} aria-label="Quantity" onChange={(e) => setQuantity(e.target.value)} />
            </label>

            <label className="field">
              Priority
              <select value={priority} aria-label="Priority" onChange={(e) => setPriority(e.target.value as TransferPriority)}>
                {TRANSFER_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field" style={{ marginTop: 'var(--space-4, 16px)', display: 'grid' }}>
            Notes
            <textarea rows={3} value={notes} maxLength={1000} aria-label="Notes" onChange={(e) => setNotes(e.target.value)} placeholder="Why the stock is needed" />
          </label>

          {(formError || mutationError) && (
            <div style={{ marginTop: 'var(--space-4, 16px)' }}>
              <ErrorState title="Check the request" message={formError ?? mutationError?.message ?? ''} />
            </div>
          )}

          <div className="row-actions" style={{ marginTop: 'var(--space-5, 20px)' }}>
            <button type="submit" className="button button--primary" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Submit request'}
            </button>
            {!isEdit && (
              <button type="button" className="button" disabled={pending} onClick={(e) => handleSubmit(e, false)}>
                Save as draft
              </button>
            )}
            <Link to={isEdit ? `/redistribution/transfers/${id}` : '/redistribution/transfers'}>Cancel</Link>
          </div>
        </form>
      </Panel>
    </section>
  );
}

export default TransferForm;
