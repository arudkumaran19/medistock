import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver, which Recharts' ResponsiveContainer
// requires on mount. Without it the chart components throw and take the surrounding
// page down with them. Charts have no measurable size in jsdom regardless, so a stub
// that reports zero is enough for the assertions in these tests.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;
