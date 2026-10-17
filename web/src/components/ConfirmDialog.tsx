/**
 * SHARED REACT DESIGN SYSTEM - primary owner: Arudkumaran V. (IT24103011).
 *
 * Placeholder created by the Demand vertical (Sathurstiga S., IT24103156).
 * Replace with the owner's implementation on integration.
 *
 * Used before anything irreversible. A destructive action names what will be lost
 * rather than asking a bare "are you sure?".
 */
import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isDanger?: boolean;
  variant?: 'danger' | 'warning' | 'primary';
  busy?: boolean;
  isLoading?: boolean;
  isOpen?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isDanger = false,
  variant,
  busy = false,
  isLoading = false,
  isOpen = true,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (isOpen === false) {
    return null;
  }

  const isBusy = busy || isLoading;
  const isDestructive = destructive || isDanger || variant === 'danger';

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-title" className="dialog__title">
          {title}
        </h3>
        {message && (
          <p id="confirm-message" className="dialog__message">
            {message}
          </p>
        )}
        {children}
        <div className="dialog__actions">
          <button type="button" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDestructive ? 'button--destructive' : undefined}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


export default ConfirmDialog;
