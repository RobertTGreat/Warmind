'use client';

import { ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WrappedCardProps {
  children: ReactNode;
  className?: string;
  background?: string;
  accentColor?: string;
}

export function WrappedCard({ 
  children, 
  className,
  background,
  accentColor = '#e3ce62',
}: WrappedCardProps) {
  return (
    <div 
      className={cn(
        "relative w-full h-full min-h-[600px] overflow-hidden",
        "bg-linear-to-br from-slate-900 via-slate-800 to-slate-900",
        "border border-white/10 shadow-2xl",
        className
      )}
      style={{
        background: background || undefined,
      }}
    >
      {/* Ambient glow effects */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 20% 20%, ${accentColor}40 0%, transparent 40%),
                       radial-gradient(circle at 80% 80%, ${accentColor}30 0%, transparent 40%)`,
        }}
      />
      
      {/* Noise texture */}
      <div className="absolute inset-0 bg-noise-animated opacity-5" />
      
      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

interface StatBlockProps {
  label: string;
  value: string | number;
  subtext?: string;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function StatBlock({ 
  label, 
  value, 
  subtext, 
  accentColor = '#e3ce62',
  size = 'md',
  className,
}: StatBlockProps) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("text-center", className)}
    >
      <p className="text-sm text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <p 
        className={cn("font-bold tracking-tight", sizeClasses[size])}
        style={{ color: accentColor }}
      >
        {value}
      </p>
      {subtext && (
        <p className="text-sm text-slate-500 mt-1">{subtext}</p>
      )}
    </motion.div>
  );
}

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  decimals?: number;
}

export function AnimatedCounter({ 
  value, 
  duration = 2, 
  suffix = '', 
  prefix = '',
  className,
  decimals = 0,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(eased * value);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  const formattedValue = decimals > 0 
    ? displayValue.toFixed(decimals) 
    : Math.round(displayValue).toLocaleString();

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={className}
    >
      {prefix}{formattedValue}{suffix}
    </motion.span>
  );
}

