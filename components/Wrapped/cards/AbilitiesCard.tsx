'use client';

import { motion } from 'framer-motion';
import { Zap, Flame, Sword, Sparkles } from 'lucide-react';
import { WrappedCard, AnimatedCounter } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';
import { WrappedStats } from '@/lib/wrappedStats';

interface AbilitiesCardProps {
  expansion: Expansion;
  stats: WrappedStats;
}

const ABILITY_CONFIG = [
  { 
    key: 'superKills', 
    label: 'Super Kills', 
    icon: Zap, 
    color: '#FFD700',
    description: 'Enemies defeated with your Super'
  },
  { 
    key: 'grenadeKills', 
    label: 'Grenade Kills', 
    icon: Flame, 
    color: '#FF6B35',
    description: 'Explosive eliminations'
  },
  { 
    key: 'meleeKills', 
    label: 'Melee Kills', 
    icon: Sword, 
    color: '#4CAF50',
    description: 'Up close and personal'
  },
] as const;

export function AbilitiesCard({ expansion, stats }: AbilitiesCardProps) {
  const { abilityStats } = stats;
  const totalAbilityKills = abilityStats.superKills + abilityStats.grenadeKills + 
                            abilityStats.meleeKills;
  const hasAbilityData = totalAbilityKills > 0;

  // Find the favorite ability
  const abilities = [
    { name: 'Super', kills: abilityStats.superKills, icon: Zap, color: '#FFD700' },
    { name: 'Grenade', kills: abilityStats.grenadeKills, icon: Flame, color: '#FF6B35' },
    { name: 'Melee', kills: abilityStats.meleeKills, icon: Sword, color: '#4CAF50' },
  ].sort((a, b) => b.kills - a.kills);

  const favoriteAbility = abilities[0];

  // Get playstyle description
  const getPlaystyle = () => {
    if (!hasAbilityData) return { title: 'The Silent One', desc: 'Guns do the talking' };
    
    const topAbility = favoriteAbility.name;
    const ratio = stats.totalKills > 0 ? totalAbilityKills / stats.totalKills : 0;
    
    if (ratio > 0.3) {
      if (topAbility === 'Super') return { title: 'The Nova Bomber', desc: 'Maximum power, maximum explosions' };
      if (topAbility === 'Grenade') return { title: 'The Demolitionist', desc: 'Why shoot when you can throw?' };
      if (topAbility === 'Melee') return { title: 'The Brawler', desc: 'Fists speak louder than guns' };
    }
    return { title: 'The Gunslinger', desc: 'Abilities are just backup' };
  };

  const playstyle = getPlaystyle();

  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">Your Light</p>
          <h2 className="text-3xl font-bold text-white">Ability Mastery</h2>
        </motion.div>

        {/* Playstyle title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h3 
            className="text-2xl font-bold mb-1"
            style={{ color: favoriteAbility?.color || expansion.color }}
          >
            {playstyle.title}
          </h3>
          <p className="text-slate-400 text-sm italic">"{playstyle.desc}"</p>
        </motion.div>

        {/* Ability stats - Triangle layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          {/* Top row - Super and Grenade */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {ABILITY_CONFIG.slice(0, 2).map((ability, index) => {
              const Icon = ability.icon;
              const value = abilityStats[ability.key as keyof typeof abilityStats];
              const isFavorite = ability.key === `${favoriteAbility?.name.toLowerCase()}Kills`;

              return (
                <motion.div
                  key={ability.key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="relative p-4 text-center"
                  style={{ 
                    background: `${ability.color}15`,
                    boxShadow: isFavorite ? `0 0 0 2px ${ability.color}` : 'none',
                  }}
                >
                  {isFavorite && (
                    <span 
                      className="absolute -top-2 -right-2 text-xs px-2 py-0.5 font-bold"
                      style={{ background: ability.color, color: '#0f1115' }}
                    >
                      #1
                    </span>
                  )}
                  
                  <Icon 
                    className="w-8 h-8 mx-auto mb-2" 
                    style={{ color: ability.color }}
                  />
                  <p className="text-xl font-bold text-white">
                    <AnimatedCounter value={value} duration={1.5} />
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{ability.label}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom row - Melee centered */}
          <div className="flex justify-center">
            {(() => {
              const ability = ABILITY_CONFIG[2]; // Melee
              const Icon = ability.icon;
              const value = abilityStats[ability.key as keyof typeof abilityStats];
              const isFavorite = ability.key === `${favoriteAbility?.name.toLowerCase()}Kills`;

              return (
                <motion.div
                  key={ability.key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 }}
                  className="relative p-4 text-center w-1/2"
                  style={{ 
                    background: `${ability.color}15`,
                    boxShadow: isFavorite ? `0 0 0 2px ${ability.color}` : 'none',
                  }}
                >
                  {isFavorite && (
                    <span 
                      className="absolute -top-2 -right-2 text-xs px-2 py-0.5 font-bold"
                      style={{ background: ability.color, color: '#0f1115' }}
                    >
                      #1
                    </span>
                  )}
                  
                  <Icon 
                    className="w-8 h-8 mx-auto mb-2" 
                    style={{ color: ability.color }}
                  />
                  <p className="text-xl font-bold text-white">
                    <AnimatedCounter value={value} duration={1.5} />
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{ability.label}</p>
                </motion.div>
              );
            })()}
          </div>
        </motion.div>

        {/* Fun fact */}
        {hasAbilityData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-auto pt-4 text-center border-t border-white/5"
          >
            <p className="text-slate-500 text-sm">
              {totalAbilityKills > 1000 ? (
                <>You're a true <span className="text-white font-semibold">ability spammer</span>!</>
              ) : totalAbilityKills > 500 ? (
                <>Abilities make up a solid part of your kills</>
              ) : (
                <>You prefer to let your weapons do the work</>
              )}
            </p>
          </motion.div>
        )}
      </div>
    </WrappedCard>
  );
}

