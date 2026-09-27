import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading data...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: '16px',
        color: 'var(--text-secondary)',
      }}
    >
      <Loader2
        size={36}
        style={{
          animation: 'spin 1s linear infinite',
          color: 'var(--color-primary)',
        }}
      />
      <p style={{ fontSize: '0.95rem' }}>{message}</p>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
