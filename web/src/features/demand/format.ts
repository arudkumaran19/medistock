/**
 * Presentation helpers for the Demand & Shortage feature.
 * Sathurstiga S. (IT24103156).
 *
 * Formatting only. Every number displayed is produced by the backend.
 */
import type { ShortageAlert, ShortageScanResult } from '@/types/demand';

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10);
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return `${Math.round(value * 100)}%`;
}

/**
 * Days of cover, or an explicit "no stockout projected" when nothing is being used.
 * A null here is not zero days, and must never read as one.
 */
export function formatDaysRemaining(daysRemaining: number | null): string {
  if (daysRemaining === null) {
    return 'No stockout projected';
  }

  return daysRemaining === 1 ? '1 day' : `${daysRemaining} days`;
}

/** Plain-language explanation of why an alert was or was not raised. */
export function explainRisk(alert: ShortageAlert): string {
  if (alert.daysRemaining === null) {
    return 'No consumption is recorded for this medicine, so no stockout is projected.';
  }

  if (alert.requiresTransfer) {
    return (
      `${alert.daysRemaining} days of cover is less than the ${alert.leadTimeDays} day ` +
      'lead time, so stock will run out before replenishment arrives.'
    );
  }

  return (
    `${alert.daysRemaining} days of cover meets the ${alert.leadTimeDays} day lead time, ` +
    'so stock is projected to last until replenishment arrives.'
  );
}

/** Shown on the detail page when raising refreshed an existing alert. */
export const EXISTING_ALERT_UPDATED_NOTICE =
  'Existing alert updated: an open alert for this medicine and facility already existed, ' +
  'so it was recalculated instead of creating a duplicate.';

/** One line a manager can read at a glance after "Scan now". */
export function describeScan(result: ShortageScanResult): string {
  const parts = [
    `${result.evaluated} checked`,
    `${result.created} new`,
    `${result.updated} updated`,
    `${result.resolved} resolved`,
  ];

  if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
  if (result.failed > 0) parts.push(`${result.failed} failed`);

  return `Scan complete: ${parts.join(', ')}.`;
}
