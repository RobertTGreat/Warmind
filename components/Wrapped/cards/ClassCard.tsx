'use client';

import { motion } from 'framer-motion';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats, formatHours } from '@/lib/wrappedStats';

interface ClassCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

// Class-specific colors
const CLASS_COLORS: Record<string, string> = {
  Hunter: '#72A0C1',
  Warlock: '#E5B567',
  Titan: '#C04040',
};

// Class-specific icons (using SVG paths from public folder)
const CLASS_ICONS: Record<string, string> = {
  Hunter: '/class-hunter.svg',
  Warlock: '/class-warlock.svg',
  Titan: '/class-titan.svg',
};

export function ClassCard({ expansion, stats }: ClassCardProps) {
  const totalActivities = stats.classStats.reduce((sum, c) => sum + c.activitiesPlayed, 0);
  const hasClassData = stats.classStats.length > 0;

  // Get a fun description for the favorite class
  const getClassDescription = (className: string) => {
    switch (className) {
      case 'Hunter':
        return "Swift. Cunning. Deadly. You prefer to strike from the shadows.";
      case 'Warlock':
        return "Seekers of knowledge. Masters of the Light's mysteries.";
      case 'Titan':
        return "A wall against the Darkness. Where you stand, evil falls.";
      default:
        return "A true Guardian of the Last City.";
    }
  };

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Your Guardian</p>
          <h2 className="text-3xl font-bold text-white">Class Breakdown</h2>
        </motion.div>

        {hasClassData ? (
          <>
            {/* Favorite class highlight */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 15, delay: 0.3 }}
                className="w-24 h-24 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: `${CLASS_COLORS[stats.favoriteClass] || expansion.color}30` }}
              >
                {CLASS_ICONS[stats.favoriteClass] && (
                  <img 
                    src={CLASS_ICONS[stats.favoriteClass]} 
                    alt={stats.favoriteClass}
                    className="w-16 h-16"
                    style={{ filter: `drop-shadow(0 0 10px ${CLASS_COLORS[stats.favoriteClass] || expansion.color})` }}
                  />
                )}
              </motion.div>
              
              <p className="text-slate-400 text-sm mb-2">Your main class</p>
              <h3 
                className="text-4xl font-bold mb-2"
                style={{ color: CLASS_COLORS[stats.favoriteClass] || expansion.color }}
              >
                {stats.favoriteClass}
              </h3>
              <p className="text-slate-400 italic text-sm max-w-xs mx-auto">
                "{getClassDescription(stats.favoriteClass)}"
              </p>
            </motion.div>

            {/* Class breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-4"
            >
              {stats.classStats.map((classStat, index) => {
                const percentage = totalActivities > 0 
                  ? (classStat.activitiesPlayed / totalActivities) * 100 
                  : 0;
                const color = CLASS_COLORS[classStat.className] || '#888';
                
                return (
                  <motion.div
                    key={classStat.classHash}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="bg-white/5 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-4 mb-3">
                      {/* Class icon */}
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${color}30` }}
                      >
                        {CLASS_ICONS[classStat.className] && (
                          <img 
                            src={CLASS_ICONS[classStat.className]} 
                            alt={classStat.className}
                            className="w-6 h-6"
                          />
                        )}
                      </div>

                      {/* Class name and stats */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">{classStat.className}</span>
                          <span className="text-slate-400 text-sm">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-slate-500 mt-1">
                          <span>{classStat.activitiesPlayed} activities</span>
                          <span>{formatHours(classStat.timePlayedSeconds)}h</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex-1 flex items-center justify-center"
          >
            <p className="text-slate-500 text-center">
              No class data available for this period.
            </p>
          </motion.div>
        )}
      </div>
    </WrappedCard>
  );
}

