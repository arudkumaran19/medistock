/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011).
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156) only so the
 * demand feature can be built and tested against the shared component contract.
 * Replace with the owner's implementation on integration.
 */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      {label}
    </div>
  );
}

export default LoadingState;
