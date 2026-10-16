/**
 * Hover tooltip shared by the demand charts.
 * Sathurstiga S. (IT24103156).
 *
 * An HTML chart is interactive by default, so every mark gets a readable value on
 * hover rather than forcing the reader to estimate against the axis. Values wear text
 * tokens; the series colour stays on the mark.
 */
interface TooltipPayloadEntry {
  value?: number | string;
  name?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const entry = payload[0];
  const value = typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      <p className="chart-tooltip__value">
        {value}
        {unit ? ` ${unit}` : ''}
      </p>
    </div>
  );
}

export default ChartTooltip;
