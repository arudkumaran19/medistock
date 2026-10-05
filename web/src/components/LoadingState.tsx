import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  label?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message, label }) => {
  const text = message ?? label ?? 'Loading...';

  return (
    <div
      className="state state--loading"
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: '16px',
        color: 'var(--text-secondary, #94a3b8)',
      }}
    >
      <Loader2
        size={36}
        style={{
          animation: 'spin 1s linear infinite',
          color: 'var(--color-primary, #0ea5e9)',
        }}
      />
      <p style={{ fontSize: '0.95rem', margin: 0 }}>{text}</p>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingState;
