import React, { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  label?: string;
  description?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode | { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  label,
  description,
  hint,
  icon,
  action,
}) => {
  const displayTitle = title ?? label ?? 'No records found';
  const displayDesc = description ?? hint ?? 'There are no active items matching the current filter criteria.';

  const renderAction = () => {
    if (!action) return null;
    if (React.isValidElement(action)) {
      return action;
    }
    if (typeof action === 'object' && 'label' in action && 'onClick' in action) {
      return (
        <button
          type="button"
          onClick={(action as { onClick: () => void }).onClick}
          className="btn btn-primary"
          style={{ marginTop: '8px' }}
        >
          {(action as { label: string }).label}
        </button>
      );
    }
    return action as ReactNode;
  };

  return (
    <div
      className="glass-panel state state--empty"
      role="status"
      style={{
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        color: 'var(--text-muted, #94a3b8)',
      }}
    >
      {icon ? (
        <span className="state__icon">{icon}</span>
      ) : (
        <PackageOpen size={48} strokeWidth={1.5} color="var(--text-secondary, #94a3b8)" />
      )}
      <div>
        <h4 className="state__title" style={{ color: 'var(--text-primary, #f8fafc)', fontSize: '1.1rem', marginBottom: '4px' }}>
          {displayTitle}
        </h4>
        <p className="state__message" style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', maxWidth: '420px', margin: '0 auto' }}>
          {displayDesc}
        </p>
      </div>
      {renderAction()}
    </div>
  );
};

export default EmptyState;
