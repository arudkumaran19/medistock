import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building,
  Check,
  Compass,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { redistributionApi } from '../../services/redistributionApi';
import { CandidateFacilityDto, TransferDto } from '../../types/redistribution';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

export const CandidateFacilities: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transfer, setTransfer] = useState<TransferDto | null>(null);
  const [candidates, setCandidates] = useState<CandidateFacilityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [transferData, candidateList] = await Promise.all([
        redistributionApi.getTransferById(id),
        redistributionApi.getCandidates(id),
      ]);
      setTransfer(transferData);
      setCandidates(candidateList);
    } catch (err: any) {
      setError(err.message || 'Failed to load candidate source facilities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) return <LoadingState message="Discovering candidate source facilities & computing surplus..." />;
  if (error || !transfer) return <ErrorState message={error || 'Transfer not found.'} onRetry={fetchData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate(`/transfers/${transfer.id}`)}
            className="btn btn-secondary"
            style={{ padding: '8px' }}
            title="Back to Transfer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                Candidate Source Facilities
              </h1>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--color-cyan)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {candidates.length} Qualified Candidates
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
              Shortage: <strong style={{ color: 'var(--text-primary)' }}>{transfer.requestedQuantity} units</strong> of{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{transfer.medicineName}</strong> for{' '}
              <strong style={{ color: 'var(--color-primary)' }}>{transfer.destinationFacilityName}</strong>
            </p>
          </div>
        </div>

        <button onClick={fetchData} className="btn btn-secondary">
          <RefreshCw size={16} />
          Re-evaluate Sources
        </button>
      </div>

      {/* Overview Info Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderLeft: '4px solid var(--color-cyan)',
          backgroundColor: 'rgba(6, 182, 212, 0.08)',
        }}
      >
        <Sparkles size={22} color="var(--color-cyan)" />
        <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
          Candidate sources are scored by combining available surplus ratio with road transit distance:{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            Score = (Surplus / MaxSurplus) &times; 0.6 + (1 - Distance / MaxDistance) &times; 0.4
          </strong>.
          Only facilities with genuine available surplus beyond safety thresholds are qualified.
        </div>
      </div>

      {/* Candidate Facility Cards List */}
      {candidates.length === 0 ? (
        <EmptyState
          title="No qualified candidate sources found"
          description="There are currently no healthcare facilities with stock surplus beyond their safety thresholds for this medicine."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
          {candidates.map((cand, index) => {
            const isTopMatch = index === 0;

            return (
              <div
                key={cand.facilityId}
                className="glass-panel"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  border: isTopMatch ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: isTopMatch ? '0 0 20px var(--color-primary-glow)' : 'var(--shadow-md)',
                }}
              >
                {/* Ranking Tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={18} color={isTopMatch ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{cand.facilityName}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <MapPin size={14} />
                      {cand.city} &bull; Coordinates: {cand.latitude.toFixed(4)}, {cand.longitude.toFixed(4)}
                    </div>
                  </div>

                  {isTopMatch && (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--color-primary)',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Top Recommendation
                    </span>
                  )}
                </div>

                {/* Score & Distance Metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Match Score</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-cyan)' }}>
                      {(cand.score * 100).toFixed(1)} / 100
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Transit Distance</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {cand.distanceKm} km
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      ~{cand.estimatedDurationMinutes} mins ({cand.routingProvider})
                    </div>
                  </div>
                </div>

                {/* Surplus Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stock on Hand:</span>
                    <span style={{ fontWeight: 600 }}>{cand.stockOnHand} units</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Safety Threshold:</span>
                    <span style={{ color: 'var(--color-amber)', fontWeight: 600 }}>{cand.safetyStock} units</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Reserved Stock:</span>
                    <span style={{ color: 'var(--color-purple)', fontWeight: 600 }}>{cand.reservedStock} units</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '6px',
                      fontSize: '1rem',
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ color: 'var(--color-primary)' }}>Available Surplus:</span>
                    <span style={{ color: 'var(--color-primary)' }}>{cand.availableSurplus} units</span>
                  </div>
                </div>

                {/* Inspect Route Button */}
                <button
                  onClick={() => navigate(`/transfers/${transfer.id}/route`)}
                  className="btn btn-secondary"
                  style={{ marginTop: 'auto', width: '100%' }}
                >
                  <Compass size={16} />
                  Inspect Road Route
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
