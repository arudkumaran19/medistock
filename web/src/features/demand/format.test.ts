/**
 * Presentation helper tests.
 * Sathurstiga S. (IT24103156).
 */
import { describe, expect, it } from 'vitest';
import { explainRisk, formatDate, formatDaysRemaining, formatNumber, formatPercent } from './format';
import { shortageAlert } from './testUtils';

describe('formatDate', () => {
  it('renders an ISO 8601 timestamp as a plain date', () => {
    expect(formatDate('2026-09-27T00:00:00Z')).toBe('2026-09-27');
  });

  it.each([null, undefined, 'not-a-date'])('renders %s as a dash', (value) => {
    expect(formatDate(value as string | null)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('renders a whole number without decimals', () => {
    expect(formatNumber(120)).toBe('120');
  });

  it('renders a dash for a missing value', () => {
    expect(formatNumber(null)).toBe('—');
  });

  it('renders zero as zero rather than a dash', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('renders a confidence score as a percentage', () => {
    expect(formatPercent(0.82)).toBe('82%');
  });

  it('renders full confidence as 100%', () => {
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('formatDaysRemaining', () => {
  it('renders the blueprint example', () => {
    expect(formatDaysRemaining(6)).toBe('6 days');
  });

  it('uses the singular for one day', () => {
    expect(formatDaysRemaining(1)).toBe('1 day');
  });

  it('renders zero days as an imminent stockout, not as missing data', () => {
    expect(formatDaysRemaining(0)).toBe('0 days');
  });

  it('renders null as no projected stockout', () => {
    // Null means nothing is being consumed. It must never read as zero days.
    expect(formatDaysRemaining(null)).toBe('No stockout projected');
  });
});

describe('explainRisk', () => {
  it('explains a shortage against the lead time', () => {
    expect(explainRisk(shortageAlert())).toContain(
      '6 days of cover is less than the 10 day lead time',
    );
  });

  it('explains sufficient cover', () => {
    const alert = shortageAlert({ daysRemaining: 20, requiresTransfer: false, riskLevel: 'MEDIUM' });

    expect(explainRisk(alert)).toContain('20 days of cover meets the 10 day lead time');
  });

  it('explains the absence of consumption', () => {
    const alert = shortageAlert({ daysRemaining: null, averageDailyConsumption: 0 });

    expect(explainRisk(alert)).toContain('No consumption is recorded');
  });
});
