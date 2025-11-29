'use client';

import { motion } from 'framer-motion';
import { Clock, Target, Skull, Swords, Trophy, Calendar } from 'lucide-react';
import { WrappedCard, StatBlock } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats, formatDuration, formatHours, getPlaytimeTitle } from '@/lib/wrappedStats';

interface OverviewCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

export function OverviewCard({ expansion, stats }: OverviewCardProps) {
  const hours = stats.totalTimePlayedSeconds / 3600;
  const playtimeTitle = getPlaytimeTitle(hours);

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Your Overview</p>
          <h2 className="text-3xl font-bold text-white">By the Numbers</h2>
        </motion.div>

        {/* Main stat - Time played */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-slate-400" />
            <p className="text-slate-400 uppercase tracking-wider text-sm">Time Played</p>
          </div>
          <p 
            className="text-6xl md:text-7xl font-bold tracking-tight"
            style={{ color: expansion.color }}
          >
            {formatHours(stats.totalTimePlayedSeconds)}
          </p>
          <p className="text-2xl text-slate-400 mt-1">hours</p>
          <p className="text-slate-500 mt-4 text-lg">
            That makes you a <span className="font-semibold text-white">{playtimeTitle}</span>
          </p>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-6"
        >
          <div className="p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-2" style={{ color: expansion.color }} />
            <p className="text-2xl font-bold text-white">{stats.totalActivities.toLocaleString()}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Activities</p>
          </div>

          <div className="p-4 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-2" style={{ color: expansion.color }} />
            <p className="text-2xl font-bold text-white">{stats.activeDays}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Days Active</p>
          </div>

          <div className="p-4 text-center">
            <Target className="w-5 h-5 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold text-white">{stats.totalKills.toLocaleString()}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Kills</p>
          </div>

          <div className="p-4 text-center">
            <Skull className="w-5 h-5 mx-auto mb-2 text-red-400" />
            <p className="text-2xl font-bold text-white">{stats.totalDeaths.toLocaleString()}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Deaths</p>
          </div>
        </motion.div>

        {/* K/D Ratio */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-4 px-6 py-4">
            <Swords className="w-5 h-5" style={{ color: expansion.color }} />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">K/D Ratio</p>
              <p className="text-2xl font-bold" style={{ color: expansion.color }}>
                {stats.kdRatio.toFixed(2)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </WrappedCard>
  );
}

