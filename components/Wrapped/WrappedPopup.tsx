'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ChevronRight, Calendar } from 'lucide-react';
import { useWrappedStore, getWrappedExpansions } from '@/store/wrappedStore';
import { Expansion, getCurrentExpansion, EXPANSIONS } from '@/data/d2/expansions';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';

interface WrappedPopupProps {
  onViewWrapped?: (expansion: Expansion) => void;
}

export function WrappedPopup({ onViewWrapped }: WrappedPopupProps) {
  const { isLoggedIn } = useDestinyProfile();
  const {
    isPopupOpen,
    closePopup,
    dismissPopup,
    openWrappedView,
    shouldShowPopup,
    updatePopupCheckTime,
    openPopup,
  } = useWrappedStore();

  const [showExpansionList, setShowExpansionList] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  
  const currentExpansion = getCurrentExpansion();
  const availableExpansions = getWrappedExpansions();

  // Auto-show popup on mount if conditions are met
  useEffect(() => {
    if (isLoggedIn && !hasChecked) {
      setHasChecked(true);
      if (shouldShowPopup()) {
        updatePopupCheckTime();
        // Small delay for better UX
        const timer = setTimeout(() => {
          openPopup();
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoggedIn, hasChecked, shouldShowPopup, updatePopupCheckTime, openPopup]);

  const handleViewCurrent = () => {
    openWrappedView(currentExpansion);
    onViewWrapped?.(currentExpansion);
  };

  const handleViewExpansion = (expansion: Expansion) => {
    openWrappedView(expansion);
    onViewWrapped?.(expansion);
  };

  const handleDismiss = () => {
    dismissPopup(currentExpansion.id);
  };

  if (!isPopupOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${currentExpansion.color}40 0%, transparent 50%),
                             radial-gradient(circle at 70% 80%, ${currentExpansion.color}30 0%, transparent 50%)`,
              }}
            />
            <div className="absolute inset-0 bg-noise-animated opacity-5" />
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>

          {/* Content */}
          <div className="relative z-10 p-8">
            {!showExpansionList ? (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${currentExpansion.color}30` }}
                  >
                    <Sparkles className="w-6 h-6" style={{ color: currentExpansion.color }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      Destiny Wrapped
                    </h2>
                    <p className="text-sm text-slate-400">Your journey awaits</p>
                  </div>
                </div>

                {/* Message */}
                <p className="text-slate-300 mb-8 leading-relaxed">
                  Ready to relive your adventure through <span className="font-semibold text-white">{currentExpansion.name}</span>? 
                  See your stats, favorite activities, top teammates, and more from your journey.
                </p>

                {/* Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleViewCurrent}
                    className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 group"
                    style={{
                      background: `linear-gradient(135deg, ${currentExpansion.color}, ${currentExpansion.color}cc)`,
                      color: '#0f1115',
                    }}
                  >
                    <Sparkles className="w-5 h-5" />
                    View {currentExpansion.shortName} Wrapped
                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>

                  <button
                    onClick={() => setShowExpansionList(true)}
                    className="w-full py-3 px-6 rounded-xl font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    View Other Expansions
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="w-full py-2 text-sm text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Expansion List */}
                <button
                  onClick={() => setShowExpansionList(false)}
                  className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back
                </button>

                <h2 className="text-xl font-bold text-white mb-4">Choose an Expansion</h2>

                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {availableExpansions.map((expansion) => (
                    <button
                      key={expansion.id}
                      onClick={() => handleViewExpansion(expansion)}
                      className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all flex items-center gap-4 group text-left"
                    >
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${expansion.color}30` }}
                      >
                        <Sparkles className="w-5 h-5" style={{ color: expansion.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{expansion.name}</h3>
                        <p className="text-xs text-slate-500">
                          {new Date(expansion.releaseDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            year: 'numeric' 
                          })} — {new Date(expansion.endDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

