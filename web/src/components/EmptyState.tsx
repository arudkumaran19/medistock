/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011).
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 *
 * An empty state says what is absent and what would fill it, rather than just
 * reporting nothing.
 */
import type { ReactNode } from 'react';

export function EmptyState({
  label = 'Nothing to show.',
  hint,
  icon,
  action,
}: {
  label?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state state--empty" role="status">
      {icon && <span className="state__icon">{icon}</span>}
      <p className="state__title">{label}</p>
      {hint && <p className="state__message">{hint}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
