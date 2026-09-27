/**
 * Shortage risk distribution.
 * Sathurstiga S. (IT24103156).
 *
 * A proportion split across two known categories, so it is a stacked bar rather than a
 * chart library call: a pie or donut for two values reads worse and costs a render
 * pass. The numbers are written on the rows, so the bar supports the figures rather
 * than replacing them.
 *
 * Only the two severity levels the backend actually produces appear here.
 */
import { Icon } from './Icon';

export function RiskDistribution({
  high,
  medium,
}: {
  high: number;
  medium: number;
}) {
  const total = high + medium;

  if (total === 0) {
    return null;
  }

  const highShare = Math.round((high / total) * 100);

  return (
    <div className="risk-dist">
      <div
        className="risk-dist__bar"
        role="img"
        aria-label={`${high} of ${total} alerts are high severity, ${medium} are medium.`}
      >
        {high > 0 && (
          <span
            className="risk-dist__segment risk-dist__segment--high"
            style={{ width: `${highShare}%` }}
          />
        )}
        {medium > 0 && (
          <span
            className="risk-dist__segment risk-dist__segment--medium"
            style={{ width: `${100 - highShare}%` }}
          />
        )}
      </div>

      <ul className="risk-dist__legend">
        <li>
          <span className="risk-dist__swatch risk-dist__swatch--high">
            <Icon name="alert" size={12} />
          </span>
          <span className="risk-dist__name">High</span>
          <span className="risk-dist__count">{high}</span>
          <span className="risk-dist__share">
            {total > 0 ? `${highShare}%` : '—'}
          </span>
        </li>
        <li>
          <span className="risk-dist__swatch risk-dist__swatch--medium">
            <Icon name="warning" size={12} />
          </span>
          <span className="risk-dist__name">Medium</span>
          <span className="risk-dist__count">{medium}</span>
          <span className="risk-dist__share">
            {total > 0 ? `${100 - highShare}%` : '—'}
          </span>
        </li>
      </ul>
    </div>
  );
}

export default RiskDistribution;
