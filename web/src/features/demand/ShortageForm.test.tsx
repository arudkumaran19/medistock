/**
 * Raise alert form tests.
 * Sathurstiga S. (IT24103156).
 *
 * Stock on hand is pre-filled from the Inventory balance but stays editable, and
 * raising an alert that is already active is reported as an update, not a new alert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ShortageForm } from './ShortageForm';
import { EXISTING_ALERT_UPDATED_NOTICE } from './format';
import { renderWithProviders, shortageAlert } from './testUtils';

const FACILITY_ID = '11111111-1111-1111-1111-111111111111';
const MEDICINE_ID = '22222222-2222-2222-2222-222222222222';

vi.mock('@/services/demandApi', () => ({
  createShortage: vi.fn(),
  getCurrentStock: vi.fn(),
  getShortageById: vi.fn(),
  updateShortage: vi.fn(),
}));

vi.mock('./referenceApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./referenceApi')>();

  return {
    ...actual,
    useFacilities: () => ({
      data: [{ id: FACILITY_ID, code: 'CENTRAL', name: 'Central Facility' }],
      isLoading: false,
    }),
    useMedicines: () => ({
      data: [{ id: MEDICINE_ID, code: 'PARA-500', name: 'Paracetamol 500 mg' }],
      isLoading: false,
    }),
  };
});

const { createShortage, getCurrentStock } = await import('@/services/demandApi');
const mockCreateShortage = vi.mocked(createShortage);
const mockGetCurrentStock = vi.mocked(getCurrentStock);

/** Renders the form with a detail route that echoes any notice it was sent. */
function renderForm() {
  function DetailProbe() {
    const location = useLocation();
    const notice = (location.state as { notice?: string } | null)?.notice;

    return <p data-testid="landed">{`${location.pathname}|${notice ?? ''}`}</p>;
  }

  return renderWithProviders(
    <Routes>
      <Route path="/" element={<ShortageForm />} />
      <Route path="/demand/shortages/:id" element={<DetailProbe />} />
    </Routes>,
  );
}

async function chooseTarget(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Facility'), FACILITY_ID);
  await user.selectOptions(screen.getByLabelText('Medicine'), MEDICINE_ID);
}

describe('ShortageForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills stock on hand from Inventory (on hand minus reserved)', async () => {
    const user = userEvent.setup();
    mockGetCurrentStock.mockResolvedValue({
      facilityId: FACILITY_ID,
      medicineId: MEDICINE_ID,
      quantityOnHand: 150,
      quantityReserved: 30,
      availableQuantity: 120,
    });

    renderForm();
    await chooseTarget(user);

    await waitFor(() => expect(screen.getByLabelText('Stock on hand')).toHaveValue(120));
    expect(screen.getByTestId('stock-source')).toHaveTextContent('From Inventory: 150 on hand − 30 reserved');
    expect(mockGetCurrentStock).toHaveBeenCalledWith(FACILITY_ID, MEDICINE_ID);
  });

  it('keeps the pre-filled stock editable and sends the edited figure', async () => {
    const user = userEvent.setup();
    mockGetCurrentStock.mockResolvedValue({
      facilityId: FACILITY_ID,
      medicineId: MEDICINE_ID,
      quantityOnHand: 150,
      quantityReserved: 30,
      availableQuantity: 120,
    });
    mockCreateShortage.mockResolvedValue(shortageAlert({ id: 'new-alert' }));

    renderForm();
    await chooseTarget(user);
    await waitFor(() => expect(screen.getByLabelText('Stock on hand')).toHaveValue(120));

    const stock = screen.getByLabelText('Stock on hand');
    await user.clear(stock);
    await user.type(stock, '90');
    await user.click(screen.getByRole('button', { name: 'Raise alert' }));

    await waitFor(() => expect(mockCreateShortage).toHaveBeenCalledTimes(1));
    // TanStack passes a second, internal argument, so only the request is checked.
    expect(mockCreateShortage.mock.calls[0][0]).toEqual(
      expect.objectContaining({ facilityId: FACILITY_ID, medicineId: MEDICINE_ID, currentStock: 90 }),
    );
    expect(await screen.findByTestId('landed')).toHaveTextContent('/demand/shortages/new-alert|');
  });

  it('asks for a figure when Inventory has no balance', async () => {
    const user = userEvent.setup();
    mockGetCurrentStock.mockResolvedValue(null);

    renderForm();
    await chooseTarget(user);

    expect(await screen.findByTestId('stock-source')).toHaveTextContent(
      'Inventory has no balance for this medicine here',
    );
    expect(screen.getByLabelText('Stock on hand')).toHaveValue(null);

    await user.click(screen.getByRole('button', { name: 'Raise alert' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the stock on hand.');
    expect(mockCreateShortage).not.toHaveBeenCalled();
  });

  it('tells the user when an existing alert was updated instead of duplicated', async () => {
    const user = userEvent.setup();
    mockGetCurrentStock.mockResolvedValue({
      facilityId: FACILITY_ID,
      medicineId: MEDICINE_ID,
      quantityOnHand: 120,
      quantityReserved: 0,
      availableQuantity: 120,
    });
    mockCreateShortage.mockResolvedValue(
      shortageAlert({ id: 'existing-alert', existingAlertUpdated: true }),
    );

    renderForm();
    await chooseTarget(user);
    await waitFor(() => expect(screen.getByLabelText('Stock on hand')).toHaveValue(120));

    await user.click(screen.getByRole('button', { name: 'Raise alert' }));

    expect(await screen.findByTestId('landed')).toHaveTextContent(
      `/demand/shortages/existing-alert|${EXISTING_ALERT_UPDATED_NOTICE}`,
    );
  });
});
