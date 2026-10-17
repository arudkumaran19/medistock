import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'ai';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  const variants = {
    default: 'bg-[var(--color-slate-100)] text-[var(--color-slate-700)] border-[var(--color-slate-200)]',
    primary: 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-200)]',
    success: 'bg-[var(--color-success-100)] text-[var(--color-success-700)] border-[var(--color-success-200)]',
    warning: 'bg-[var(--color-warning-100)] text-[var(--color-warning-700)] border-[var(--color-warning-200)]',
    danger: 'bg-[var(--color-danger-100)] text-[var(--color-danger-700)] border-[var(--color-danger-200)]',
    info: 'bg-[var(--color-info-100)] text-[var(--color-info-700)] border-[var(--color-info-200)]',
    ai: 'bg-[var(--color-ai-100)] text-[var(--color-ai-700)] border-[var(--color-ai-200)]',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-semibold rounded-full border
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
