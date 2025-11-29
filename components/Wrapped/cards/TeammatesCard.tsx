'use client';

import { motion } from 'framer-motion';
import { Users, Heart, Clock } from 'lucide-react';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats, formatHours } from '@/lib/wrappedStats';
import { getBungieImage } from '@/lib/bungie';

interface TeammatesCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

export function TeammatesCard({ expansion, stats }: TeammatesCardProps) {
  const topTeammates = stats.topTeammates.slice(0, 5);
  const hasTeammates = topTeammates.length > 0;

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Your Fireteam</p>
          <h2 className="text-3xl font-bold text-white">Guardians by Your Side</h2>
        </motion.div>

        {/* Unique teammates count */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full mb-4"
            style={{ background: `${expansion.color}20` }}
          >
            <Users className="w-5 h-5" style={{ color: expansion.color }} />
            <span className="text-slate-300">Unique Guardians</span>
          </div>
          <p 
            className="text-5xl font-bold"
            style={{ color: expansion.color }}
          >
            {stats.totalUniqueTeammates.toLocaleString()}
          </p>
          <p className="text-slate-400 mt-2">
            different players joined your fireteam
          </p>
        </motion.div>

        {/* Top teammates */}
        {hasTeammates ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-4 h-4" style={{ color: expansion.color }} />
              <span className="text-sm text-slate-400 uppercase tracking-wide">Most Played With</span>
            </div>

            {topTeammates.map((teammate, index) => (
              <motion.div
                key={teammate.membershipId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="relative overflow-hidden"
              >
                {/* Emblem background */}
                {teammate.iconPath && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-30"
                    style={{ 
                      backgroundImage: `url(${getBungieImage(teammate.iconPath)})`,
                    }}
                  />
                )}
                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70" />
                
                {/* Content */}
                <div className="relative flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div 
                    className="w-12 h-12 overflow-hidden shrink-0 border-2"
                    style={{ borderColor: index === 0 ? expansion.color : 'rgba(255,255,255,0.2)' }}
                  >
                    {teammate.iconPath && (
                      <img 
                        src={getBungieImage(teammate.iconPath)} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{teammate.displayName}</p>
                    <p className="text-xs text-slate-400">
                      {teammate.activitiesPlayed} activities together
                    </p>
                  </div>

                  {/* Time */}
                  <div className="text-right shrink-0">
                    <p 
                      className="text-lg font-bold"
                      style={{ color: expansion.color }}
                    >
                      {formatHours(teammate.totalTimeSeconds)}h
                    </p>
                    <p className="text-xs text-slate-500">played</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center py-8"
          >
            <p className="text-slate-500">
              No teammate data available for this period.
            </p>
            <p className="text-slate-600 text-sm mt-2">
              PGCR data is needed to track teammates.
            </p>
          </motion.div>
        )}

        {/* Best friend callout */}
        {topTeammates[0] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-auto pt-8 text-center"
          >
            <p className="text-slate-500 text-sm">
              Your best raid buddy was{' '}
              <span className="font-semibold text-white">{topTeammates[0].displayName}</span>
            </p>
          </motion.div>
        )}
      </div>
    </WrappedCard>
  );
}

