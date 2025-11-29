'use client';

import { motion } from 'framer-motion';
import { Moon, Sun, Sunrise, Sunset, Clock } from 'lucide-react';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats, getTimeOfDayLabel } from '@/lib/wrappedStats';

interface TimeOfDayCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

export function TimeOfDayCard({ expansion, stats }: TimeOfDayCardProps) {
  const maxActivities = Math.max(...stats.timeOfDayStats.map(t => t.activitiesStarted), 1);
  const peakHour = stats.peakPlayHour;
  const timeLabel = getTimeOfDayLabel(peakHour);

  // Get icon for time of day
  const getTimeIcon = (hour: number) => {
    if (hour >= 5 && hour < 12) return <Sunrise className="w-8 h-8" />;
    if (hour >= 12 && hour < 17) return <Sun className="w-8 h-8" />;
    if (hour >= 17 && hour < 21) return <Sunset className="w-8 h-8" />;
    return <Moon className="w-8 h-8" />;
  };

  // Get a fun description based on play time
  const getTimeDescription = (hour: number) => {
    if (hour >= 0 && hour < 5) return "You're a true night owl! The Darkness never sleeps, and neither do you.";
    if (hour >= 5 && hour < 9) return "An early bird Guardian! You start your day by defending humanity.";
    if (hour >= 9 && hour < 12) return "A morning warrior. Coffee and combat go hand in hand.";
    if (hour >= 12 && hour < 14) return "Lunch break Destiny sessions? A true dedication!";
    if (hour >= 14 && hour < 17) return "Afternoon gaming - the perfect time to chase that exotic.";
    if (hour >= 17 && hour < 20) return "Prime time Guardian! You play when the servers are busiest.";
    if (hour >= 20 && hour < 23) return "Evening warrior. Nothing like winding down with some raids.";
    return "Late night Legend. The best loot drops after midnight, right?";
  };

  // Format hour to 12h format
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour} ${period}`;
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
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Your Schedule</p>
          <h2 className="text-3xl font-bold text-white">When You Play</h2>
        </motion.div>

        {/* Peak time highlight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full mb-4"
            style={{ background: `${expansion.color}20`, color: expansion.color }}
          >
            {getTimeIcon(peakHour)}
          </div>
          <p className="text-slate-400 text-sm mb-2">You're a</p>
          <h3 
            className="text-4xl font-bold mb-2"
            style={{ color: expansion.color }}
          >
            {timeLabel} Player
          </h3>
          <p className="text-slate-400">
            Peak activity at <span className="text-white font-semibold">{formatHour(peakHour)}</span>
          </p>
        </motion.div>

        {/* Hour chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex-1"
        >
          <div className="flex items-end justify-between gap-1 h-32">
            {stats.timeOfDayStats.map((hourStat, index) => {
              const height = (hourStat.activitiesStarted / maxActivities) * 100;
              const isPeak = hourStat.hour === peakHour;
              
              return (
                <motion.div
                  key={hourStat.hour}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(height, 4)}%` }}
                  transition={{ delay: 0.6 + index * 0.02, duration: 0.3 }}
                  className="relative flex-1 rounded-t-sm group cursor-pointer"
                  style={{ 
                    background: isPeak 
                      ? expansion.color 
                      : `${expansion.color}40`,
                  }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-slate-800 px-2 py-1 text-xs whitespace-nowrap border border-white/10">
                      <p className="text-white font-medium">{formatHour(hourStat.hour)}</p>
                      <p className="text-slate-400">{hourStat.activitiesStarted} activities</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Hour labels */}
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>12AM</span>
            <span>6AM</span>
            <span>12PM</span>
            <span>6PM</span>
            <span>12AM</span>
          </div>
        </motion.div>

        {/* Fun description */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center"
        >
          <p className="text-slate-400 text-sm italic">
            "{getTimeDescription(peakHour)}"
          </p>
        </motion.div>
      </div>
    </WrappedCard>
  );
}

