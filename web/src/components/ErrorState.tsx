import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
}) => {
  return (
    <div
      className="glass-panel state state--error"
      role="alert"
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        borderLeft: '4px solid var(--color-rose, #f43f5e)',
        margin: '20px 0',
      }}
    >
      <AlertCircle size={40} color="var(--color-rose, #f43f5e)" />
      <div>
        <h3 className="state__title" style={{ fontSize: '1.1rem', marginBottom: '6px', color: '#f8fafc' }}>
          {title}
        </h3>
        <p className="state__message" style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} />
          Try again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
