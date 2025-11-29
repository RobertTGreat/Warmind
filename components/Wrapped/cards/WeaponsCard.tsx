'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Target, Flame } from 'lucide-react';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats } from '@/lib/wrappedStats';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { getBungieImage } from '@/lib/bungie';

interface WeaponsCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

export function WeaponsCard({ expansion, stats }: WeaponsCardProps) {
  const topWeapons = stats.topWeapons.slice(0, 5);
  const hasWeapons = topWeapons.length > 0;
  const totalWeaponKills = topWeapons.reduce((sum, w) => sum + w.kills, 0);

  // Fetch weapon definitions for names and icons
  const weaponHashes = useMemo(() => topWeapons.map(w => w.weaponHash), [topWeapons]);
  const { definitions: weaponDefs, isLoading: isLoadingDefs } = useItemDefinitions(weaponHashes);

  // Get precision rating text
  const getPrecisionRating = (rate: number) => {
    if (rate >= 0.7) return { text: 'Marksman', color: '#FFD700' };
    if (rate >= 0.5) return { text: 'Sharpshooter', color: '#4CAF50' };
    if (rate >= 0.3) return { text: 'Accurate', color: '#2196F3' };
    return { text: 'Spray & Pray', color: '#9E9E9E' };
  };

  // Overall precision rate
  const overallPrecision = stats.abilityStats.precisionKills > 0 && stats.totalKills > 0
    ? stats.abilityStats.precisionKills / stats.totalKills
    : 0;

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Your Arsenal</p>
          <h2 className="text-3xl font-bold text-white">Favorite Weapons</h2>
        </motion.div>

        {/* Precision stat */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-6 mb-6"
        >
          <div className="text-center">
            <div 
              className="w-16 h-16 mx-auto mb-2 flex items-center justify-center"
            >
              <Target className="w-8 h-8" style={{ color: expansion.color }} />
            </div>
            <p className="text-2xl font-bold text-white">
              {(overallPrecision * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-slate-500">Precision Rate</p>
          </div>
          <div className="text-center">
            <div 
              className="w-16 h-16 mx-auto mb-2 flex items-center justify-center"
            >
              <Crosshair className="w-8 h-8" style={{ color: expansion.color }} />
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.abilityStats.precisionKills.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">Precision Kills</p>
          </div>
        </motion.div>

        {/* Top weapons */}
        {hasWeapons ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3 flex-1"
          >
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4" style={{ color: expansion.color }} />
              <span className="text-sm text-slate-400 uppercase tracking-wide">Top Weapons</span>
            </div>

            {topWeapons.map((weapon, index) => {
              const percentage = totalWeaponKills > 0 
                ? (weapon.kills / totalWeaponKills) * 100 
                : 0;
              const precision = getPrecisionRating(weapon.precisionRate);
              const weaponDef = weaponDefs[weapon.weaponHash];
              const weaponName = weaponDef?.displayProperties?.name || `Unknown Weapon`;
              const weaponIcon = weaponDef?.displayProperties?.icon;
              const weaponType = weaponDef?.itemTypeDisplayName || '';

              return (
                <motion.div
                  key={weapon.weaponHash}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-white/5 p-3"
                >
                  <div className="flex items-center gap-3 mb-2">

                    {/* Weapon icon */}
                    <div className="w-10 h-10 overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
                      {weaponIcon ? (
                        <img 
                          src={getBungieImage(weaponIcon)} 
                          alt={weaponName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Crosshair className="w-5 h-5 text-slate-600" />
                      )}
                    </div>

                    {/* Weapon info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate">
                            {weaponName}
                          </p>
                          {weaponType && (
                            <p className="text-xs text-slate-500 truncate">{weaponType}</p>
                          )}
                        </div>
                        <span 
                          className="text-xs px-2 py-0.5 shrink-0"
                          style={{ background: `${precision.color}30`, color: precision.color }}
                        >
                          {(weapon.precisionRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400">
                          {weapon.kills.toLocaleString()} kills
                        </span>
                        <span className="text-xs text-red-400">
                          {weapon.precisionKills.toLocaleString()} crit
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ background: expansion.color }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center">
              <p className="text-slate-500">No weapon data available.</p>
              <p className="text-slate-600 text-sm mt-2">
                PGCR data is needed to track weapons.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </WrappedCard>
  );
}

