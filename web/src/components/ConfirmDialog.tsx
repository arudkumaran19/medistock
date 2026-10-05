import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen?: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  destructive?: boolean;
  isLoading?: boolean;
  busy?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen = true,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  destructive = false,
  isLoading = false,
  busy = false,
  children,
  onConfirm,
  onCancel,
}) => {
  if (isOpen === false) return null;

  const danger = isDanger || destructive;
  const loading = isLoading || busy;

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
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="glass-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          background: 'var(--bg-secondary, #1e293b)',
          boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.5))',
          position: 'relative',
          borderRadius: 'var(--radius-lg, 12px)',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            color: 'var(--text-muted, #94a3b8)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          disabled={loading}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-md, 8px)',
              background: danger ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: danger ? 'var(--color-rose, #f43f5e)' : 'var(--color-amber, #f59e0b)',
              display: 'flex',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 id="confirm-title" style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#f8fafc' }}>
              {title}
            </h3>
            <p id="confirm-message" style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              {message}
            </p>
            {children && <div style={{ marginTop: '16px' }}>{children}</div>}
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
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
