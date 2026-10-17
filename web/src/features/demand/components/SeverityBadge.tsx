/**
 * Severity indicator.
 * Sathurstiga S. (IT24103156).
 *
 * Severity is carried by an icon, a shape and a text label - never by colour alone,
 * so it survives colour blindness, greyscale printing and forced-colours mode.
 *
 * Only HIGH and MEDIUM exist: those are the two levels the deterministic backend rule
 * produces (days of cover below lead time, or not). LOW and CRITICAL are deliberately
 * absent rather than invented - see ShortageRiskLevels in the API.
 */
import { Icon } from './Icon';

export function SeverityBadge({ level }: { level: string }) {
  const high = level.toUpperCase() === 'HIGH';

  return (
    <span className={`severity severity--${high ? 'high' : 'medium'}`}>
      <Icon name={high ? 'alert' : 'warning'} size={13} />
      {level}
    </span>
  );
}

/** Lifecycle state of an alert: OPEN, ACKNOWLEDGED or RESOLVED. */
export function StatusChip({ status }: { status: string }) {
  const key = status.toUpperCase();

  return (
    <span className={`status-chip status-chip--${key.toLowerCase()}`}>
      <Icon name={key === 'RESOLVED' ? 'check' : key === 'ACKNOWLEDGED' ? 'clock' : 'pulse'} size={12} />
      {status}
    </span>
  );
}

export default SeverityBadge;
