'use client';

import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KofiButtonProps {
  variant?: 'default' | 'compact' | 'text';
  className?: string;
}

const KOFI_URL = 'https://ko-fi.com/roberttgreat';

export function KofiButton({ variant = 'default', className }: KofiButtonProps) {
  if (variant === 'compact') {
    return (
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all",
          "bg-[#FF5E5B]/10 text-[#FF5E5B] hover:bg-[#FF5E5B]/20 border border-[#FF5E5B]/20",
          className
        )}
      >
        <Heart className="w-4 h-4 fill-current" />
        <span>Support</span>
      </a>
    );
  }

  if (variant === 'text') {
    return (
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#FF5E5B] transition-colors",
          className
        )}
      >
        <Heart className="w-3.5 h-3.5" />
        <span>Support on Ko-fi</span>
      </a>
    );
  }

  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2.5 font-medium transition-all",
        "bg-[#FF5E5B] text-white hover:bg-[#FF5E5B]/90 hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      <Heart className="w-5 h-5 fill-current" />
      <span>Support on Ko-fi</span>
    </a>
  );
}

