'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { EXPANSIONS, getCurrentExpansion, Expansion } from '@/data/d2/expansions';
import { useWrappedStore } from '@/store/wrappedStore';
import { WrappedView } from '@/components/Wrapped/WrappedView';
import { Sparkles, Infinity, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lifetime "expansion" for all-time stats
const LIFETIME_EXPANSION: Expansion = {
  id: 'lifetime',
  name: 'Lifetime',
  shortName: 'All Time',
  releaseDate: '2017-09-06', // D2 launch
  endDate: '2099-12-31',
  image: '/og-image.jpg',
  color: '#e3ce62',
  tagline: 'Your complete Destiny 2 journey',
};

export default function WrappedPage() {
  const { isLoggedIn, isLoading } = useDestinyProfile();
  const { openWrappedView, isWrappedViewOpen, selectedExpansion, closeWrappedView } = useWrappedStore();
  
  const currentExpansion = getCurrentExpansion();
  const now = new Date();
  
  // Get expansion to show in the view
  const expansionToShow = useMemo(() => {
    return selectedExpansion || currentExpansion;
  }, [selectedExpansion, currentExpansion]);

  // Check if an expansion has started
  const hasStarted = (expansion: Expansion) => {
    return new Date(expansion.releaseDate) <= now;
  };

  // All expansions sorted newest first
  const sortedExpansions = useMemo(() => {
    return [...EXPANSIONS].sort((a, b) => 
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-[calc(100vh-80px)] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-destiny-gold" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <PageHeader 
          title="Destiny Wrapped" 
          description="Relive your journey through each expansion."
        />
        <div className="mt-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-destiny-gold/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-destiny-gold" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Sign in with your Bungie account to see your personalized Destiny Wrapped experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen p-4 md:p-8 pb-24">
        {/* Featured Row: Current Expansion + Lifetime */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Current Expansion */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => openWrappedView(currentExpansion)}
            className="relative overflow-hidden border border-white/10 bg-slate-900/50 aspect-[16/9] text-left group transition-all hover:border-white/20"
          >
            {/* Background image */}
            <div 
              className="absolute inset-0 opacity-40 group-hover:opacity-50 transition-opacity bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${currentExpansion.image})`,
              }}
            />
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${currentExpansion.color}40 0%, transparent 50%, rgba(0,0,0,0.8) 100%)`,
              }}
            />
            
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" style={{ color: currentExpansion.color }} />
                <span className="text-sm font-bold uppercase tracking-wider" style={{ color: currentExpansion.color }}>
                  Current
                </span>
              </div>
              
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-1">
                  {currentExpansion.name}
                </h2>
                <p className="text-sm text-slate-400">
                  {currentExpansion.tagline}
                </p>
              </div>
            </div>
          </motion.button>

          {/* Lifetime Wrapped */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => openWrappedView(LIFETIME_EXPANSION)}
            className="relative overflow-hidden border border-white/10 bg-slate-900 aspect-[16/9] text-left group transition-all hover:border-destiny-gold/30"
          >
            {/* Destiny Tricorn Pattern Background */}
            <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="tricornGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e3ce62" />
                    <stop offset="100%" stopColor="#ffd700" />
                  </linearGradient>
                </defs>
                {/* Simplified Tricorn shape */}
                <path 
                  d="M50 5 L65 40 L95 50 L65 60 L50 95 L35 60 L5 50 L35 40 Z" 
                  fill="url(#tricornGrad)" 
                  transform="translate(25, 10) scale(0.5)"
                />
              </svg>
            </div>
            
            {/* Animated gradient background */}
            <div 
              className="absolute inset-0 opacity-40 group-hover:opacity-50 transition-opacity"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 20%, #e3ce6230 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 80%, #ffd70020 0%, transparent 50%),
                  linear-gradient(135deg, #0f1115 0%, #1a1d24 50%, #0f1115 100%)
                `,
              }}
            />
            
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-destiny-gold to-transparent opacity-60" />
            
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Infinity className="w-5 h-5 text-destiny-gold" />
                <span className="text-sm font-bold uppercase tracking-wider text-destiny-gold">
                  All Time
                </span>
              </div>
              
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-1">
                  Lifetime Wrapped
                </h2>
                <p className="text-sm text-slate-400">
                  Your complete Destiny 2 journey since 2017
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {/* All Expansions Grid */}
        <div className="mt-12">
          <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">
            All Expansions
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sortedExpansions.map((expansion, index) => {
              const started = hasStarted(expansion);
              const isCurrent = expansion.id === currentExpansion.id;
              
              return (
                <motion.button
                  key={expansion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => started && openWrappedView(expansion)}
                  disabled={!started}
                  className={cn(
                    "relative overflow-hidden border bg-slate-900/50 aspect-[4/3] text-left group transition-all",
                    started 
                      ? "border-white/10 hover:border-white/30 cursor-pointer" 
                      : "border-white/5 cursor-not-allowed"
                  )}
                >
                  {/* Background image */}
                  <div 
                    className={cn(
                      "absolute inset-0 bg-cover bg-center transition-all",
                      started 
                        ? "opacity-40 group-hover:opacity-60" 
                        : "opacity-10 grayscale"
                    )}
                    style={{ 
                      backgroundImage: `url(${expansion.image})`,
                    }}
                  />
                  
                  {/* Gradient overlay */}
                  <div 
                    className={cn(
                      "absolute inset-0",
                      started ? "" : "bg-black/50"
                    )}
                    style={started ? {
                      background: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 100%)`,
                    } : undefined}
                  />

                  {/* Color accent line */}
                  {started && (
                    <div 
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ background: expansion.color }}
                    />
                  )}

                  {/* Current badge */}
                  {isCurrent && (
                    <div 
                      className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ 
                        background: expansion.color,
                        color: '#0f1115',
                      }}
                    >
                      Current
                    </div>
                  )}

                  {/* Lock icon for unreleased */}
                  {!started && (
                    <div className="absolute top-2 right-2">
                      <Lock className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="absolute inset-0 p-3 flex flex-col justify-end">
                    <h4 className={cn(
                      "font-semibold text-sm leading-tight mb-0.5 transition-colors",
                      started 
                        ? "text-white group-hover:text-destiny-gold" 
                        : "text-slate-600"
                    )}>
                      {expansion.shortName || expansion.name}
                    </h4>
                    <p className={cn(
                      "text-xs",
                      started ? "text-slate-400" : "text-slate-700"
                    )}>
                      {new Date(expansion.releaseDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Wrapped View Modal */}
      <AnimatePresence>
        {isWrappedViewOpen && (
          <WrappedView 
            expansion={expansionToShow} 
            onClose={closeWrappedView} 
          />
        )}
      </AnimatePresence>
    </>
  );
}
