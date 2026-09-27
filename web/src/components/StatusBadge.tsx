import React from 'react';
import { TransferPriority, TransferStatus } from '../types/redistribution';

interface StatusBadgeProps {
  status: TransferStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return <span className={`status-badge status-${status}`}>{status}</span>;
};

interface PriorityBadgeProps {
  priority: TransferPriority;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  return <span className={`priority-badge priority-${priority}`}>{priority}</span>;
};
