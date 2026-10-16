/**
 * Skeleton loading states.
 * Sathurstiga S. (IT24103156).
 *
 * The skeleton mirrors the shape of what is coming, so the layout does not jump when
 * data lands.
 *
 * Accessibility: the visual placeholders are decorative and hidden from assistive
 * technology. One SkeletonRegion per page carries role="status" and a visible-to-
 * screen-readers label, so a blind user hears "Loading shortage alerts" once rather
 * than a chorus of empty status nodes.
 *
 * The shimmer is suppressed under prefers-reduced-motion (see components.css).
 */
import type { ReactNode } from 'react';

/** The single live region for a loading page. */
export function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="stack">
      <span className="visually-hidden">{label}</span>
      <div aria-hidden="true" className="stack">
        {children}
      </div>
    </div>
  );
}

export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="metrics">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="metric metric--skeleton">
          <div className="skeleton skeleton--line" style={{ width: '45%' }} />
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--line" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="skeleton-chart">
      {[38, 62, 48, 80, 55, 70, 44, 66].map((height, index) => (
        <div
          key={index}
          className="skeleton skeleton--bar"
          style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="skeleton-table__row" style={{ animationDelay: `${row * 50}ms` }}>
          {Array.from({ length: columns }, (_, column) => (
            <div
              key={column}
              className="skeleton skeleton--line"
              style={{ width: column === 0 ? '60%' : '80%' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <>
      <div className="skeleton skeleton--heading" style={{ width: '38%' }} />
      <div className="skeleton skeleton--line" style={{ width: '62%' }} />
      <div className="panel">
        <div className="panel__body">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="skeleton skeleton--line"
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
