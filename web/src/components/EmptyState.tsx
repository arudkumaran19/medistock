import React from 'react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There are no active items matching the current filter criteria.',
  action,
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        color: 'var(--text-muted)',
      }}
    >
      <PackageOpen size={48} strokeWidth={1.5} color="var(--text-secondary)" />
      <div>
        <h4 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '4px' }}>
          {title}
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>
          {description}
        </p>
      </div>
      {action && (
        <button onClick={action.onClick} className="btn btn-primary" style={{ marginTop: '8px' }}>
          {action.label}
        </button>
      )}
    </div>
  );
};
