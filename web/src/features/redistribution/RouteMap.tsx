/**
 * Offline route map for a transfer. Redistribution vertical (Member 3).
 *
 * The redistribution design used Leaflet with OpenStreetMap tiles, which need a network
 * connection and an extra package. This draws the same information - where the two
 * facilities are, the route between them, the distance and time - as an SVG over a
 * simplified outline of Sri Lanka, so it works offline and adds no dependency.
 *
 * Positions come from the backend's demonstration coordinates (RoutingService) and are
 * labelled as such: they are representative towns, not surveyed facility locations.
 */
import type { TransferRoute } from './api';

const WIDTH = 360;
const HEIGHT = 520;

// Bounding box of Sri Lanka, with a margin.
const BOUNDS = { minLat: 5.8, maxLat: 9.95, minLon: 79.5, maxLon: 82.0 };

// Simplified coastline, [longitude, latitude], clockwise from the northern tip.
const OUTLINE: Array<[number, number]> = [
  [80.05, 9.82], [80.28, 9.83], [80.62, 9.45], [80.92, 8.95], [81.2, 8.6], [81.38, 8.18],
  [81.62, 7.75], [81.88, 7.3], [81.82, 6.85], [81.6, 6.45], [81.3, 6.2], [80.95, 6.02],
  [80.6, 5.93], [80.22, 6.02], [80.05, 6.25], [79.88, 6.75], [79.83, 7.2], [79.8, 7.6],
  [79.72, 8.05], [79.86, 8.55], [79.92, 8.95], [79.98, 9.35], [80.05, 9.82],
];

function project(lat: number, lon: number): [number, number] {
  const x = ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * WIDTH;
  const y = HEIGHT - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * HEIGHT;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

export function RouteMap({ route }: { route: TransferRoute }) {
  const outline = OUTLINE.map(([lon, lat]) => project(lat, lon).join(',')).join(' ');
  const [sx, sy] = project(route.sourceLatitude, route.sourceLongitude);
  const [dx, dy] = project(route.destinationLatitude, route.destinationLongitude);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 360px) 1fr', gap: 'var(--space-5, 20px)', alignItems: 'start' }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Route from ${route.sourceFacilityName} to ${route.destinationFacilityName}, ${route.distanceKm} km`}
        style={{ width: '100%', height: 'auto', background: 'var(--accent-wash, #ecfdf5)', borderRadius: 12 }}
      >
        <polygon points={outline} fill="var(--surface, #ffffff)" stroke="var(--border-strong, #94a3b8)" strokeWidth={1.5} />
        <line x1={sx} y1={sy} x2={dx} y2={dy} stroke="var(--series-1, #0f766e)" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" />
        <circle cx={sx} cy={sy} r={9} fill="#16a34a" stroke="#fff" strokeWidth={2.5} />
        <circle cx={dx} cy={dy} r={9} fill="#dc2626" stroke="#fff" strokeWidth={2.5} />
        <text x={sx + 13} y={sy + 4} fontSize={13} fontWeight={700} fill="var(--text, #0f172a)">{route.sourceFacilityName}</text>
        <text x={dx + 13} y={dy + 4} fontSize={13} fontWeight={700} fill="var(--text, #0f172a)">{route.destinationFacilityName}</text>
      </svg>

      <div className="stack" style={{ gap: 'var(--space-3, 12px)' }}>
        <div>
          <div className="cell-secondary">Distance</div>
          <div className="cell-emphasis" style={{ fontSize: 24 }}>{route.distanceKm} km</div>
        </div>
        <div>
          <div className="cell-secondary">Estimated transit</div>
          <div className="cell-emphasis" style={{ fontSize: 24 }}>~{Math.round(route.durationMinutes)} mins</div>
        </div>
        <div>
          <div className="cell-secondary">From</div>
          <div><span style={{ color: '#16a34a' }}>●</span> {route.sourceFacilityName}</div>
        </div>
        <div>
          <div className="cell-secondary">To</div>
          <div><span style={{ color: '#dc2626' }}>●</span> {route.destinationFacilityName}</div>
        </div>
        <span className="badge">{route.provider}</span>
        <p className="cell-secondary" style={{ margin: 0 }}>
          Locations are demonstration coordinates at representative towns, and the distance is a
          road estimate from straight-line distance. They are not surveyed facility positions.
        </p>
      </div>
    </div>
  );
}
