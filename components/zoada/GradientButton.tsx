'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

const GradientButton: React.FC<GradientButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className,
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const variantStyles = {
    primary: 'gradient-bg text-white shadow-lg hover:shadow-xl hover:brightness-110 active:brightness-95',
    outline: 'bg-transparent border border-black/15 text-[#1A1B25] hover:bg-black/5 active:bg-black/10',
    ghost: 'bg-black/5 text-[#1A1B25] hover:bg-black/10 active:bg-black/5',
  };

  return (
    <button
      className={cn(
        'rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 no-select',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className={cn(
          'w-5 h-5 rounded-full animate-spin border-2',
          variant === 'primary' ? 'border-white/30 border-t-white' : 'border-black/15 border-t-[#1A1B25]'
        )} />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

export default GradientButton;
