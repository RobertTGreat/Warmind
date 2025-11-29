import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { Expansion, EXPANSIONS, getCurrentExpansion } from '@/data/d2/expansions';
import { WrappedStats } from '@/lib/wrappedStats';

// ===== State Types =====

export interface WrappedState {
  // UI State
  isPopupOpen: boolean;
  isWrappedViewOpen: boolean;
  currentSlide: number;
  
  // Selected expansion for viewing wrapped
  selectedExpansion: Expansion | null;
  
  // Calculated stats
  wrappedStats: WrappedStats | null;
  isCalculating: boolean;
  calculationError: string | null;
  
  // User preferences
  hasSeenPopup: boolean;
  dismissedExpansions: string[]; // Expansion IDs user has dismissed popup for
  viewedExpansions: string[]; // Expansion IDs user has viewed wrapped for
  
  // Last check timestamp
  lastPopupCheckTime: string | null;
}

export interface WrappedActions {
  // Popup controls
  openPopup: () => void;
  closePopup: () => void;
  dismissPopup: (expansionId?: string) => void;
  
  // Wrapped view controls
  openWrappedView: (expansion: Expansion) => void;
  closeWrappedView: () => void;
  
  // Slide navigation
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number) => void;
  
  // Stats management
  setWrappedStats: (stats: WrappedStats) => void;
  setCalculating: (calculating: boolean) => void;
  setCalculationError: (error: string | null) => void;
  clearStats: () => void;
  
  // Mark as viewed
  markExpansionViewed: (expansionId: string) => void;
  
  // Check if popup should show
  shouldShowPopup: () => boolean;
  updatePopupCheckTime: () => void;
  
  // Reset
  reset: () => void;
  
  // Testing utilities
  forceShowPopup: () => void;
  forceShowWrapped: (expansionId?: string) => void;
  resetDismissed: () => void;
}

type WrappedStore = WrappedState & WrappedActions;

// ===== Default State =====

const defaultState: WrappedState = {
  isPopupOpen: false,
  isWrappedViewOpen: false,
  currentSlide: 0,
  selectedExpansion: null,
  wrappedStats: null,
  isCalculating: false,
  calculationError: null,
  hasSeenPopup: false,
  dismissedExpansions: [],
  viewedExpansions: [],
  lastPopupCheckTime: null,
};

// ===== Safe Storage =====

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn('LocalStorage not available for wrapped state', e);
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(name);
    } catch {}
  },
};

// ===== Store =====

export const useWrappedStore = create<WrappedStore>()(
  persist(
    (set, get) => ({
      ...defaultState,
      
      // Popup controls
      openPopup: () => set({ isPopupOpen: true, hasSeenPopup: true }),
      closePopup: () => set({ isPopupOpen: false }),
      
      dismissPopup: (expansionId) => {
        const current = getCurrentExpansion();
        const id = expansionId || current.id;
        set((state) => ({
          isPopupOpen: false,
          dismissedExpansions: state.dismissedExpansions.includes(id)
            ? state.dismissedExpansions
            : [...state.dismissedExpansions, id],
        }));
      },
      
      // Wrapped view controls
      openWrappedView: (expansion) => set({
        isWrappedViewOpen: true,
        isPopupOpen: false,
        selectedExpansion: expansion,
        currentSlide: 0,
        wrappedStats: null,
        calculationError: null,
      }),
      
      closeWrappedView: () => set({
        isWrappedViewOpen: false,
        currentSlide: 0,
      }),
      
      // Slide navigation
      nextSlide: () => set((state) => ({
        currentSlide: state.currentSlide + 1,
      })),
      
      prevSlide: () => set((state) => ({
        currentSlide: Math.max(0, state.currentSlide - 1),
      })),
      
      goToSlide: (index) => set({ currentSlide: index }),
      
      // Stats management
      setWrappedStats: (stats) => set({
        wrappedStats: stats,
        isCalculating: false,
        calculationError: null,
      }),
      
      setCalculating: (calculating) => set({ isCalculating: calculating }),
      
      setCalculationError: (error) => set({
        calculationError: error,
        isCalculating: false,
      }),
      
      clearStats: () => set({
        wrappedStats: null,
        calculationError: null,
      }),
      
      // Mark as viewed
      markExpansionViewed: (expansionId) => {
        set((state) => ({
          viewedExpansions: state.viewedExpansions.includes(expansionId)
            ? state.viewedExpansions
            : [...state.viewedExpansions, expansionId],
        }));
      },
      
      // Check if popup should show
      shouldShowPopup: () => {
        const state = get();
        const currentExpansion = getCurrentExpansion();
        
        // Don't show if already viewing wrapped
        if (state.isWrappedViewOpen) {
          return false;
        }
        
        // Don't show if already dismissed for current expansion
        if (state.dismissedExpansions.includes(currentExpansion.id)) {
          return false;
        }
        
        // Only show if user hasn't viewed their wrapped for current expansion yet
        // Once they've seen it, they can access it via Settings
        if (state.viewedExpansions.includes(currentExpansion.id)) {
          return false;
        }
        
        return true;
      },
      
      updatePopupCheckTime: () => set({
        lastPopupCheckTime: new Date().toISOString(),
      }),
      
      // Reset
      reset: () => set(defaultState),
      
      // Testing utilities - bypass all conditions
      forceShowPopup: () => {
        set({ 
          isPopupOpen: true, 
          hasSeenPopup: true,
          isWrappedViewOpen: false,
        });
      },
      
      forceShowWrapped: (expansionId) => {
        const expansion = expansionId 
          ? EXPANSIONS.find(e => e.id === expansionId) || getCurrentExpansion()
          : getCurrentExpansion();
        set({
          isWrappedViewOpen: true,
          isPopupOpen: false,
          selectedExpansion: expansion,
          currentSlide: 0,
          wrappedStats: null,
          calculationError: null,
        });
      },
      
      resetDismissed: () => {
        set({
          dismissedExpansions: [],
          viewedExpansions: [],
          lastPopupCheckTime: null,
          hasSeenPopup: false,
        });
      },
    }),
    {
      name: 'warmind-wrapped',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        // Only persist preferences, not UI state
        hasSeenPopup: state.hasSeenPopup,
        dismissedExpansions: state.dismissedExpansions,
        viewedExpansions: state.viewedExpansions,
        lastPopupCheckTime: state.lastPopupCheckTime,
      }),
    }
  )
);

// ===== Selector Hooks =====

export const useWrappedUI = () => useWrappedStore(
  useShallow((state) => ({
    isPopupOpen: state.isPopupOpen,
    isWrappedViewOpen: state.isWrappedViewOpen,
    currentSlide: state.currentSlide,
    selectedExpansion: state.selectedExpansion,
    openPopup: state.openPopup,
    closePopup: state.closePopup,
    dismissPopup: state.dismissPopup,
    openWrappedView: state.openWrappedView,
    closeWrappedView: state.closeWrappedView,
    nextSlide: state.nextSlide,
    prevSlide: state.prevSlide,
    goToSlide: state.goToSlide,
  }))
);

export const useWrappedStats = () => useWrappedStore(
  useShallow((state) => ({
    wrappedStats: state.wrappedStats,
    isCalculating: state.isCalculating,
    calculationError: state.calculationError,
    setWrappedStats: state.setWrappedStats,
    setCalculating: state.setCalculating,
    setCalculationError: state.setCalculationError,
    clearStats: state.clearStats,
  }))
);

export const useWrappedPopup = () => useWrappedStore(
  useShallow((state) => ({
    shouldShowPopup: state.shouldShowPopup,
    updatePopupCheckTime: state.updatePopupCheckTime,
    hasSeenPopup: state.hasSeenPopup,
    openPopup: state.openPopup,
  }))
);

// ===== Helper: Get available expansions for wrapped =====

export function getWrappedExpansions(): Expansion[] {
  // Return expansions that have ended (so we have full data)
  // Plus the current expansion
  const now = new Date();
  return EXPANSIONS.filter(exp => {
    const endDate = new Date(exp.endDate);
    return endDate <= now || exp.id === getCurrentExpansion().id;
  });
}

