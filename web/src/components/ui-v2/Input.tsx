import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`flex flex-col gap-2 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-[var(--text-primary)]"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary]">
            {leftIcon}
          </div>
        )}
        
        <input
          id={inputId}
          className={`
            w-full h-10 px-3 text-sm
            bg-white border rounded-lg
            text-[var(--text-primary)]
            border-[var(--border-strong)]
            placeholder:text-[var(--text-tertiary)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent
            transition-all duration-150
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${error ? 'border-[var(--color-danger-500)] focus:ring-[var(--color-danger-500)]' : ''}
            ${className}
          `}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary]">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-xs text-[var(--color-danger-700)] font-medium">
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p className="text-xs text-[var(--text-tertiary)]">
          {helperText}
        </p>
      )}
    </div>
  );
}
