/** Status and priority badges for transfers. Redistribution vertical (Member 3). */
import type { TransferPriority, TransferStatus } from './api';

const STATUS_COLOURS: Record<TransferStatus, { fg: string; bg: string }> = {
  Draft: { fg: '#475569', bg: '#f1f5f9' },
  Requested: { fg: '#b45309', bg: '#fef3c7' },
  Proposed: { fg: '#b45309', bg: '#fef3c7' },
  Approved: { fg: '#1d4ed8', bg: '#dbeafe' },
  Reserved: { fg: '#1d4ed8', bg: '#dbeafe' },
  InTransit: { fg: '#0e7490', bg: '#cffafe' },
  Delivered: { fg: '#15803d', bg: '#dcfce7' },
  Rejected: { fg: '#b91c1c', bg: '#fee2e2' },
  Cancelled: { fg: '#64748b', bg: '#f1f5f9' },
};

const PRIORITY_COLOURS: Record<TransferPriority, { fg: string; bg: string }> = {
  Low: { fg: '#475569', bg: '#f1f5f9' },
  Medium: { fg: '#1d4ed8', bg: '#dbeafe' },
  High: { fg: '#b45309', bg: '#fef3c7' },
  Critical: { fg: '#b91c1c', bg: '#fee2e2' },
};

export function statusLabel(status: string): string {
  return status === 'InTransit' ? 'In transit' : status;
}

function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: fg,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const colours = STATUS_COLOURS[status] ?? STATUS_COLOURS.Draft;
  return <Pill text={statusLabel(status)} {...colours} />;
}

export function PriorityBadge({ priority }: { priority: TransferPriority }) {
  const colours = PRIORITY_COLOURS[priority] ?? PRIORITY_COLOURS.Medium;
  return <Pill text={priority} {...colours} />;
}
