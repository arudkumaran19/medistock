import React from 'react';
import { TransferPriority, TransferStatus } from '../types/redistribution';

export interface StatusBadgeProps {
  status?: TransferStatus | string;
  label?: string;
  tone?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, tone }) => {
  if (status !== undefined) {
    return <span className={`status-badge status-${status}`}>{status}</span>;
  }
  const text = label ?? '';
  const currentTone = (tone ?? 'neutral').toLowerCase();
  return (
    <span className={`badge badge--${currentTone}`} data-tone={tone ?? 'neutral'}>
      {text}
    </span>
  );
};

export interface PriorityBadgeProps {
  priority: TransferPriority | string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  return <span className={`priority-badge priority-${priority}`}>{priority}</span>;
};

export default StatusBadge;
