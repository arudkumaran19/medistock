import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'glass' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export function Card({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  hover = false,
}: CardProps) {
  const baseStyles = 'rounded-xl bg-white';
  
  const variants = {
    default: 'border border-[var(--border-default)] shadow-sm',
    elevated: 'border border-[var(--border-default)] shadow-lg',
    glass: `
      bg-[var(--glass-bg)]
      backdrop-blur-[var(--glass-blur)]
      border border-[var(--glass-border)]
      shadow-[var(--glass-shadow)]
    `,
    bordered: 'border-2 border-[var(--border-strong)]',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <motion.div
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : {}}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${paddings[padding]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`font-display font-bold text-[var(--text-primary)] text-lg ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[var(--text-secondary)] text-sm mt-1 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-[var(--border-default)] ${className}`}>
      {children}
    </div>
  );
}
