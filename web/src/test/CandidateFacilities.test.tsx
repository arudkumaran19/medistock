import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CandidateFacilities } from '../features/redistribution/CandidateFacilities';
import { redistributionApi } from '../services/redistributionApi';
import { CandidateFacilityDto, TransferDto } from '../types/redistribution';

const mockTransfer: TransferDto = {
  id: 'transfer-123',
  transferNumber: 'TR-2026-0099',
  sourceFacilityId: '',
  sourceFacilityName: '',
  destinationFacilityId: 'facility-dest',
  destinationFacilityName: 'Teaching Hospital Kandy',
  medicineId: 'med-123',
  medicineName: 'Ceftriaxone 1g',
  medicineBatchNumber: '',
  requestedQuantity: 100,
  allocatedQuantity: 0,
  status: 'Requested',
  priority: 'Emergency',
  distanceKm: 0,
  estimatedDurationMinutes: 0,
  notes: 'Emergency ICU shortage',
  requestedAt: '2026-09-26T10:00:00Z',
  approvedAt: null,
  reservedAt: null,
  dispatchedAt: null,
  deliveredAt: null,
};

const mockCandidates: CandidateFacilityDto[] = [
  {
    facilityId: 'candidate-1',
    facilityName: 'National Hospital Colombo',
    city: 'Colombo',
    latitude: 6.9271,
    longitude: 79.8612,
    stockOnHand: 800,
    safetyStock: 100,
    reservedStock: 50,
    availableSurplus: 650,
    distanceKm: 115.2,
    estimatedDurationMinutes: 153.6,
    routingProvider: 'DeterministicHaversine',
    score: 0.85,
  },
  {
    facilityId: 'candidate-2',
    facilityName: 'Karapitiya Teaching Hospital',
    city: 'Galle',
    latitude: 6.0535,
    longitude: 80.2210,
    stockOnHand: 400,
    safetyStock: 100,
    reservedStock: 20,
    availableSurplus: 280,
    distanceKm: 180.5,
    estimatedDurationMinutes: 240.0,
    routingProvider: 'DeterministicHaversine',
    score: 0.52,
  },
];

describe('CandidateFacilities Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders qualified candidate source facilities with surplus breakdown', async () => {
    vi.spyOn(redistributionApi, 'getTransferById').mockResolvedValue(mockTransfer);
    vi.spyOn(redistributionApi, 'getCandidates').mockResolvedValue(mockCandidates);

    render(
      <MemoryRouter initialEntries={['/transfers/transfer-123/candidates']}>
        <Routes>
          <Route path="/transfers/:id/candidates" element={<CandidateFacilities />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Candidate Source Facilities')).toBeInTheDocument();
      expect(screen.getByText('National Hospital Colombo')).toBeInTheDocument();
      expect(screen.getByText('Karapitiya Teaching Hospital')).toBeInTheDocument();
      expect(screen.getByText('Top Recommendation')).toBeInTheDocument();
      expect(screen.getByText('650 units')).toBeInTheDocument();
      expect(screen.getByText('280 units')).toBeInTheDocument();
    });
  });
});
