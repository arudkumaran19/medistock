/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011).
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 *
 * An empty state says what is absent and what would fill it, rather than just
 * reporting nothing.
 */
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  label?: string;
  title?: string;
  hint?: string;
  description?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  label,
  title,
  hint,
  description,
  message,
  icon,
  action,
}: EmptyStateProps) {
  const displayTitle = title ?? label ?? 'Nothing to show.';
  const displayHint = description ?? hint ?? message;
  return (
    <div className="state state--empty" role="status">
      {icon && <span className="state__icon">{icon}</span>}
      <p className="state__title">{displayTitle}</p>
      {displayHint && <p className="state__message">{displayHint}</p>}
      {action}
    </div>
  );
}


export default EmptyState;
