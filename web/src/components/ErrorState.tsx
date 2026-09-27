import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message,
  onRetry,
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        borderLeft: '4px solid var(--color-rose)',
        margin: '20px 0',
      }}
    >
      <AlertCircle size={40} color="var(--color-rose)" />
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary">
          <RefreshCw size={16} />
          Retry Request
        </button>
      )}
    </div>
  );
};
