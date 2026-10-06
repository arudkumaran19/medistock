import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { redistributionApi } from '../../services/redistributionApi';
import { TransferDto } from '../../types/redistribution';
import { PriorityBadge, StatusBadge } from '../../components/StatusBadge';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { useTransferSignalR } from './useTransferSignalR';

export const TransferDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<TransferDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchTransfers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const params = statusFilter !== 'ALL' ? { status: statusFilter } : undefined;
      const data = await redistributionApi.getTransfers(params);
      setTransfers(data);
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to fetch transfers from backend.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [statusFilter]);

  // Real-time Push via SignalR for Manager Dashboard
  const { isConnected } = useTransferSignalR({
    isManager: true,
    onStatusChanged: (updatedTransfer) => {
      setTransfers((prev) => {
        const index = prev.findIndex((t) => t.id === updatedTransfer.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedTransfer;
          return next;
        } else {
          return [updatedTransfer, ...prev];
        }
      });
    },
  });

  // Polling fallback only when socket is disconnected
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      fetchTransfers(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [statusFilter, isConnected]);

  const filteredTransfers = transfers.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      t.transferNumber.toLowerCase().includes(query) ||
      t.medicineName.toLowerCase().includes(query) ||
      t.destinationFacilityName.toLowerCase().includes(query) ||
      (t.sourceFacilityName && t.sourceFacilityName.toLowerCase().includes(query))
    );
  });

  // Calculate metrics
  const requestedCount = transfers.filter((t) => t.status === 'Requested').length;
  const approvedCount = transfers.filter((t) => t.status === 'Approved' || t.status === 'Reserved').length;
  const inTransitCount = transfers.filter((t) => t.status === 'InTransit').length;
  const deliveredCount = transfers.filter((t) => t.status === 'Delivered').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Transfer Management Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Authoritative overview of hospital medicine shortages, candidate sources, and dispatch logistics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
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
          <button
            onClick={() => fetchTransfers(false)}
            className="btn btn-secondary"
            title="Refresh transfers"
            style={{ height: '40px' }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--status-requested)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">Pending Approval</span>
            <Clock size={18} color="var(--status-requested)" />
          </div>
          <div className="stat-card-value">{requestedCount}</div>
          <div className="stat-card-subtext">Awaiting supply manager sign-off</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--status-approved)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">Approved / Reserved</span>
            <CheckCircle2 size={18} color="var(--status-approved)" />
          </div>
          <div className="stat-card-value">{approvedCount}</div>
          <div className="stat-card-subtext">Inventory locked at source facilities</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--status-intransit)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">In Transit</span>
            <Truck size={18} color="var(--status-intransit)" />
          </div>
          <div className="stat-card-value">{inTransitCount}</div>
          <div className="stat-card-subtext">En route to receiving pharmacies</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--status-delivered)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">Completed Receipts</span>
            <Package size={18} color="var(--status-delivered)" />
          </div>
          <div className="stat-card-value">{deliveredCount}</div>
          <div className="stat-card-subtext">Fulfilled transfers ledger</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter by medicine, hospital, or TR-number..."
        />

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['ALL', 'Requested', 'Approved', 'Reserved', 'InTransit', 'Delivered'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className="btn"
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor:
                  statusFilter === status
                    ? 'var(--color-primary)'
                    : 'rgba(255, 255, 255, 0.05)',
                color: statusFilter === status ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: statusFilter === status ? 700 : 500,
              }}
            >
              {status === 'ALL' ? 'All Transfers' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState message="Loading live transfers from MediStock API..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTransfers} />
      ) : filteredTransfers.length === 0 ? (
        <EmptyState
          title="No transfers found"
          description={
            searchQuery
              ? `No transfers match "${searchQuery}". Try a different search query.`
              : 'No transfers currently exist in the database with the selected filter.'
          }
        />
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '14px 18px' }}>Transfer #</th>
                  <th style={{ padding: '14px 18px' }}>Medicine</th>
                  <th style={{ padding: '14px 18px' }}>Source Facility</th>
                  <th style={{ padding: '14px 18px' }}>Destination</th>
                  <th style={{ padding: '14px 18px' }}>Quantity</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px' }}>Priority</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <td style={{ padding: '16px 18px', fontWeight: 600 }}>
                      <span style={{ color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
                        {t.transferNumber}
                      </span>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t.medicineName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Batch: {t.medicineBatchNumber || 'Pending Allocation'}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {t.sourceFacilityName || (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Unassigned
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {t.destinationFacilityName}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 700 }}>
                        {t.allocatedQuantity > 0 ? t.allocatedQuantity : t.requestedQuantity}{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          units
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <StatusBadge status={t.status} />
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <PriorityBadge priority={t.priority} />
                    </td>

                    <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '8px',
                        }}
                      >
                        <button
                          onClick={() => navigate(`/transfers/${t.id}`)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          title="View transfer details"
                        >
                          Details
                        </button>

                        <button
                          onClick={() => navigate(`/transfers/${t.id}/candidates`)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          title="Evaluate candidate facilities"
                        >
                          Candidates
                        </button>

                        <button
                          onClick={() => navigate(`/transfers/${t.id}/route`)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          title="Inspect road route"
                        >
                          Route
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
