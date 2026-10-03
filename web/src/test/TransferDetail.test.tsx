import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TransferDetail } from '../features/redistribution/TransferDetail';
import { redistributionApi } from '../services/redistributionApi';
import { workflowApi } from '../services/workflowApi';
import { TransferDto } from '../types/redistribution';

const mockDraftTransfer: TransferDto = {
  id: 'tr-draft-001',
  transferNumber: 'TR-2026-DRAFT',
  sourceFacilityId: '',
  sourceFacilityName: '',
  destinationFacilityId: 'dest-fac-01',
  destinationFacilityName: 'Teaching Hospital Kandy',
  medicineId: 'med-01',
  medicineName: 'Amoxicillin 500mg',
  medicineBatchNumber: '',
  requestedQuantity: 200,
  allocatedQuantity: 0,
  status: 'Draft',
  priority: 'Urgent',
  distanceKm: 0,
  estimatedDurationMinutes: 0,
  notes: 'Field officer shortage declaration draft',
  requestedAt: '2026-09-28T08:00:00Z',
  approvedAt: null,
  reservedAt: null,
  dispatchedAt: null,
  deliveredAt: null,
};

const mockProposedTransfer: TransferDto = {
  ...mockDraftTransfer,
  id: 'tr-proposed-002',
  transferNumber: 'TR-2026-PROP',
  status: 'Proposed',
  sourceFacilityId: 'src-fac-01',
  sourceFacilityName: 'National Hospital Colombo',
  distanceKm: 115.5,
  estimatedDurationMinutes: 154,
};

const mockRequestedTransfer: TransferDto = {
  ...mockProposedTransfer,
  id: 'tr-requested-003',
  transferNumber: 'TR-2026-REQ',
  status: 'Requested',
  workflowRunId: 'wf-run-001',
};

describe('TransferDetail Component - Client Responsibility Split (ADR-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Draft transfer with read-only waiting note and without Submit Request or Approve/Reject buttons', async () => {
    vi.spyOn(redistributionApi, 'getTransferById').mockResolvedValue(mockDraftTransfer);

    render(
      <MemoryRouter initialEntries={['/transfers/tr-draft-001']}>
        <Routes>
          <Route path="/transfers/:id" element={<TransferDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Transfer TR-2026-DRAFT')).toBeInTheDocument();
    });

    // 1. "Submit Request" button must NOT be present
    expect(screen.queryByRole('button', { name: /Submit Request/i })).not.toBeInTheDocument();

    // 2. Approve / Reject buttons must NOT be present for Draft
    expect(screen.queryByRole('button', { name: /Approve Transfer Plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject Plan/i })).not.toBeInTheDocument();

    // 3. Read-only note "Waiting for field officer to submit the request" must be displayed
    expect(screen.getAllByText(/Waiting for field officer to submit the request/i).length).toBeGreaterThan(0);

    // 4. Candidate Sources and Road Route buttons must be preserved
    expect(screen.getByRole('button', { name: /Candidate Sources/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Route/i })).toBeInTheDocument();

    // 5. "Request Notes" label must be present (and NOT "Clinical Request Notes")
    expect(screen.getByText('Request Notes:')).toBeInTheDocument();
    expect(screen.queryByText('Clinical Request Notes:')).not.toBeInTheDocument();
  });

  it('renders Requested transfer with AI planning in progress note and without Approve/Reject buttons', async () => {
    vi.spyOn(redistributionApi, 'getTransferById').mockResolvedValue(mockRequestedTransfer);

    render(
      <MemoryRouter initialEntries={['/transfers/tr-requested-003']}>
        <Routes>
          <Route path="/transfers/:id" element={<TransferDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Transfer TR-2026-REQ')).toBeInTheDocument();
    });

    // Submit Request button must NOT be present
    expect(screen.queryByRole('button', { name: /Submit Request/i })).not.toBeInTheDocument();

    // Approve / Reject buttons must NOT be present for Requested (agent is planning)
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject Plan/i })).not.toBeInTheDocument();

    // AI planning note must be displayed
    expect(screen.getAllByText(/AI Planning Agent in Progress/i).length).toBeGreaterThan(0);

    // Candidate Sources and Road Route buttons remain
    expect(screen.getByRole('button', { name: /Candidate Sources/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Route/i })).toBeInTheDocument();
  });

  it('renders Proposed transfer with Approve and Reject action buttons for manager decision', async () => {
    vi.spyOn(redistributionApi, 'getTransferById').mockResolvedValue(mockProposedTransfer);
    vi.spyOn(workflowApi, 'getWorkflowRun').mockResolvedValue({
      id: 'wf-run-001',
      workflowType: 'RedistributionPlanning',
      status: 'WaitingForApproval',
      currentStep: 'Human Manager Approval',
      destinationFacilityId: 'dest-fac-01',
      medicineId: 'med-01',
      shortageQuantity: 200,
      selectedFacilityId: 'src-fac-01',
      proposedQuantity: 200,
      provider: 'LangGraphAgent',
      reasoning: 'Optimal route',
      initiatedAt: '2026-09-28T08:00:00Z',
      completedAt: null,
      steps: [],
    });

    render(
      <MemoryRouter initialEntries={['/transfers/tr-proposed-002']}>
        <Routes>
          <Route path="/transfers/:id" element={<TransferDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Transfer TR-2026-PROP')).toBeInTheDocument();
    });

    // Submit Request button must NOT be present
    expect(screen.queryByRole('button', { name: /Submit Request/i })).not.toBeInTheDocument();

    // Waiting note must NOT be displayed for Proposed status
    expect(screen.queryByText(/Waiting for field officer to submit the request/i)).not.toBeInTheDocument();

    // Approve and Reject buttons must be present when Proposed
    expect(screen.getByRole('button', { name: /Approve Plan/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Reject Plan/i }).length).toBeGreaterThan(0);

    // Candidate Sources and Road Route buttons remain
    expect(screen.getByRole('button', { name: /Candidate Sources/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Route/i })).toBeInTheDocument();

    // Request Notes label
    expect(screen.getByText('Request Notes:')).toBeInTheDocument();
  });
});
