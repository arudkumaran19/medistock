import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  children,
  onClick,
  type = 'button',
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    cursor: 'pointer',
    transition: 'all var(--duration-fast) var(--ease-smooth)',
    outline: 'none',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary-700)',
      color: 'var(--text-inverse)',
      borderColor: 'var(--color-primary-700)',
      boxShadow: 'var(--shadow-sm)',
    },
    secondary: {
      backgroundColor: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-strong)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'transparent',
    },
    danger: {
      backgroundColor: 'var(--color-danger-600)',
      color: 'var(--text-inverse)',
      borderColor: 'var(--color-danger-600)',
      boxShadow: 'var(--shadow-sm)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-600)',
      color: 'var(--text-inverse)',
      borderColor: 'var(--color-warning-600)',
      boxShadow: 'var(--shadow-sm)',
    },
    success: {
      backgroundColor: 'var(--color-success-700)',
      color: 'var(--text-inverse)',
      borderColor: 'var(--color-success-700)',
      boxShadow: 'var(--shadow-sm)',
    },
  };

  const sizes: Record<string, React.CSSProperties> = {
    sm: {
      height: 'var(--btn-height-sm)',
      padding: '0 var(--space-3)',
      fontSize: 'var(--text-xs)',
    },
    md: {
      height: 'var(--btn-height-md)',
      padding: '0 var(--space-4)',
      fontSize: 'var(--text-sm)',
    },
    lg: {
      height: 'var(--btn-height-lg)',
      padding: '0 var(--space-6)',
      fontSize: 'var(--text-base)',
    },
  };

  const disabledStyle: React.CSSProperties = {
    opacity: 'var(--disabled-opacity)',
    cursor: 'not-allowed',
    pointerEvents: 'none',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      style={{
        ...baseStyle,
        ...variants[variant],
        ...sizes[size],
        ...(fullWidth ? { width: '100%' } : {}),
        ...(disabled || isLoading ? disabledStyle : {}),
      }}
      disabled={disabled || isLoading}
      onClick={onClick}
      type={type}
      className={className}
    >
      {isLoading ? (
        <>
          <svg
            style={{ width: 16, height: 16 }}
            className="animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </motion.button>
  );
}
