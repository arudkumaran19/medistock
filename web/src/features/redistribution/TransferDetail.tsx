import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle,
  Clock,
  Compass,
  Navigation,
  Package,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import { redistributionApi } from '../../services/redistributionApi';
import { workflowApi } from '../../services/workflowApi';
import { RouteDetailsDto, TransferDto, TransferStatus } from '../../types/redistribution';
import { WorkflowRunDto } from '../../types/workflow';
import { PriorityBadge, StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useTransferSignalR } from './useTransferSignalR';
import { TransferLiveMap } from './TransferLiveMap';

const STATUS_PIPELINE: TransferStatus[] = [
  'Draft',
  'Requested',
  'Proposed',
  'Approved',
  'Reserved',
  'InTransit',
  'Delivered',
];

export const TransferDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transfer, setTransfer] = useState<TransferDto | null>(null);
  const [routeData, setRouteData] = useState<RouteDetailsDto | null>(null);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRunDto | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDanger?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });

  const fetchTransfer = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await redistributionApi.getTransferById(id);
      setTransfer(data);
      if (data.workflowRunId) {
        try {
          const run = await workflowApi.getWorkflowRun(data.workflowRunId);
          setWorkflowRun(run);
        } catch (e) {
          console.warn('Could not fetch linked workflow run:', e);
        }
      } else {
        setWorkflowRun(null);
      }

      if (data.sourceFacilityId) {
        try {
          const route = await redistributionApi.getRoute(id);
          setRouteData(route);
        } catch (e) {
          console.warn('Could not fetch route details:', e);
        }
      }
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to fetch transfer details.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfer();
  }, [id]);

  // Real-time Push via SignalR with polling fallback
  const { isConnected } = useTransferSignalR({
    transferId: id,
    isManager: true,
    onStatusChanged: (updatedTransfer) => {
      setTransfer(updatedTransfer);
    },
    onLocationUpdated: (location) => {
      setTransfer((prev) => {
        if (!prev || prev.id !== location.transferId) return prev;
        return {
          ...prev,
          lastLatitude: location.latitude,
          lastLongitude: location.longitude,
          lastLocationAt: location.timestamp,
        };
      });
    },
  });

  // Polling fallback only when SignalR socket is disconnected
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      fetchTransfer(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [id, isConnected]);

  const handleReserveStock = () => {
    if (!transfer) return;
    setConfirmModal({
      isOpen: true,
      title: 'Reserve Inventory at Source',
      message: `Reserve ${transfer.allocatedQuantity || transfer.requestedQuantity} units of ${transfer.medicineName} at ${transfer.sourceFacilityName}?`,
      confirmLabel: 'Confirm Reservation',
      action: async () => {
        setActionLoading(true);
        try {
          await redistributionApi.reserveStock(transfer.id, {
            transferId: transfer.id,
            sourceFacilityId: transfer.sourceFacilityId,
            medicineId: transfer.medicineId,
            quantityToReserve: transfer.allocatedQuantity || transfer.requestedQuantity,
            notes: 'Managerial stock reservation locked via portal.',
          });
          await fetchTransfer();
        } finally {
          setActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDispatchTransfer = () => {
    if (!transfer) return;
    setConfirmModal({
      isOpen: true,
      title: 'Dispatch Transfer to In-Transit',
      message: `Confirm that the shipment of ${transfer.allocatedQuantity || transfer.requestedQuantity} units of ${transfer.medicineName} has departed from ${transfer.sourceFacilityName} to ${transfer.destinationFacilityName}?`,
      confirmLabel: 'Dispatch Transfer',
      action: async () => {
        setActionLoading(true);
        try {
          await redistributionApi.dispatchTransfer(transfer.id, 'Shipment dispatched by facility dispatch officer.');
          await fetchTransfer();
        } catch (err: any) {
          setError(err.message || 'Failed to dispatch transfer.');
        } finally {
          setActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleReceiveTransfer = () => {
    if (!transfer) return;
    setConfirmModal({
      isOpen: true,
      title: 'Acknowledge Delivery & Receipt',
      message: `Confirm that all ${transfer.allocatedQuantity || transfer.requestedQuantity} units of ${transfer.medicineName} have been received and verified?`,
      confirmLabel: 'Confirm Receipt',
      action: async () => {
        setActionLoading(true);
        try {
          await redistributionApi.receiveTransfer(transfer.id, {
            transferId: transfer.id,
            receivedQuantity: transfer.allocatedQuantity || transfer.requestedQuantity,
            batchNumber: transfer.medicineBatchNumber || 'BATCH-DEFAULT',
            destinationFacilityId: transfer.destinationFacilityId,
            notes: 'Physical delivery verified by receiving authority.',
          });
          await fetchTransfer();
        } finally {
          setActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleApproveWorkflow = () => {
    if (!transfer) return;
    setDecisionNotes('Transfer plan approved by Central Supply Director.');
    setConfirmModal({
      isOpen: true,
      title: 'Approve Transfer Plan via Workflow',
      message: `Formally approve redistribution plan for ${transfer.medicineName} (${transfer.allocatedQuantity || transfer.requestedQuantity} units) to ${transfer.destinationFacilityName}? This calls POST /api/workflow/runs/{id}/approve on WorkflowController.`,
      confirmLabel: 'Approve Plan',
      action: async () => {
        setActionLoading(true);
        try {
          let runId = transfer.workflowRunId;
          // Ensure a workflow run exists if not already attached
          if (!runId) {
            const startRes = await workflowApi.startWorkflow({
              transferRequestId: transfer.id,
              destinationFacilityId: transfer.destinationFacilityId,
              medicineId: transfer.medicineId,
              shortageQuantity: transfer.requestedQuantity,
              additionalContext: `Auto-linked for transfer ${transfer.transferNumber}`,
            });
            runId = startRes.id;
          }
          if (runId) {
            await workflowApi.approveWorkflow(runId, {
              approverUserId: '00000000-0000-0000-0000-000000000001',
              decisionNotes: decisionNotes || 'Transfer plan approved by Central Supply Director.',
            });
          }
          await fetchTransfer();
        } catch (err: any) {
          setError(err.message || 'Failed to approve workflow run.');
        } finally {
          setActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRejectWorkflow = () => {
    if (!transfer) return;
    setDecisionNotes('Transfer plan rejected by Central Supply Director.');
    setConfirmModal({
      isOpen: true,
      title: 'Reject Transfer Plan via Workflow',
      message: `Formally reject redistribution plan for transfer ${transfer.transferNumber}? This calls POST /api/workflow/runs/{id}/reject on WorkflowController.`,
      confirmLabel: 'Reject Plan',
      isDanger: true,
      action: async () => {
        setActionLoading(true);
        try {
          let runId = transfer.workflowRunId;
          if (!runId) {
            const startRes = await workflowApi.startWorkflow({
              transferRequestId: transfer.id,
              destinationFacilityId: transfer.destinationFacilityId,
              medicineId: transfer.medicineId,
              shortageQuantity: transfer.requestedQuantity,
              additionalContext: `Auto-linked for transfer ${transfer.transferNumber}`,
            });
            runId = startRes.id;
          }
          if (runId) {
            await workflowApi.rejectWorkflow(runId, {
              approverUserId: '00000000-0000-0000-0000-000000000001',
              decisionNotes: decisionNotes || 'Transfer plan rejected by Central Supply Director.',
            });
          }
          await fetchTransfer();
        } catch (err: any) {
          setError(err.message || 'Failed to reject workflow run.');
        } finally {
          setActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  if (loading) return <LoadingState message="Loading transfer records..." />;
  if (error || !transfer) return <ErrorState message={error || 'Transfer not found.'} onRetry={fetchTransfer} />;

  const currentStepIndex = STATUS_PIPELINE.indexOf(transfer.status);
  // Manager Approve/Reject in React only when Proposed per ADR and workflow specification
  const isAwaitingApproval = transfer.status === 'Proposed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
            style={{ padding: '8px' }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                Transfer {transfer.transferNumber}
              </h1>
              <StatusBadge status={transfer.status} />
              <PriorityBadge priority={transfer.priority} />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 9px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  color: isConnected ? 'var(--color-emerald)' : 'var(--color-amber)',
                  border: isConnected ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? 'var(--color-emerald)' : 'var(--color-amber)',
                  }}
                />
                {isConnected ? 'SignalR Live' : 'Polling (Fallback)'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
              ID: <span style={{ fontFamily: 'monospace' }}>{transfer.id}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate(`/transfers/${transfer.id}/candidates`)}
            className="btn btn-secondary"
          >
            <Users size={16} />
            Candidate Sources
          </button>

          <button
            onClick={() => navigate(`/transfers/${transfer.id}/route`)}
            className="btn btn-secondary"
          >
            <Compass size={16} />
            Road Route
          </button>

          {/* Draft: read-only note (field officer submits via Flutter mobile app per ADR-008) */}
          {transfer.status === 'Draft' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: 'var(--color-amber)',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              <Clock size={15} />
              <span>Waiting for field officer to submit the request</span>
            </div>
          )}

          {/* Requested: AI planning agent in progress */}
          {transfer.status === 'Requested' && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: 'var(--color-primary)',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              <Clock size={15} />
              <span>AI planning agent in progress</span>
            </div>
          )}

          {/* Approvable states: ONLY when status is Requested (or linked workflow run is WaitingForApproval), never Draft or Proposed */}
          {isAwaitingApproval && (
            <>
              <button
                onClick={handleRejectWorkflow}
                className="btn btn-danger"
                disabled={actionLoading}
                style={{
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <XCircle size={16} color="#ffffff" />
                Reject Plan
              </button>
              <button
                onClick={handleApproveWorkflow}
                className="btn btn-primary"
                disabled={actionLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle size={16} />
                Approve Transfer Plan
              </button>
            </>
          )}

          {transfer.status === 'Approved' && (
            <button onClick={handleReserveStock} className="btn btn-primary" disabled={actionLoading}>
              Reserve Inventory
            </button>
          )}

          {transfer.status === 'Reserved' && (
            <button
              onClick={handleDispatchTransfer}
              className="btn btn-primary"
              disabled={actionLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Truck size={16} />
              Dispatch Transfer
            </button>
          )}

          {transfer.status === 'InTransit' && (
            <button onClick={handleReceiveTransfer} className="btn btn-primary" disabled={actionLoading}>
              Acknowledge Receipt
            </button>
          )}
        </div>
      </div>

      {/* Progression Pipeline Timeline */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', fontWeight: 700, marginBottom: '20px' }}>
          Transfer Status Progression Pipeline
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {STATUS_PIPELINE.map((st, idx) => {
            const isCompleted = currentStepIndex >= idx;
            const isCurrent = currentStepIndex === idx;

            return (
              <div
                key={st}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  zIndex: 2,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: isCompleted
                      ? '#0d9488'
                      : '#f1f5f9',
                    border: isCurrent
                      ? '3px solid #0f766e'
                      : isCompleted
                      ? '2px solid #0d9488'
                      : '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isCompleted ? '#ffffff' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(13, 148, 136, 0.15)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                >
                  {isCompleted ? <CheckCircle size={18} /> : <span>{idx + 1}</span>}
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCompleted ? '#0f172a' : '#64748b',
                  }}
                >
                  {st}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Medicine & Quantity Details */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Package size={20} color="var(--color-cyan)" />
            <h3 style={{ fontSize: '1.1rem' }}>Medicine & Stock Specs</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Medicine Name:</span>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a', marginTop: '2px' }}>
                {transfer.medicineName}
              </div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Allocated / Requested Quantity:</span>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#0f766e', marginTop: '2px' }}>
                {transfer.allocatedQuantity > 0 ? transfer.allocatedQuantity : transfer.requestedQuantity} units
              </div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Batch / Lot Number:</span>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{transfer.medicineBatchNumber || 'Unassigned (Auto-Allocated)'}</div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Priority Level:</span>
              <div style={{ marginTop: '4px' }}>
                <PriorityBadge priority={transfer.priority} />
              </div>
            </div>
          </div>
        </div>

        {/* Facilities & Route Details */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Building2 size={20} color="#0f766e" />
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', margin: 0 }}>Hospital Facilities</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Source Facility (Sender):</span>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {transfer.sourceFacilityName || 'Not yet assigned (Pending Candidate Selection)'}
              </div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Destination Facility (Shortage Center):</span>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {transfer.destinationFacilityName}
              </div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Estimated Road Transit:</span>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {transfer.distanceKm > 0 ? `${transfer.distanceKm} km (~${transfer.estimatedDurationMinutes} mins)` : 'Awaiting candidate selection'}
              </div>
            </div>

            {transfer.lastLatitude != null && (
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '4px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    Live Field Officer GPS
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace', color: '#0f172a' }}>
                    {transfer.lastLatitude.toFixed(5)}, {transfer.lastLongitude?.toFixed(5)}
                  </div>
                </div>
                {transfer.lastLocationAt && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(transfer.lastLocationAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}

            <div>
              <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>Request Notes:</span>
              <div style={{ fontStyle: 'italic', color: '#334155', marginTop: '2px' }}>
                {transfer.notes || 'No supplementary request notes recorded.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Operational Map & Transit Tracking (OpenStreetMap) */}
      {transfer.sourceFacilityId && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Navigation size={20} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1.1rem' }}>Live Operational Transit Map (OpenStreetMap)</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Routing Engine:</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                {routeData?.provider || transfer.routingProvider || 'OpenRouteService'}
              </span>
            </div>
          </div>

          <TransferLiveMap
            sourceFacilityName={transfer.sourceFacilityName || 'Source Depot'}
            sourceCoords={[
              routeData?.sourceLatitude ?? 6.9175,
              routeData?.sourceLongitude ?? 79.8653,
            ]}
            destinationFacilityName={transfer.destinationFacilityName || 'Destination Hospital'}
            destinationCoords={[
              routeData?.destinationLatitude ?? 7.2882,
              routeData?.destinationLongitude ?? 80.6278,
            ]}
            vehicleCoords={
              transfer.lastLatitude != null && transfer.lastLongitude != null
                ? [transfer.lastLatitude, transfer.lastLongitude]
                : null
            }
            waypoints={routeData?.waypoints || []}
            distanceKm={transfer.distanceKm || routeData?.distanceKm}
            durationMinutes={transfer.estimatedDurationMinutes || routeData?.durationMinutes}
            status={transfer.status}
          />
        </div>
      )}

      {/* Workflow Plan & Management Decision Section */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1.1rem' }}>Redistribution Workflow Plan & Management Decision</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Workflow Endpoint:</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--color-primary)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
            >
              POST /api/workflow/runs/{'{id}'}/approve
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Workflow Run ID: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                {transfer.workflowRunId || workflowRun?.id || 'Pending Auto-Link'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '8px' }}>
                Workflow State:
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor:
                    transfer.status === 'Approved' || workflowRun?.status === 'Approved'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : transfer.status === 'Rejected' || workflowRun?.status === 'Rejected'
                      ? 'rgba(244, 63, 94, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                  color:
                    transfer.status === 'Approved' || workflowRun?.status === 'Approved'
                      ? 'var(--color-emerald)'
                      : transfer.status === 'Rejected' || workflowRun?.status === 'Rejected'
                      ? 'var(--color-rose)'
                      : 'var(--color-amber)',
                  border:
                    transfer.status === 'Approved' || workflowRun?.status === 'Approved'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : transfer.status === 'Rejected' || workflowRun?.status === 'Rejected'
                      ? '1px solid rgba(244, 63, 94, 0.3)'
                      : '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                {transfer.status === 'Approved' || workflowRun?.status === 'Approved'
                  ? 'Approved'
                  : transfer.status === 'Rejected' || workflowRun?.status === 'Rejected'
                  ? 'Rejected'
                  : 'WaitingForApproval'}
              </span>
            </div>
          </div>

          {/* Workflow Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {[
              { num: 1, title: 'Shortage & Context', desc: 'Destination deficit identified', done: true },
              { num: 2, title: 'Agent Route & Surplus', desc: 'LangGraph multi-agent proposal', done: true },
              { num: 3, title: 'Deterministic Rules', desc: 'Proximity & safety threshold checks', done: true },
              {
                num: 4,
                title: 'Human Manager Approval',
                desc: 'WorkflowController sign-off',
                done: transfer.status === 'Approved' || workflowRun?.status === 'Approved',
                current: transfer.status === 'Requested',
              },
            ].map((step) => (
              <div
                key={step.num}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: step.current
                    ? 'rgba(245, 158, 11, 0.08)'
                    : step.done
                    ? 'rgba(16, 185, 129, 0.06)'
                    : 'var(--bg-tertiary)',
                  border: step.current
                    ? '1px solid rgba(245, 158, 11, 0.3)'
                    : step.done
                    ? '1px solid rgba(16, 185, 129, 0.2)'
                    : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: step.done ? 'var(--color-emerald)' : 'var(--color-amber)',
                      color: '#ffffff',
                    }}
                  >
                    {step.done ? '✓' : step.num}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{step.title}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{step.desc}</div>
              </div>
            ))}
          </div>

          {/* Manager Action Banner if awaiting approval */}
          {isAwaitingApproval && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} />
                  Managerial Approval Required
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  The candidate source hospital and transit route are locked. Formally approve or reject this redistribution run to authorize inventory reservation.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleRejectWorkflow}
                  className="btn btn-danger"
                  disabled={actionLoading}
                  style={{
                    color: '#ffffff',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle size={16} color="#ffffff" />
                  Reject Plan
                </button>
                <button
                  onClick={handleApproveWorkflow}
                  className="btn btn-primary"
                  disabled={actionLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle size={16} />
                  Approve Plan
                </button>
              </div>
            </div>
          )}

          {/* Read-only notes for earlier lifecycle stages */}
          {transfer.status === 'Draft' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <Clock size={20} color="var(--color-amber)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-amber)' }}>
                  Awaiting Field Officer Submission
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Waiting for field officer to submit the request
                </div>
              </div>
            </div>
          )}

          {transfer.status === 'Requested' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
            >
              <Clock size={20} color="var(--color-primary)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  AI Planning Agent in Progress
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Shortage request received. AI agent is evaluating surplus facilities and calculating optimal route.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit History Timeline */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Clock size={20} color="var(--color-purple)" />
          <h3 style={{ fontSize: '1.1rem' }}>Authoritative Status Audit Log</h3>
        </div>

        {transfer.statusHistories && transfer.statusHistories.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {transfer.statusHistories.map((h, idx) => (
              <div
                key={h.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary)',
                    marginTop: '6px',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 600 }}>{h.fromStatus || 'Created'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{h.toStatus}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Reason: {h.reason || 'Normal operational transition.'}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(h.changedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No status history transitions recorded yet.
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDanger={confirmModal.isDanger}
        isLoading={actionLoading}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Decision Notes / Audit Justification:
          </label>
          <textarea
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default, #cbd5e1)',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: '0.875rem',
              resize: 'vertical',
            }}
            placeholder="Enter reason or comments for this workflow decision..."
          />
        </div>
      </ConfirmDialog>
    </div>
  );
};
