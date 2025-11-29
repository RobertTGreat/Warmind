'use client';

import { motion } from 'framer-motion';
import { User, Users, Clock } from 'lucide-react';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats, formatHours } from '@/lib/wrappedStats';

interface FireteamCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

export function FireteamCard({ expansion, stats }: FireteamCardProps) {
  const { fireteamStats } = stats;
  const totalActivities = fireteamStats.soloActivities + fireteamStats.teamActivities;
  const hasData = totalActivities > 0;

  const soloPercent = totalActivities > 0 
    ? (fireteamStats.soloActivities / totalActivities) * 100 
    : 0;
  const teamPercent = 100 - soloPercent;

  // Determine playstyle
  const getPlaystyle = () => {
    if (soloPercent >= 70) return { title: 'Lone Wolf', desc: 'You prefer to work alone', icon: User };
    if (soloPercent >= 40) return { title: 'Flex Player', desc: 'Solo or team, you adapt', icon: Users };
    return { title: 'Team Player', desc: 'Strength in numbers', icon: Users };
  };

  const playstyle = getPlaystyle();
  const PlaystyleIcon = playstyle.icon;

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Playstyle</p>
          <h2 className="text-3xl font-bold text-white">Solo vs Fireteam</h2>
        </motion.div>

        {/* Playstyle badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 0.3 }}
            className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: `${expansion.color}20` }}
          >
            <PlaystyleIcon className="w-10 h-10" style={{ color: expansion.color }} />
          </motion.div>
          <h3 
            className="text-2xl font-bold mb-1"
            style={{ color: expansion.color }}
          >
            {playstyle.title}
          </h3>
          <p className="text-slate-400 text-sm">{playstyle.desc}</p>
        </motion.div>

        {hasData ? (
          <>
            {/* Solo vs Team comparison */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4 mb-6"
            >
              {/* Solo */}
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: '#6366f120' }}
                    >
                      <User className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Solo</p>
                      <p className="text-xs text-slate-500">
                        {fireteamStats.soloActivities} activities
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-400">
                      {soloPercent.toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatHours(fireteamStats.soloTimePlayed)}h
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${soloPercent}%` }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="h-full rounded-full bg-indigo-400"
                  />
                </div>
              </div>

              {/* Team */}
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${expansion.color}20` }}
                    >
                      <Users className="w-5 h-5" style={{ color: expansion.color }} />
                    </div>
                    <div>
                      <p className="text-white font-semibold">With Fireteam</p>
                      <p className="text-xs text-slate-500">
                        {fireteamStats.teamActivities} activities
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: expansion.color }}>
                      {teamPercent.toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatHours(fireteamStats.teamTimePlayed)}h
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${teamPercent}%` }}
                    transition={{ delay: 0.7, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ background: expansion.color }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Average fireteam size */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center py-4 bg-white/5 rounded-xl"
            >
              <p className="text-slate-400 text-sm mb-1">Average Fireteam Size</p>
              <p 
                className="text-3xl font-bold"
                style={{ color: expansion.color }}
              >
                {fireteamStats.averageFireteamSize.toFixed(1)}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                players per activity
              </p>
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
              No fireteam data available for this period.
            </p>
          </motion.div>
        )}
      </div>
    </WrappedCard>
  );
}

