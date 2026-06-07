'use client';

import { type ElementType, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadoutModalProps {
  title: string;
  icon?: ElementType;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onBackdropClick?: () => void;
}

const MAX_WIDTH_CLASS = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
} as const;

export function LoadoutModal({
  title,
  icon: Icon,
  onClose,
  children,
  footer,
  maxWidth = 'lg',
  className,
  onBackdropClick,
}: LoadoutModalProps) {
  const handleBackdropClick = () => {
    if (onBackdropClick) {
      onBackdropClick();
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'flex max-h-[90vh] w-full flex-col overflow-hidden border border-white/10 bg-[#0b0f14] shadow-2xl shadow-black/70',
          MAX_WIDTH_CLASS[maxWidth],
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-destiny-gold/10 text-destiny-gold">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <h3 className="font-condensed truncate text-lg font-bold uppercase tracking-wide text-white">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="border-t border-white/10 px-4 py-3 sm:px-5">{footer}</div>
        )}
      </div>
    </div>
  );
}

interface LoadoutModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function LoadoutModalFooter({ children, className }: LoadoutModalFooterProps) {
  return (
    <div className={cn('flex justify-end gap-3', className)}>{children}</div>
  );
}

export function LoadoutSecondaryButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LoadoutPrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 bg-destiny-gold px-6 py-2 text-sm font-bold uppercase tracking-wider text-slate-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LoadoutGhostButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}
