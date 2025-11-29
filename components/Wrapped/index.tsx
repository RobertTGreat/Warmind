'use client';

import { AnimatePresence } from 'framer-motion';
import { useWrappedStore } from '@/store/wrappedStore';
import { WrappedPopup } from './WrappedPopup';
import { WrappedView } from './WrappedView';

/**
 * Main Wrapped component that handles both the popup and the full wrapped view.
 * Include this component in your layout or page to enable Destiny Wrapped.
 */
export function DestinyWrapped() {
  const {
    isWrappedViewOpen,
    selectedExpansion,
    closeWrappedView,
    clearStats,
  } = useWrappedStore();

  const handleClose = () => {
    closeWrappedView();
    clearStats();
  };

  return (
    <>
      {/* Popup that appears on home page */}
      <WrappedPopup />

      {/* Full wrapped view */}
      <AnimatePresence>
        {isWrappedViewOpen && selectedExpansion && (
          <WrappedView
            expansion={selectedExpansion}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Re-export components for direct use
export { WrappedPopup } from './WrappedPopup';
export { WrappedView } from './WrappedView';
export { WrappedCard, StatBlock } from './WrappedCard';

// Re-export card components
export { IntroCard } from './cards/IntroCard';
export { OverviewCard } from './cards/OverviewCard';
export { ActivitiesCard } from './cards/ActivitiesCard';
export { TeammatesCard } from './cards/TeammatesCard';
export { TimeOfDayCard } from './cards/TimeOfDayCard';
export { ClassCard } from './cards/ClassCard';
export { SummaryCard } from './cards/SummaryCard';

