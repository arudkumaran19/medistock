import React from 'react';

export function StatusBadge({
  status,
  label,
  tone = 'neutral',
}: {
  status?: string;
  label?: string;
  tone?: string;
}) {
  const text = label ?? status ?? '';
  const effectiveTone = tone || (status ? status.toLowerCase() : 'neutral');
  return (
    <span className={`badge badge--${effectiveTone} status-badge status-${status ?? ''}`} data-tone={effectiveTone}>
      {text}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`priority-badge priority-${priority}`}>{priority}</span>;
}

export default StatusBadge;
