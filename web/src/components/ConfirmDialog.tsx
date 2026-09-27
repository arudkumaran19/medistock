import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          background: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            color: 'var(--text-muted)',
          }}
          disabled={isLoading}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              background: isDanger ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: isDanger ? 'var(--color-rose)' : 'var(--color-amber)',
              display: 'flex',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              {message}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <button onClick={onCancel} className="btn btn-secondary" disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
