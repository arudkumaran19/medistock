import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { redistributionApi } from '../../services/redistributionApi';
import { TransferDto } from '../../types/redistribution';
import { StatusBadge } from '../../components/StatusBadge';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

export const TransferHistory: React.FC = () => {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<TransferDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await redistributionApi.getTransfers();
      setTransfers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transfer history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredTransfers = transfers.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      t.transferNumber.toLowerCase().includes(query) ||
      t.medicineName.toLowerCase().includes(query) ||
      t.destinationFacilityName.toLowerCase().includes(query) ||
      (t.sourceFacilityName && t.sourceFacilityName.toLowerCase().includes(query))
    );
  });

  // Calculate historical totals
  const totalCompletedTransfers = transfers.filter((t) => t.status === 'Delivered').length;
  const totalUnitsTransferred = transfers
    .filter((t) => t.status === 'Delivered')
    .reduce((sum, t) => sum + (t.allocatedQuantity || t.requestedQuantity), 0);
  const totalKmTraversed = transfers
    .filter((t) => t.status === 'Delivered')
    .reduce((sum, t) => sum + Number(t.distanceKm || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Historical Transfer Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Complete historical audit trail and ledger of all medicine redistribution transactions.
          </p>
        </div>

        <button onClick={fetchHistory} className="btn btn-secondary">
          <RefreshCw size={16} />
          Refresh Ledger
        </button>
      </div>

      {/* Historical Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">Delivered Transfers</span>
            <CheckCircle size={18} color="var(--color-primary)" />
          </div>
          <div className="stat-card-value">{totalCompletedTransfers}</div>
          <div className="stat-card-subtext">Successfully fulfilled & verified</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--color-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">Total Units Redistributed</span>
            <Package size={18} color="var(--color-cyan)" />
          </div>
          <div className="stat-card-value">{totalUnitsTransferred.toLocaleString()}</div>
          <div className="stat-card-subtext">Doses transferred across facilities</div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--color-purple)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-title">Transit Distance Traversed</span>
            <Truck size={18} color="var(--color-purple)" />
          </div>
          <div className="stat-card-value">{totalKmTraversed.toFixed(1)} km</div>
          <div className="stat-card-subtext">Cumulative inter-facility logistics</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter ledger by transfer #, medicine, or hospital..."
        />
      </div>

      {/* Ledger Table */}
      {loading ? (
        <LoadingState message="Loading historical ledger records..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchHistory} />
      ) : filteredTransfers.length === 0 ? (
        <EmptyState
          title="No transfer history records"
          description="There are currently no recorded transfer transactions matching your criteria."
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
                  <th style={{ padding: '14px 18px' }}>Source & Destination</th>
                  <th style={{ padding: '14px 18px' }}>Quantity</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px' }}>Transit</th>
                  <th style={{ padding: '14px 18px' }}>Requested At</th>
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
                      <div style={{ fontWeight: 600 }}>{t.medicineName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Batch: {t.medicineBatchNumber || 'N/A'}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>From:</span>{' '}
                        {t.sourceFacilityName || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>To:</span>{' '}
                        {t.destinationFacilityName}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px', fontWeight: 700 }}>
                      {t.allocatedQuantity > 0 ? t.allocatedQuantity : t.requestedQuantity} units
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <StatusBadge status={t.status} />
                    </td>

                    <td style={{ padding: '16px 18px', fontSize: '0.85rem' }}>
                      {t.distanceKm > 0 ? `${t.distanceKm} km` : '—'}
                    </td>

                    <td style={{ padding: '16px 18px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(t.requestedAt).toLocaleDateString()}
                    </td>

                    <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/transfers/${t.id}`)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Inspect
                      </button>
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
