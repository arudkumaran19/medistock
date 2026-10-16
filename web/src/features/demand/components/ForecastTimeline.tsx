/**
 * Forecast timeline.
 * Sathurstiga S. (IT24103156).
 *
 * Lays the derivation out in time order so the gap between stockout and replenishment
 * is something you see rather than something you calculate. Every marker is a figure
 * the backend produced - nothing here is estimated in the browser.
 */
import { Icon, type IconName } from './Icon';

interface Step {
  key: string;
  label: string;
  detail: string;
  icon: IconName;
  tone?: 'critical' | 'caution';
}

export function ForecastTimeline({
  averageDailyConsumption,
  currentStock,
  daysRemaining,
  leadTimeDays,
  projectedStockout,
}: {
  averageDailyConsumption: number;
  currentStock: number | null;
  daysRemaining: number | null;
  leadTimeDays: number;
  projectedStockout: string | null;
}) {
  const steps: Step[] = [
    {
      key: 'today',
      label: 'Today',
      detail:
        currentStock === null
          ? 'Stock on hand is held by the Inventory vertical'
          : `${currentStock.toLocaleString()} units on hand`,
      icon: 'package',
    },
    {
      key: 'rate',
      label: 'Consumption',
      detail: `${averageDailyConsumption.toLocaleString()} units per day`,
      icon: 'activity',
    },
    {
      key: 'lead',
      label: 'Replenishment window',
      detail: `${leadTimeDays} day supplier lead time`,
      icon: 'clock',
    },
    {
      key: 'stockout',
      label: 'Projected stockout',
      detail:
        daysRemaining === null
          ? 'No stockout projected at this rate'
          : `${daysRemaining} days of cover${projectedStockout ? ` · ${projectedStockout}` : ''}`,
      icon: daysRemaining !== null && daysRemaining < leadTimeDays ? 'alert' : 'check',
      tone:
        daysRemaining !== null && daysRemaining < leadTimeDays ? 'critical' : undefined,
    },
  ];

  return (
    <ol className="timeline">
      {steps.map((step) => (
        <li key={step.key} className={step.tone ? `timeline__step timeline__step--${step.tone}` : 'timeline__step'}>
          <span className="timeline__marker">
            <Icon name={step.icon} size={14} />
          </span>
          <div>
            <p className="timeline__label">{step.label}</p>
            <p className="timeline__detail">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default ForecastTimeline;
