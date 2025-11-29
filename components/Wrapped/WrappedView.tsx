'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Loader2, Download, Sparkles, Database, AlertCircle } from 'lucide-react';
import { useWrappedStore, useWrappedStats } from '@/store/wrappedStore';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { useWrappedData } from '@/hooks/useWrappedData';
import { calculateWrappedStatsFromData } from '@/lib/wrappedStats';
import { Expansion } from '@/data/d2/expansions';

// Card components
import { IntroCard } from './cards/IntroCard';
import { OverviewCard } from './cards/OverviewCard';
import { ActivitiesCard } from './cards/ActivitiesCard';
import { WeaponsCard } from './cards/WeaponsCard';
import { AbilitiesCard } from './cards/AbilitiesCard';
import { FireteamCard } from './cards/FireteamCard';
import { TeammatesCard } from './cards/TeammatesCard';
import { TimeOfDayCard } from './cards/TimeOfDayCard';
import { ClassCard } from './cards/ClassCard';
import { SummaryCard } from './cards/SummaryCard';

interface WrappedViewProps {
  expansion: Expansion;
  onClose: () => void;
}

export function WrappedView({ expansion, onClose }: WrappedViewProps) {
  const { profile } = useDestinyProfile();
  const [hasStartedDownload, setHasStartedDownload] = useState(false);
  
  // Use the new wrapped data hook - only enabled after user clicks download
  const { 
    activities, 
    pgcrs, 
    isLoading, 
    progress, 
    error: fetchError,
    refetch 
  } = useWrappedData({ 
    expansion, 
    enabled: hasStartedDownload 
  });
  
  const {
    wrappedStats,
    isCalculating,
    calculationError,
    setWrappedStats,
    setCalculating,
    setCalculationError,
  } = useWrappedStats();
  
  const {
    currentSlide,
    nextSlide,
    prevSlide,
    goToSlide,
    markExpansionViewed,
  } = useWrappedStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null);

  // Get display name
  const displayName = profile?.profile?.data?.userInfo?.displayName || 'Guardian';
  const membershipId = profile?.profile?.data?.userInfo?.membershipId || '';
  
  // Build character class map
  const characterClassMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (profile?.characters?.data) {
      Object.entries(profile.characters.data).forEach(([charId, charData]: [string, any]) => {
        map[charId] = charData.classHash;
      });
    }
    return map;
  }, [profile?.characters?.data]);

  // Calculate wrapped stats when data download is complete
  useEffect(() => {
    if (!hasStartedDownload || isLoading || isCalculating || wrappedStats) return;
    if (progress.phase !== 'complete') return;
    if (activities.length === 0) return;

    setCalculating(true);

    try {
      const stats = calculateWrappedStatsFromData(
        expansion,
        activities,
        pgcrs,
        membershipId,
        characterClassMap
      );

      setWrappedStats(stats);
      markExpansionViewed(expansion.id);
    } catch (error) {
      console.error('Failed to calculate wrapped stats:', error);
      setCalculationError(error instanceof Error ? error.message : 'Failed to calculate stats');
    }
  }, [
    hasStartedDownload,
    expansion,
    activities,
    pgcrs,
    membershipId,
    characterClassMap,
    isLoading,
    isCalculating,
    wrappedStats,
    progress.phase,
    setCalculating,
    setWrappedStats,
    setCalculationError,
    markExpansionViewed,
  ]);

  const handleStartDownload = () => {
    setHasStartedDownload(true);
  };

  // Define slides based on available stats
  const slides = useMemo(() => {
    if (!wrappedStats) return [];

    return [
      { id: 'intro', component: <IntroCard expansion={expansion} displayName={displayName} /> },
      { id: 'overview', component: <OverviewCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'activities', component: <ActivitiesCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'weapons', component: <WeaponsCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'abilities', component: <AbilitiesCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'timeofday', component: <TimeOfDayCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'fireteam', component: <FireteamCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'teammates', component: <TeammatesCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'class', component: <ClassCard expansion={expansion} stats={wrappedStats} /> },
      { id: 'summary', component: <SummaryCard expansion={expansion} stats={wrappedStats} displayName={displayName} onClose={onClose} /> },
    ];
  }, [wrappedStats, expansion, displayName, onClose]);

  const totalSlides = slides.length;
  const canGoNext = currentSlide < totalSlides - 1;
  const canGoPrev = currentSlide > 0;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && canGoNext) nextSlide();
      if (e.key === 'ArrowLeft' && canGoPrev) prevSlide();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrev, nextSlide, prevSlide, onClose]);

  // Handle swipe/drag
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && canGoNext) {
      nextSlide();
    } else if (info.offset.x > threshold && canGoPrev) {
      prevSlide();
    }
    setDragDirection(null);
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -10) {
      setDragDirection('left');
    } else if (info.offset.x > 10) {
      setDragDirection('right');
    } else {
      setDragDirection(null);
    }
  };

  // ===== DOWNLOAD SCREEN =====
  // Show before user starts downloading data
  if (!hasStartedDownload) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-800/20 backdrop-blur-xl flex items-center justify-center"
      >
        {/* Background gradient */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${expansion.color}40 0%, transparent 60%)`,
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="relative z-10 text-center max-w-md px-6">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 0.1 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{ background: `${expansion.color}30` }}
          >
            <Sparkles className="w-10 h-10" style={{ color: expansion.color }} />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white mb-2"
          >
            {expansion.name} Wrapped
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-slate-400 mb-8"
          >
            Ready to see your journey through {expansion.shortName}?
          </motion.p>

          {/* Info box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left"
          >
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-300 mb-1">
                  This will download your activity history for this expansion period.
                </p>
                <p className="text-xs text-slate-500">
                  Data is cached locally so future views will be instant.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Download button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={handleStartDownload}
            className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 group"
            style={{
              background: `linear-gradient(135deg, ${expansion.color}, ${expansion.color}cc)`,
              color: '#0f1115',
            }}
          >
            <Download className="w-5 h-5" />
            Download My Data
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-xs text-slate-300 mt-4"
          >
            {new Date(expansion.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' — '}
            {new Date(expansion.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </motion.p>
        </div>
      </motion.div>
    );
  }

  // ===== LOADING/DOWNLOADING STATE =====
  if (isLoading || isCalculating || !wrappedStats) {
    const progressPercent = progress.total > 0 
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        {/* Background gradient */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${expansion.color}40 0%, transparent 60%)`,
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="relative z-10 text-center max-w-md px-6">
          <Loader2 
            className="w-16 h-16 animate-spin mx-auto mb-6" 
            style={{ color: expansion.color }} 
          />
          
          <p className="text-white text-xl font-medium mb-2">
            {progress.phase === 'fetching-activities' && 'Fetching Activities...'}
            {progress.phase === 'fetching-pgcrs' && 'Loading Details...'}
            {progress.phase === 'complete' && 'Calculating Stats...'}
            {progress.phase === 'idle' && 'Preparing...'}
          </p>
          
          <p className="text-slate-400 text-sm mb-6">
            {progress.message}
          </p>

          {/* Progress bar */}
          {progress.total > 0 && (
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="h-full rounded-full"
                style={{ background: expansion.color }}
              />
            </div>
          )}

          {progress.total > 0 && (
            <p className="text-slate-500 text-xs mt-2">
              {progress.current} / {progress.total}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // ===== ERROR STATE =====
  if (fetchError || calculationError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-red-400 text-xl font-medium mb-2">Something went wrong</p>
          <p className="text-slate-400 text-sm mb-6">{fetchError || calculationError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setHasStartedDownload(false);
              }}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ===== WRAPPED SLIDES =====
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-10000 bg-gray-800/20 backdrop-blur-xl"
      ref={containerRef}
    >
      {/* Background gradient */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${expansion.color}40 0%, transparent 70%)`,
        }}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Progress dots */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentSlide 
                ? 'w-6' 
                : 'hover:opacity-80'
            }`}
            style={{
              background: index === currentSlide ? expansion.color : 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </div>

      {/* Navigation arrows */}
      {canGoPrev && (
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors hidden md:block"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}
      
      {canGoNext && (
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors hidden md:block"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Slide container */}
      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: dragDirection === 'left' ? 100 : -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dragDirection === 'left' ? -100 : 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="w-full max-w-md cursor-grab active:cursor-grabbing"
          >
            {slides[currentSlide]?.component}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <p className="text-slate-500 text-sm">
          {currentSlide + 1} / {totalSlides}
        </p>
      </div>
    </motion.div>
  );
}
