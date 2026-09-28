/**
 * KPI tile for the Demand & Shortage dashboards.
 * Sathurstiga S. (IT24103156).
 *
 * The value animates from its previous figure so a refresh reads as a change rather
 * than a flicker. The count-up is skipped entirely under prefers-reduced-motion, and
 * for non-numeric values such as a date.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const COUNT_UP_MS = 420;

/**
 * Defaults to "reduce" when the preference cannot be read.
 *
 * If we cannot ask, the safe answer is not to animate: an unwanted animation is a
 * worse failure than a missing one, and it keeps the final value on screen
 * immediately in environments without matchMedia, such as jsdom.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Eases out so the number settles rather than stopping dead. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  // React 19 requires an explicit initial value for useRef.
  const frame = useRef<number | undefined>(undefined);
  const from = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const origin = from.current;

    function tick(now: number) {
      const progress = Math.min((now - start) / COUNT_UP_MS, 1);
      setValue(Math.round(origin + (target - origin) * easeOut(progress)));

      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        from.current = target;
      }
    }

    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, enabled]);

  return value;
}

export type MetricTone = 'neutral' | 'critical' | 'caution' | 'positive';

export function MetricCard({
  label,
  value,
  unit,
  note,
  icon,
  tone = 'neutral',
  index = 0,
}: {
  label: string;
  /** A number counts up; a string (a date, say) renders as-is. */
  value: number | string;
  unit?: string;
  note?: ReactNode;
  icon: IconName;
  tone?: MetricTone;
  /** Position in the row, used to stagger the entrance. */
  index?: number;
}) {
  const isNumeric = typeof value === 'number';
  const animate = isNumeric && !prefersReducedMotion();
  const counted = useCountUp(isNumeric ? value : 0, animate);

  return (
    <article
      className={`metric metric--${tone}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="metric__top">
        <span className="metric__icon">
          <Icon name={icon} size={17} />
        </span>
        <h3 className="metric__label">{label}</h3>
      </div>

      <p className={isNumeric ? 'metric__value' : 'metric__value metric__value--text'}>
        {isNumeric ? counted.toLocaleString() : value}
        {unit && <span className="metric__unit">{unit}</span>}
      </p>

      {note && <p className="metric__note">{note}</p>}
    </article>
  );
}

export default MetricCard;
