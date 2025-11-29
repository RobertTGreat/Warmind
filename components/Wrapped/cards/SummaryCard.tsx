'use client';

import { motion } from 'framer-motion';
import { Trophy, Clock, Target, Users, Calendar, Sparkles, Share2, Heart } from 'lucide-react';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats, formatHours, getPlaytimeTitle } from '@/lib/wrappedStats';
import { KofiButton } from '@/components/ui/KofiButton';

interface SummaryCardProps {
  expansion: Expansion;
  stats: WrappedStats;
  displayName: string;
  onClose?: () => void;
}

export function SummaryCard({ expansion, stats, displayName, onClose }: SummaryCardProps) {
  const hours = stats.totalTimePlayedSeconds / 3600;
  const playtimeTitle = getPlaytimeTitle(hours);

  // Generate a shareable summary text
  const getShareText = () => {
    return `My ${expansion.name} Wrapped 🎮

⏱️ ${formatHours(stats.totalTimePlayedSeconds)} hours played
🎯 ${stats.totalKills.toLocaleString()} total kills
🏆 ${stats.totalActivities.toLocaleString()} activities
${stats.favoriteClass ? `⚔️ Main class: ${stats.favoriteClass}` : ''}

I'm a ${playtimeTitle}! #DestinyWrapped #Destiny2`;
  };

  const handleShare = async () => {
    const text = getShareText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${expansion.name} Wrapped`,
          text,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    }
  };

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 0.2 }}
            className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
            style={{ background: `${expansion.color}30` }}
          >
            <Sparkles className="w-8 h-8" style={{ color: expansion.color }} />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-2">Your {expansion.shortName} Wrapped</h2>
          <p className="text-slate-400">{displayName}</p>
        </motion.div>

        {/* Title badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-6"
        >
          <div 
            className="inline-block px-6 py-2 rounded-full text-lg font-bold"
            style={{ background: expansion.color, color: '#0f1115' }}
          >
            {playtimeTitle}
          </div>
        </motion.div>

        {/* Stats summary grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <div className="bg-white/5 p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-2" style={{ color: expansion.color }} />
            <p className="text-xl font-bold text-white">{formatHours(stats.totalTimePlayedSeconds)}h</p>
            <p className="text-xs text-slate-500">Played</p>
          </div>

          <div className="bg-white/5 p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-2" style={{ color: expansion.color }} />
            <p className="text-xl font-bold text-white">{stats.totalActivities.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Activities</p>
          </div>

          <div className="bg-white/5 p-4 text-center">
            <Target className="w-5 h-5 mx-auto mb-2" style={{ color: expansion.color }} />
            <p className="text-xl font-bold text-white">{stats.totalKills.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Kills</p>
          </div>

          <div className="bg-white/5 p-4 text-center">
            <Users className="w-5 h-5 mx-auto mb-2" style={{ color: expansion.color }} />
            <p className="text-xl font-bold text-white">{stats.totalUniqueTeammates}</p>
            <p className="text-xs text-slate-500">Teammates</p>
          </div>
        </motion.div>

        {/* Key highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-2 mb-6"
        >
          {stats.favoriteClass && (
            <div className="flex items-center justify-between bg-white/5 px-4 py-3">
              <span className="text-slate-400 text-sm">Favorite Class</span>
              <span className="text-white font-semibold">{stats.favoriteClass}</span>
            </div>
          )}
          
          {stats.activitiesByType[0] && (
            <div className="flex items-center justify-between bg-white/5 px-4 py-3">
              <span className="text-slate-400 text-sm">Top Activity</span>
              <span className="text-white font-semibold">{stats.activitiesByType[0].modeName}</span>
            </div>
          )}

          <div className="flex items-center justify-between bg-white/5 px-4 py-3">
            <span className="text-slate-400 text-sm">Days Active</span>
            <span className="text-white font-semibold">{stats.activeDays}</span>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-auto space-y-3"
        >
          <button
            onClick={handleShare}
            className="w-full py-3 px-6 font-bold transition-all flex items-center justify-center gap-2"
            style={{ background: expansion.color, color: '#0f1115' }}
          >
            <Share2 className="w-5 h-5" />
            Share Your Wrapped
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 px-6 font-medium text-slate-300 bg-white/5 hover:bg-white/10 transition-all"
            >
              Done
            </button>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-6 space-y-3"
        >
          <p className="text-slate-600 text-xs">
            Generated by Warmind • {expansion.name}
          </p>
          
          {/* Ko-fi Support */}
          <div className="pt-2">
            <a
              href="https://ko-fi.com/warmind"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all bg-[#FF5E5B]/10 text-[#FF5E5B] hover:bg-[#FF5E5B]/20 border border-[#FF5E5B]/20"
            >
              <Heart className="w-4 h-4 fill-current" />
              <span>Support Warmind</span>
            </a>
          </div>
        </motion.div>
      </div>
    </WrappedCard>
  );
}

