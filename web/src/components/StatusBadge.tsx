/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011).
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 * Replace with the owner's implementation on integration.
 */
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: string }) {
  return (
    <span className={`badge badge--${tone.toLowerCase()}`} data-tone={tone}>
      {label}
    </span>
  );
}

export default StatusBadge;
