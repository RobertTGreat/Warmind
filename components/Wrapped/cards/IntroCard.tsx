'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { WrappedCard } from '../WrappedCard';
import { Expansion } from '@/data/d2/expansions';

interface IntroCardProps {
  expansion: Expansion;
  displayName: string;
}

export function IntroCard({ expansion, displayName }: IntroCardProps) {
  return (
    <WrappedCard accentColor={expansion.color}>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Animated sparkles */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 0.2 }}
          className="mb-8"
        >
          <div 
            className="w-24 h-24 flex items-center justify-center"
          >
            <Sparkles className="w-12 h-12" style={{ color: expansion.color }} />
          </div>
        </motion.div>

        {/* Welcome text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-slate-400 text-lg mb-2">Welcome back,</p>
          <h1 
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: expansion.color }}
          >
            {displayName}
          </h1>
        </motion.div>

        {/* Expansion info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <p className="text-slate-500 uppercase tracking-widest text-sm mb-2">
            Your journey through
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            {expansion.name}
          </h2>
          <p className="text-slate-500 mt-2">
            {new Date(expansion.releaseDate).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })} — {new Date(expansion.endDate).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-slate-400 italic text-lg"
        >
          "{expansion.tagline}"
        </motion.p>
      </div>
    </WrappedCard>
  );
}

