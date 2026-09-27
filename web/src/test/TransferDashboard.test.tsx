import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TransferDashboard } from '../features/redistribution/TransferDashboard';
import { redistributionApi } from '../services/redistributionApi';
import { TransferDto } from '../types/redistribution';

const mockTransfers: TransferDto[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    transferNumber: 'TR-2026-0001',
    sourceFacilityId: 'b2222222-2222-2222-2222-222222222222',
    sourceFacilityName: 'National Hospital Colombo',
    destinationFacilityId: 'c3333333-3333-3333-3333-333333333333',
    destinationFacilityName: 'Teaching Hospital Kandy',
    medicineId: 'd4444444-4444-4444-4444-444444444444',
    medicineName: 'Amoxicillin 500mg',
    medicineBatchNumber: 'BAT-2026-01',
    requestedQuantity: 200,
    allocatedQuantity: 200,
    status: 'Requested',
    priority: 'Urgent',
    distanceKm: 115.5,
    estimatedDurationMinutes: 154,
    notes: 'Urgent pediatric shortage',
    requestedAt: '2026-09-26T10:00:00Z',
    approvedAt: null,
    reservedAt: null,
    dispatchedAt: null,
    deliveredAt: null,
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    transferNumber: 'TR-2026-0002',
    sourceFacilityId: 'b2222222-2222-2222-2222-222222222222',
    sourceFacilityName: 'National Hospital Colombo',
    destinationFacilityId: 'c3333333-3333-3333-3333-333333333333',
    destinationFacilityName: 'District Hospital Negombo',
    medicineId: 'd4444444-4444-4444-4444-444444444444',
    medicineName: 'Paracetamol 500mg',
    medicineBatchNumber: 'BAT-2026-02',
    requestedQuantity: 500,
    allocatedQuantity: 500,
    status: 'Delivered',
    priority: 'Routine',
    distanceKm: 38.0,
    estimatedDurationMinutes: 50,
    notes: 'Routine restocking',
    requestedAt: '2026-09-25T10:00:00Z',
    approvedAt: '2026-09-25T11:00:00Z',
    reservedAt: '2026-09-25T12:00:00Z',
    dispatchedAt: '2026-09-25T13:00:00Z',
    deliveredAt: '2026-09-25T15:00:00Z',
  },
];

describe('TransferDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders metrics and transfer records from API', async () => {
    vi.spyOn(redistributionApi, 'getTransfers').mockResolvedValue(mockTransfers);

    render(
      <MemoryRouter>
        <TransferDashboard />
      </MemoryRouter>
    );

    // Initial loading indicator
    expect(screen.getByText(/Loading live transfers/i)).toBeInTheDocument();

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Transfer Management Dashboard')).toBeInTheDocument();
      expect(screen.getByText('TR-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('TR-2026-0002')).toBeInTheDocument();
      expect(screen.getByText('Amoxicillin 500mg')).toBeInTheDocument();
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    });

    // Check metric cards
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Completed Receipts')).toBeInTheDocument();
  });

  it('filters transfers by search input', async () => {
    vi.spyOn(redistributionApi, 'getTransfers').mockResolvedValue(mockTransfers);

    render(
      <MemoryRouter>
        <TransferDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TR-2026-0001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter by medicine/i);
    fireEvent.change(searchInput, { target: { value: 'Amoxicillin' } });

    expect(screen.getByText('TR-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText('TR-2026-0002')).not.toBeInTheDocument();
  });
});
