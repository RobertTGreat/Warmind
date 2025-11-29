'use client';

import { motion } from 'framer-motion';
import { Trophy, Clock } from 'lucide-react';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats, formatHours } from '@/lib/wrappedStats';

interface ActivitiesCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

export function ActivitiesCard({ expansion, stats }: ActivitiesCardProps) {
  // Get top 5 activity types
  const topActivities = stats.activitiesByType.slice(0, 5);
  const maxCount = topActivities[0]?.count || 1;

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Your Activities</p>
          <h2 className="text-3xl font-bold text-white">Where You Spent Your Time</h2>
        </motion.div>

        {/* Top activity highlight */}
        {topActivities[0] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div 
              className="inline-flex items-center gap-3 px-6 py-3 mb-4"
            >
              <Trophy className="w-5 h-5" style={{ color: expansion.color }} />
              <span className="text-slate-300">Your #1 Activity</span>
            </div>
            <h3 
              className="text-4xl font-bold mb-2"
              style={{ color: expansion.color }}
            >
              {topActivities[0].modeName}
            </h3>
            <p className="text-slate-400">
              {topActivities[0].count.toLocaleString()} activities • {formatHours(topActivities[0].totalTimeSeconds)} hours
            </p>
          </motion.div>
        )}

        {/* Activity breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          {topActivities.map((activity, index) => {
            const percentage = (activity.count / maxCount) * 100;
            return (
              <motion.div
                key={activity.mode}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="relative"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ 
                        background: index === 0 ? expansion.color : 'rgba(255,255,255,0.1)',
                        color: index === 0 ? '#0f1115' : 'white',
                      }}
                    >
                      {index + 1}
                    </span>
                    <span className="text-white font-medium">{activity.modeName}</span>
                  </div>
                  <span className="text-slate-400 text-sm">{activity.count.toLocaleString()}</span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ 
                      background: index === 0 
                        ? expansion.color 
                        : `linear-gradient(90deg, ${expansion.color}60, ${expansion.color}30)`,
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Completion rate */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-auto pt-8 text-center"
        >
          <div className="inline-flex items-center gap-4 px-6 py-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Completion Rate</p>
              <p className="text-2xl font-bold text-green-400">
                {stats.totalActivities > 0 
                  ? ((stats.totalCompletions / stats.totalActivities) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </WrappedCard>
  );
}

