'use client';

import {
  Award,
  Bird,
  Crown,
  Crosshair,
  Eye,
  Flame,
  Gamepad2,
  Gem,
  Leaf,
  Moon,
  Shield,
  Skull,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sword,
  Swords,
  Target,
  Trophy,
  Waves,
  Wind,
  Wand2,
  Zap,
  HardHat,
  HandMetal,
  Shirt,
  Footprints,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_LOADOUT_ICON } from './constants';

const LOADOUT_ICON_COMPONENTS: Record<string, LucideIcon> = {
  swords: Swords,
  sword: Sword,
  shield: Shield,
  crosshair: Crosshair,
  flame: Flame,
  snowflake: Snowflake,
  zap: Zap,
  sparkles: Sparkles,
  leaf: Leaf,
  star: Star,
  skull: Skull,
  eye: Eye,
  target: Target,
  gem: Gem,
  moon: Moon,
  sun: Sun,
  waves: Waves,
  wind: Wind,
  wolf: Shield,
  bird: Bird,
  snake: Wind,
  crown: Crown,
  wand: Wand2,
  sparkle: Sparkles,
  gamepad: Gamepad2,
  trophy: Trophy,
};

const BUCKET_ICON_COMPONENTS: Record<string, LucideIcon> = {
  crosshair: Crosshair,
  zap: Zap,
  flame: Flame,
  helmet: HardHat,
  gauntlets: HandMetal,
  chest: Shirt,
  legs: Footprints,
  class: Award,
};

/** Maps legacy emoji icons from older saved loadouts to Lucide icon ids. */
const LEGACY_EMOJI_TO_ICON: Record<string, string> = {
  '⚔️': 'swords',
  '🗡️': 'sword',
  '🛡️': 'shield',
  '🏹': 'crosshair',
  '🔥': 'flame',
  '❄️': 'snowflake',
  '⚡': 'zap',
  '💜': 'sparkles',
  '💚': 'leaf',
  '🌟': 'star',
  '💀': 'skull',
  '👁️': 'eye',
  '🎯': 'target',
  '💎': 'gem',
  '🌙': 'moon',
  '☀️': 'sun',
  '🌊': 'waves',
  '🍃': 'leaf',
  '🐺': 'wolf',
  '🦅': 'bird',
  '🐍': 'snake',
  '🦁': 'crown',
  '🔮': 'wand',
  '⭐': 'star',
  '🎮': 'gamepad',
  '🏆': 'trophy',
  '🔫': 'crosshair',
  '💥': 'flame',
  '🪖': 'helmet',
  '🧤': 'gauntlets',
  '🦺': 'chest',
  '👖': 'legs',
  '🎗️': 'class',
};

export function resolveLoadoutIconId(icon: string | undefined): string {
  if (!icon) return DEFAULT_LOADOUT_ICON;
  return LEGACY_EMOJI_TO_ICON[icon] ?? icon;
}

function getLoadoutIconComponent(iconId: string): LucideIcon {
  return LOADOUT_ICON_COMPONENTS[iconId] ?? Swords;
}

function getBucketIconComponent(iconId: string): LucideIcon {
  return BUCKET_ICON_COMPONENTS[iconId] ?? Crosshair;
}

const LOADOUT_ICON_SIZE = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

interface LoadoutIconProps {
  icon: string | undefined;
  color?: string;
  size?: keyof typeof LOADOUT_ICON_SIZE;
  className?: string;
}

export function LoadoutIcon({ icon, color, size = 'md', className }: LoadoutIconProps) {
  const iconId = resolveLoadoutIconId(icon);
  const Icon = getLoadoutIconComponent(iconId);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        className,
      )}
      style={color ? { color } : undefined}
    >
      <Icon className={LOADOUT_ICON_SIZE[size]} />
    </span>
  );
}

interface LoadoutIconBadgeProps {
  icon: string | undefined;
  color?: string;
  className?: string;
}

export function LoadoutIconBadge({ icon, color = '#e3ce62', className }: LoadoutIconBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-black/30',
        className,
      )}
      style={{ borderColor: `${color}66`, color }}
    >
      <LoadoutIcon icon={icon} color={color} size="md" />
    </span>
  );
}

interface BucketIconProps {
  icon: string;
  className?: string;
}

export function BucketIcon({ icon, className }: BucketIconProps) {
  const iconId = resolveLoadoutIconId(icon);
  const Icon = getBucketIconComponent(iconId);

  return <Icon className={cn('h-5 w-5 text-slate-500', className)} />;
}

export { LOADOUT_ICON_COMPONENTS, getLoadoutIconComponent };
