/**
 * The Demand &amp; Shortage chain, shown as a breadcrumb so a manager can see which
 * stage of the derivation a page belongs to.
 * Sathurstiga S. (IT24103156).
 *
 *   consumption -> forecast -> projected stockout -> shortage alert
 */
const STEPS = [
  { id: 'consumption', label: 'Consumption' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'stockout', label: 'Projected stockout' },
  { id: 'alert', label: 'Shortage alert' },
] as const;

export type ChainStep = (typeof STEPS)[number]['id'];

export function DemandChain({ active }: { active: ChainStep }) {
  return (
    <p className="chain">
      {STEPS.map((step, index) => (
        <span key={step.id}>
          {index > 0 && (
            <span className="chain__arrow" aria-hidden="true">
              {' → '}
            </span>
          )}
          <span
            className="chain__step"
            style={
              step.id === active
                ? { color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }
                : undefined
            }
          >
            {step.label}
          </span>
        </span>
      ))}
    </p>
  );
}

export default DemandChain;
