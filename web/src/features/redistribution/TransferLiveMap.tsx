import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Clock } from 'lucide-react';

interface TransferLiveMapProps {
  sourceFacilityName: string;
  sourceCoords: [number, number]; // [lat, lng]
  destinationFacilityName: string;
  destinationCoords: [number, number]; // [lat, lng]
  vehicleCoords?: [number, number] | null; // [lat, lng]
  waypoints?: Array<{ latitude: number; longitude: number; label: string }>;
  distanceKm?: number;
  durationMinutes?: number;
  status: string;
}

// Custom DivIcons for crisp SVG rendering without external image dependencies
const createSourceIcon = (_name: string) =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div style="
        background: #10b981;
        color: white;
        border: 2px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        border-radius: 50%;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6v12M6 12h12"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const createDestIcon = (_name: string) =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div style="
        background: #f43f5e;
        color: white;
        border: 2px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        border-radius: 50%;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const createVehicleIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
        <span style="
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: rgba(6, 182, 212, 0.4);
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></span>
        <div style="
          background: #06b6d4;
          color: white;
          border: 2px solid white;
          box-shadow: 0 4px 14px rgba(6,182,212,0.6);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  });

// Component to dynamically fit bounds of the map to visible points
function BoundsController({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    try {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } catch {
      // ignore
    }
  }, [map, points]);

  return null;
}

export const TransferLiveMap: React.FC<TransferLiveMapProps> = ({
  sourceFacilityName,
  sourceCoords,
  destinationFacilityName,
  destinationCoords,
  vehicleCoords,
  waypoints = [],
  distanceKm,
  durationMinutes,
  status,
}) => {
  // Construct polyline points: source -> waypoints -> destination
  const polylinePoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [sourceCoords];
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach((w) => {
        pts.push([w.latitude, w.longitude]);
      });
    }
    pts.push(destinationCoords);
    return pts;
  }, [sourceCoords, destinationCoords, waypoints]);

  const allPoints = useMemo<[number, number][]>(() => {
    const pts = [...polylinePoints];
    if (vehicleCoords) {
      pts.push(vehicleCoords);
    }
    return pts;
  }, [polylinePoints, vehicleCoords]);

  const sourceIcon = useMemo(() => createSourceIcon(sourceFacilityName), [sourceFacilityName]);
  const destIcon = useMemo(() => createDestIcon(destinationFacilityName), [destinationFacilityName]);
  const vehicleIcon = useMemo(() => createVehicleIcon(), []);

  const isJSDOM =
    typeof navigator !== 'undefined' &&
    (navigator.userAgent?.includes('jsdom') || navigator.userAgent?.includes('Node.js'));

  if (isJSDOM) {
    return (
      <div
        data-testid="transfer-live-map"
        style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          padding: '24px',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px', color: '#06b6d4' }}>
          Live Operational Map (OpenStreetMap)
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
          Origin: {sourceFacilityName} &rarr; Destination: {destinationFacilityName}
        </div>
        {vehicleCoords && (
          <div style={{ marginTop: '10px', color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>
            Live Vehicle GPS: {vehicleCoords[0].toFixed(5)}, {vehicleCoords[1].toFixed(5)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '420px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        // Fallback plain background in case OpenStreetMap tile server is unreachable
        backgroundColor: '#0f172a',
      }}
    >
      <MapContainer
        center={sourceCoords}
        zoom={10}
        scrollWheelZoom={false}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0f172a', // Plain fallback background behind tiles
        }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <BoundsController points={allPoints} />

        {/* Route Polyline */}
        <Polyline
          positions={polylinePoints}
          pathOptions={{
            color: '#06b6d4',
            weight: 5,
            opacity: 0.85,
            dashArray: status === 'InTransit' ? undefined : '6, 8',
          }}
        />

        {/* Source Facility Marker */}
        <Marker position={sourceCoords} icon={sourceIcon}>
          <Popup>
            <div style={{ color: '#0f172a', fontWeight: 600 }}>
              <div>Origin (Depot):</div>
              <div style={{ color: '#059669', fontSize: '1.05em' }}>{sourceFacilityName}</div>
              <div style={{ fontSize: '0.85em', color: '#64748b' }}>
                {sourceCoords[0].toFixed(4)}, {sourceCoords[1].toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Destination Facility Marker */}
        <Marker position={destinationCoords} icon={destIcon}>
          <Popup>
            <div style={{ color: '#0f172a', fontWeight: 600 }}>
              <div>Destination (Shortage Facility):</div>
              <div style={{ color: '#e11d48', fontSize: '1.05em' }}>{destinationFacilityName}</div>
              <div style={{ fontSize: '0.85em', color: '#64748b' }}>
                {destinationCoords[0].toFixed(4)}, {destinationCoords[1].toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Live Vehicle Marker */}
        {vehicleCoords && (
          <Marker position={vehicleCoords} icon={vehicleIcon}>
            <Popup>
              <div style={{ color: '#0f172a', fontWeight: 600 }}>
                <div style={{ color: '#0284c7', fontSize: '1.05em' }}>Field Officer Vehicle</div>
                <div>Status: In Transit</div>
                <div style={{ fontSize: '0.85em', color: '#64748b' }}>
                  GPS: {vehicleCoords[0].toFixed(5)}, {vehicleCoords[1].toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Uber-Eats-style ETA & Transit Status Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '10px',
          padding: '12px 18px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Est. Transit
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              {durationMinutes ? `~${Math.round(durationMinutes)} mins` : '--'}
            </div>
          </div>
        </div>

        <div style={{ width: '1px', height: '28px', background: 'rgba(255, 255, 255, 0.15)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={18} color="#06b6d4" />
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Distance Left
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              {distanceKm ? `${distanceKm.toFixed(1)} km` : '--'}
            </div>
          </div>
        </div>

        {status === 'InTransit' && (
          <>
            <div style={{ width: '1px', height: '28px', background: 'rgba(255, 255, 255, 0.15)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                  boxShadow: '0 0 8px #22c55e',
                }}
              />
              <span style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 600 }}>Live GPS Active</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TransferLiveMap;
