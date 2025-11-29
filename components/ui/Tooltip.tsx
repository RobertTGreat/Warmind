'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  delay?: number;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}

export function Tooltip({
  children,
  content,
  side = 'right',
  align = 'center',
  delay = 200,
  className,
  contentClassName,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  // Calculate position when tooltip becomes visible
  useEffect(() => {
    if (!isVisible || !triggerRef.current) return;

    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const gap = 8; // Gap between trigger and tooltip

    let x = 0;
    let y = 0;

    // Calculate position based on side
    switch (side) {
      case 'right':
        x = rect.right + gap;
        y = rect.top + rect.height / 2;
        break;
      case 'left':
        x = rect.left - gap;
        y = rect.top + rect.height / 2;
        break;
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - gap;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + gap;
        break;
    }

    setPosition({ x, y });
  }, [isVisible, side]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Animation variants based on side
  const variants = {
    initial: {
      opacity: 0,
      scale: 0.95,
      x: side === 'right' ? -4 : side === 'left' ? 4 : 0,
      y: side === 'top' ? 4 : side === 'bottom' ? -4 : 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      x: side === 'right' ? -4 : side === 'left' ? 4 : 0,
      y: side === 'top' ? 4 : side === 'bottom' ? -4 : 0,
    },
  };

  // Transform origin based on side
  const originMap = {
    right: 'left center',
    left: 'right center',
    top: 'bottom center',
    bottom: 'top center',
  };

  // Translate to center tooltip on the axis perpendicular to side
  const translateMap = {
    right: 'translateY(-50%)',
    left: 'translateX(-100%) translateY(-50%)',
    top: 'translateX(-50%) translateY(-100%)',
    bottom: 'translateX(-50%)',
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={cn('inline-flex', className)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'fixed z-[100] pointer-events-none',
              'px-3 py-1.5 rounded-md',
              'bg-slate-800 border border-white/10',
              'text-sm font-medium text-white',
              'shadow-lg shadow-black/20',
              contentClassName
            )}
            style={{
              left: position.x,
              top: position.y,
              transform: translateMap[side],
              transformOrigin: originMap[side],
            }}
          >
            {/* Arrow */}
            <div
              className={cn(
                'absolute w-2 h-2 bg-slate-800 border-white/10 rotate-45',
                side === 'right' && 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-b',
                side === 'left' && 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-r border-t',
                side === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b',
                side === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t',
              )}
            />
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Simple wrapper for common use case
interface SimpleTooltipProps {
  children: ReactNode;
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

export function SimpleTooltip({ children, label, ...props }: SimpleTooltipProps) {
  return (
    <Tooltip content={label} {...props}>
      {children}
    </Tooltip>
  );
}

