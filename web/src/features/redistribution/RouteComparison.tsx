import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building,
  CheckCircle2,
  Clock,
  Compass,
  CornerDownRight,
  Info,
  MapPin,
  Navigation,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { redistributionApi } from '../../services/redistributionApi';
import { RouteDetailsDto, TransferDto } from '../../types/redistribution';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';

export const RouteComparison: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transfer, setTransfer] = useState<TransferDto | null>(null);
  const [route, setRoute] = useState<RouteDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteType, setSelectedRouteType] = useState<'fastest' | 'shortest'>('fastest');

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [transferData, routeData] = await Promise.all([
        redistributionApi.getTransferById(id),
        redistributionApi.getRoute(id),
      ]);
      setTransfer(transferData);
      setRoute(routeData);
    } catch (err: any) {
      setError(err.message || 'Failed to compute route details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) return <LoadingState message="Calculating road transit distance & geo-routes..." />;
  if (error || !transfer) return <ErrorState message={error || 'Route not found.'} onRetry={fetchData} />;

  // Calculate synthetic alternative route comparison
  const baseDistance = route?.distanceKm || transfer.distanceKm || 45.0;
  const baseDuration = route?.durationMinutes || transfer.estimatedDurationMinutes || 60.0;

  const fastestRoute = {
    name: 'Fastest Highway Transit',
    distanceKm: baseDistance,
    durationMinutes: baseDuration,
    description: 'Optimized for high-speed expressways & direct arterials.',
    isRecommended: true,
  };

  const shortestRoute = {
    name: 'Shortest Distance Path',
    distanceKm: Number((baseDistance * 0.92).toFixed(1)),
    durationMinutes: Number((baseDuration * 1.2).toFixed(1)),
    description: 'Shorter mileage through urban corridors; higher transit delay.',
    isRecommended: false,
  };

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
                Road Route & Distance Comparison
              </h1>
              {route?.isFallback ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--color-amber)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                  title="Computed using resilient deterministic Haversine formula"
                >
                  Resilient Fallback Mode
                </span>
              ) : (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  Live ORS Routing
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
              From <strong style={{ color: 'var(--text-primary)' }}>{transfer.sourceFacilityName || 'Source'}</strong> to{' '}
              <strong style={{ color: 'var(--color-primary)' }}>{transfer.destinationFacilityName}</strong>
            </p>
          </div>
        </div>

        <button onClick={fetchData} className="btn btn-secondary">
          <RefreshCw size={16} />
          Recalculate Route
        </button>
      </div>

      {/* Route Mode Comparison Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Fastest Option */}
        <div
          onClick={() => setSelectedRouteType('fastest')}
          className="glass-panel"
          style={{
            padding: '24px',
            cursor: 'pointer',
            border:
              selectedRouteType === 'fastest'
                ? '2px solid var(--color-primary)'
                : '1px solid var(--border-subtle)',
            backgroundColor:
              selectedRouteType === 'fastest'
                ? 'rgba(16, 185, 129, 0.08)'
                : 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1.15rem' }}>{fastestRoute.name}</h3>
            </div>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: 'var(--color-primary)',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              Recommended
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '12px 0 16px 0' }}>
            {fastestRoute.description}
          </p>

          <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Time</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                {fastestRoute.durationMinutes} mins
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Distance</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {fastestRoute.distanceKm} km
              </div>
            </div>
          </div>
        </div>

        {/* Shortest Option */}
        <div
          onClick={() => setSelectedRouteType('shortest')}
          className="glass-panel"
          style={{
            padding: '24px',
            cursor: 'pointer',
            border:
              selectedRouteType === 'shortest'
                ? '2px solid var(--color-cyan)'
                : '1px solid var(--border-subtle)',
            backgroundColor:
              selectedRouteType === 'shortest'
                ? 'rgba(6, 182, 212, 0.08)'
                : 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={20} color="var(--color-cyan)" />
              <h3 style={{ fontSize: '1.15rem' }}>{shortestRoute.name}</h3>
            </div>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--color-cyan)',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              Alternative
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '12px 0 16px 0' }}>
            {shortestRoute.description}
          </p>

          <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Time</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-cyan)' }}>
                {shortestRoute.durationMinutes} mins
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Distance</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-cyan)' }}>
                {shortestRoute.distanceKm} km
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Road Waypoints Visualizer */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RouteIcon size={20} color="var(--color-cyan)" />
            <h3 style={{ fontSize: '1.1rem' }}>Road Transit Corridors & Waypoints</h3>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Provider: <strong style={{ color: 'var(--text-primary)' }}>{route?.provider || 'DeterministicHaversine'}</strong>
          </div>
        </div>

        {/* Waypoints progression */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {route?.waypoints && route.waypoints.length > 0 ? (
            route.waypoints.map((wp, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: index === 0 ? 'var(--color-primary)' : index === route.waypoints.length - 1 ? 'var(--color-cyan)' : 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  {index + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{wp.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Lat: {wp.latitude.toFixed(4)}, Lon: {wp.longitude.toFixed(4)}
                  </div>
                </div>

                {index === 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                    Origin (Dispatch)
                  </span>
                )}
                {index === route.waypoints.length - 1 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-cyan)', fontWeight: 600 }}>
                    Destination (Receiving)
                  </span>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Direct transit corridor from {transfer.sourceFacilityName || 'Source'} to {transfer.destinationFacilityName}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
