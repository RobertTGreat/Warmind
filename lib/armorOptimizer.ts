/**
 * Armor Optimizer Utilities
 * Inspired by D2ArmorPicker - finds optimal armor combinations for target stats
 * Updated for Edge of Fate (Armor 3.0) - Stats cap at 200 (T20)
 * https://github.com/Mijago/D2ArmorPicker
 * https://github.com/DestinyItemManager/DIM
 */

import { BUCKETS, STAT_HASHES, ARMOR_STAT_HASHES, getArmorBaseStats } from './destinyUtils';

// ===== Types =====

// Edge of Fate (Armor 3.0) Stats - Cap at 200 (T20)
// Old names → New names:
// Mobility → Weapons (reload speed, handling, damage)
// Resilience → Health (shields, flinch resistance)
// Recovery → Class (class ability cooldown)
// Discipline → Grenade (grenade cooldown)
// Intellect → Super (super energy gain)
// Strength → Melee (melee cooldown)

export interface ArmorStats {
    weapons: number;   // Was Mobility
    health: number;    // Was Resilience
    class: number;     // Was Recovery
    grenade: number;   // Was Discipline
    super: number;     // Was Intellect
    melee: number;     // Was Strength
}

export interface ArmorPiece {
    itemHash: number;
    itemInstanceId: string;
    bucketHash: number;
    name: string;
    icon: string;
    classType: number;
    tierType: number; // 5 = Legendary, 6 = Exotic
    baseStats: ArmorStats;
    totalStats: number;
    isMasterworked: boolean;
    isArtifice: boolean;
    isExotic: boolean;
    exoticPerk?: string;
}

export interface StatConstraints {
    weapons: { min: number; max: number };
    health: { min: number; max: number };
    class: { min: number; max: number };
    grenade: { min: number; max: number };
    super: { min: number; max: number };
    melee: { min: number; max: number };
}

export interface StatPriority {
    stat: keyof ArmorStats;
    priority: number;
}

export interface ModConfiguration {
    stat: keyof ArmorStats;
    value: number;
    cost: number;
}

export interface FragmentBonus {
    name: string;
    stat: keyof ArmorStats;
    value: number;
}

export interface SubclassConfig {
    name: string;
    fragments: FragmentBonus[];
    totalBonus: ArmorStats;
}

export interface ArmorSet {
    helmet: ArmorPiece;
    gauntlets: ArmorPiece;
    chest: ArmorPiece;
    legs: ArmorPiece;
    classItem: ArmorPiece;
    baseStats: ArmorStats;
    totalStats: ArmorStats;
    totalBaseStats: number;
    tiers: number;
    exoticCount: number;
    modsNeeded: ModConfiguration[];
    modEnergyCost: number;
    wastedStats: number;
    artificeSlots: number;
}

export interface ExoticFilter {
    itemHash: number | null;
    slot: 'helmet' | 'gauntlets' | 'chest' | 'legs' | 'any' | 'none';
}

export interface OptimizerSettings {
    assumeMasterwork: boolean;
    assumeClassItemMasterwork: boolean;
    allowExotics: boolean;
    maxExotics: number;
    useClassItemBonus: boolean;
    priorityStats: (keyof ArmorStats)[];
    artificeBonus: boolean;
    minimizeWaste: boolean;
    onlyMasterworked: boolean;
    ignoreSunset: boolean;
    exoticFilter: ExoticFilter;
    subclassConfig: SubclassConfig | null;
}

export interface OptimizerConfig {
    id: string;
    name: string;
    classType: number;
    constraints: StatConstraints;
    settings: OptimizerSettings;
    createdAt: string;
    updatedAt: string;
}

// ===== Constants =====

// Max stat value is now 200 (T20)
export const MAX_STAT_VALUE = 200;
export const MAX_TIER = 20;
export const STAT_PER_TIER = 10;

export const DEFAULT_CONSTRAINTS: StatConstraints = {
    weapons: { min: 0, max: MAX_STAT_VALUE },
    health: { min: 0, max: MAX_STAT_VALUE },
    class: { min: 0, max: MAX_STAT_VALUE },
    grenade: { min: 0, max: MAX_STAT_VALUE },
    super: { min: 0, max: MAX_STAT_VALUE },
    melee: { min: 0, max: MAX_STAT_VALUE },
};

export const DEFAULT_SETTINGS: OptimizerSettings = {
    assumeMasterwork: true,
    assumeClassItemMasterwork: true,
    allowExotics: true,
    maxExotics: 1,
    useClassItemBonus: false,
    priorityStats: ['health', 'class', 'grenade'],
    artificeBonus: true,
    minimizeWaste: true,
    onlyMasterworked: false,
    ignoreSunset: true,
    exoticFilter: { itemHash: null, slot: 'any' },
    subclassConfig: null,
};

// New Edge of Fate stat names
export const STAT_NAMES: Record<keyof ArmorStats, string> = {
    weapons: 'Weapons',
    health: 'Health',
    class: 'Class',
    grenade: 'Grenade',
    super: 'Super',
    melee: 'Melee',
};

// Stat descriptions for tooltips
export const STAT_DESCRIPTIONS: Record<keyof ArmorStats, string> = {
    weapons: 'Reload speed, handling, damage',
    health: 'Shield recharge, flinch resistance',
    class: 'Class ability cooldown',
    grenade: 'Grenade cooldown',
    super: 'Super energy gain',
    melee: 'Melee cooldown',
};

// Official D2 stat icons from Bungie (using correct hashes)
export const STAT_ICON_URLS: Record<keyof ArmorStats, string> = {
    weapons: 'https://www.bungie.net/common/destiny2_content/icons/e26e0e93a9daf4fdd21bf64eb9246340.png',   // Mobility/Weapons
    health: 'https://www.bungie.net/common/destiny2_content/icons/202ecc1c6febeb6b97dafc856e863140.png',    // Resilience/Health
    class: 'https://www.bungie.net/common/destiny2_content/icons/128eee4ee7fc127851ab32eac6ca617c.png',     // Recovery/Class
    grenade: 'https://www.bungie.net/common/destiny2_content/icons/79be2d4adef6a19203f7385e5c63b45b.png',   // Discipline/Grenade
    super: 'https://www.bungie.net/common/destiny2_content/icons/d1c154469670e9a592c9d4cbdcae5764.png',     // Intellect/Super
    melee: 'https://www.bungie.net/common/destiny2_content/icons/ea5af04ccd6a3c7f7b35f56b7da70e16.png',     // Strength/Melee
};

// Unicode stat icons for text display
export const STAT_ICONS: Record<keyof ArmorStats, string> = {
    weapons: '⚔',
    health: '🛡',
    class: '⬡',
    grenade: '💥',
    super: '⚡',
    melee: '✊',
};

// Stat colors for UI
export const STAT_COLORS: Record<keyof ArmorStats, { bg: string; fill: string; glow: string; text: string; border: string }> = {
    weapons: { bg: 'bg-sky-500/20', fill: 'bg-sky-500', glow: 'shadow-sky-500/50', text: 'text-sky-400', border: 'border-sky-500' },
    health: { bg: 'bg-red-500/20', fill: 'bg-red-500', glow: 'shadow-red-500/50', text: 'text-red-400', border: 'border-red-500' },
    class: { bg: 'bg-emerald-500/20', fill: 'bg-emerald-500', glow: 'shadow-emerald-500/50', text: 'text-emerald-400', border: 'border-emerald-500' },
    grenade: { bg: 'bg-amber-500/20', fill: 'bg-amber-500', glow: 'shadow-amber-500/50', text: 'text-amber-400', border: 'border-amber-500' },
    super: { bg: 'bg-purple-500/20', fill: 'bg-purple-500', glow: 'shadow-purple-500/50', text: 'text-purple-400', border: 'border-purple-500' },
    melee: { bg: 'bg-orange-500/20', fill: 'bg-orange-500', glow: 'shadow-orange-500/50', text: 'text-orange-400', border: 'border-orange-500' },
};

// Mod costs and values
export const STAT_MODS = {
    minor: { value: 5, cost: 3 },
    major: { value: 10, cost: 5 },
    artifice: { value: 3, cost: 0 },
};

// Maximum mod slots
export const MAX_MOD_SLOTS = 5;
export const MAX_ARTIFICE_SLOTS = 5;

// All stat keys for iteration (ordered as: Health, Melee, Grenade, Super, Class, Weapon)
export const ALL_STAT_KEYS: (keyof ArmorStats)[] = [
    'health', 'melee', 'grenade', 'super', 'class', 'weapons'
];

// Mapping from old API stat hashes to new stat names
export const STAT_HASH_TO_KEY: Record<number, keyof ArmorStats> = {
    [STAT_HASHES.MOBILITY]: 'weapons',
    [STAT_HASHES.RESILIENCE]: 'health',
    [STAT_HASHES.RECOVERY]: 'class',
    [STAT_HASHES.DISCIPLINE]: 'grenade',
    [STAT_HASHES.INTELLECT]: 'super',
    [STAT_HASHES.STRENGTH]: 'melee',
};

// Fragment data with icons (using new stat names)
export interface FragmentData {
    name: string;
    hash?: number;
    icon?: string;
    subclass: 'solar' | 'void' | 'arc' | 'stasis' | 'strand';
    bonuses: FragmentBonus[];
}

export const FRAGMENT_DATA: Record<string, FragmentData> = {
    // Solar Fragments
    'Ember of Benevolence': { name: 'Ember of Benevolence', subclass: 'solar', bonuses: [{ name: 'Ember of Benevolence', stat: 'grenade', value: -10 }] },
    'Ember of Beams': { name: 'Ember of Beams', subclass: 'solar', bonuses: [{ name: 'Ember of Beams', stat: 'super', value: 10 }] },
    'Ember of Combustion': { name: 'Ember of Combustion', hash: 362132289, subclass: 'solar', bonuses: [{ name: 'Ember of Combustion', stat: 'melee', value: 10 }] },
    'Ember of Char': { name: 'Ember of Char', subclass: 'solar', bonuses: [{ name: 'Ember of Char', stat: 'grenade', value: -10 }] },
    'Ember of Eruption': { name: 'Ember of Eruption', subclass: 'solar', bonuses: [{ name: 'Ember of Eruption', stat: 'melee', value: -10 }] },
    'Ember of Searing': { name: 'Ember of Searing', subclass: 'solar', bonuses: [{ name: 'Ember of Searing', stat: 'class', value: -10 }] },
    'Ember of Singeing': { name: 'Ember of Singeing', subclass: 'solar', bonuses: [{ name: 'Ember of Singeing', stat: 'grenade', value: -10 }] },
    'Ember of Solace': { name: 'Ember of Solace', subclass: 'solar', bonuses: [{ name: 'Ember of Solace', stat: 'health', value: 10 }] },
    'Ember of Wonder': { name: 'Ember of Wonder', subclass: 'solar', bonuses: [{ name: 'Ember of Wonder', stat: 'health', value: 10 }] },
    'Ember of Torches': { name: 'Ember of Torches', hash: 362132288, subclass: 'solar', bonuses: [] },
    // Void Fragments
    'Echo of Cessation': { name: 'Echo of Cessation', hash: 3854948620, subclass: 'void', bonuses: [{ name: 'Echo of Cessation', stat: 'class', value: 10 }] },
    'Echo of Dilation': { name: 'Echo of Dilation', hash: 2272984656, subclass: 'void', bonuses: [{ name: 'Echo of Dilation', stat: 'weapons', value: 10 }, { name: 'Echo of Dilation', stat: 'super', value: 10 }] },
    'Echo of Domineering': { name: 'Echo of Domineering', hash: 2272984657, subclass: 'void', bonuses: [{ name: 'Echo of Domineering', stat: 'grenade', value: 10 }] },
    'Echo of Exchange': { name: 'Echo of Exchange', hash: 2272984667, subclass: 'void', bonuses: [{ name: 'Echo of Exchange', stat: 'super', value: -10 }] },
    'Echo of Expulsion': { name: 'Echo of Expulsion', hash: 2272984665, subclass: 'void', bonuses: [{ name: 'Echo of Expulsion', stat: 'super', value: -10 }] },
    'Echo of Harvest': { name: 'Echo of Harvest', hash: 2661180601, subclass: 'void', bonuses: [{ name: 'Echo of Harvest', stat: 'super', value: -10 }] },
    'Echo of Instability': { name: 'Echo of Instability', hash: 2661180600, subclass: 'void', bonuses: [{ name: 'Echo of Instability', stat: 'melee', value: 10 }] },
    'Echo of Leeching': { name: 'Echo of Leeching', hash: 2272984670, subclass: 'void', bonuses: [{ name: 'Echo of Leeching', stat: 'health', value: -10 }] },
    'Echo of Obscurity': { name: 'Echo of Obscurity', hash: 2661180602, subclass: 'void', bonuses: [{ name: 'Echo of Obscurity', stat: 'class', value: 10 }] },
    'Echo of Persistence': { name: 'Echo of Persistence', hash: 2272984671, subclass: 'void', bonuses: [{ name: 'Echo of Persistence', stat: 'weapons', value: -10 }] },
    'Echo of Provision': { name: 'Echo of Provision', subclass: 'void', bonuses: [{ name: 'Echo of Provision', stat: 'melee', value: -10 }] },
    'Echo of Remnants': { name: 'Echo of Remnants', subclass: 'void', bonuses: [{ name: 'Echo of Remnants', stat: 'grenade', value: -10 }] },
    'Echo of Reprisal': { name: 'Echo of Reprisal', subclass: 'void', bonuses: [{ name: 'Echo of Reprisal', stat: 'weapons', value: 10 }] },
    'Echo of Starvation': { name: 'Echo of Starvation', subclass: 'void', bonuses: [{ name: 'Echo of Starvation', stat: 'class', value: -10 }] },
    'Echo of Undermining': { name: 'Echo of Undermining', subclass: 'void', bonuses: [{ name: 'Echo of Undermining', stat: 'grenade', value: -20 }] },
    // Arc Fragments
    'Spark of Beacons': { name: 'Spark of Beacons', subclass: 'arc', bonuses: [{ name: 'Spark of Beacons', stat: 'health', value: -10 }] },
    'Spark of Brilliance': { name: 'Spark of Brilliance', subclass: 'arc', bonuses: [{ name: 'Spark of Brilliance', stat: 'super', value: -10 }] },
    'Spark of Discharge': { name: 'Spark of Discharge', subclass: 'arc', bonuses: [{ name: 'Spark of Discharge', stat: 'melee', value: 10 }] },
    'Spark of Focus': { name: 'Spark of Focus', subclass: 'arc', bonuses: [{ name: 'Spark of Focus', stat: 'health', value: -10 }] },
    'Spark of Frequency': { name: 'Spark of Frequency', subclass: 'arc', bonuses: [{ name: 'Spark of Frequency', stat: 'health', value: -10 }] },
    'Spark of Haste': { name: 'Spark of Haste', subclass: 'arc', bonuses: [{ name: 'Spark of Haste', stat: 'class', value: -10 }] },
    'Spark of Instinct': { name: 'Spark of Instinct', subclass: 'arc', bonuses: [{ name: 'Spark of Instinct', stat: 'melee', value: 10 }] },
    'Spark of Magnitude': { name: 'Spark of Magnitude', subclass: 'arc', bonuses: [{ name: 'Spark of Magnitude', stat: 'grenade', value: -10 }] },
    'Spark of Momentum': { name: 'Spark of Momentum', subclass: 'arc', bonuses: [{ name: 'Spark of Momentum', stat: 'melee', value: -10 }] },
    'Spark of Recharge': { name: 'Spark of Recharge', subclass: 'arc', bonuses: [{ name: 'Spark of Recharge', stat: 'melee', value: -10 }] },
    'Spark of Resistance': { name: 'Spark of Resistance', subclass: 'arc', bonuses: [{ name: 'Spark of Resistance', stat: 'melee', value: -10 }] },
    'Spark of Shock': { name: 'Spark of Shock', subclass: 'arc', bonuses: [{ name: 'Spark of Shock', stat: 'grenade', value: -10 }] },
    'Spark of Volts': { name: 'Spark of Volts', subclass: 'arc', bonuses: [{ name: 'Spark of Volts', stat: 'class', value: 10 }] },
    // Stasis Fragments
    'Whisper of Bonds': { name: 'Whisper of Bonds', subclass: 'stasis', bonuses: [{ name: 'Whisper of Bonds', stat: 'super', value: -10 }, { name: 'Whisper of Bonds', stat: 'grenade', value: -10 }] },
    'Whisper of Chains': { name: 'Whisper of Chains', subclass: 'stasis', bonuses: [{ name: 'Whisper of Chains', stat: 'class', value: -10 }] },
    'Whisper of Conduction': { name: 'Whisper of Conduction', subclass: 'stasis', bonuses: [{ name: 'Whisper of Conduction', stat: 'health', value: 10 }, { name: 'Whisper of Conduction', stat: 'super', value: 10 }] },
    'Whisper of Durance': { name: 'Whisper of Durance', subclass: 'stasis', bonuses: [{ name: 'Whisper of Durance', stat: 'melee', value: 10 }] },
    'Whisper of Fissures': { name: 'Whisper of Fissures', subclass: 'stasis', bonuses: [{ name: 'Whisper of Fissures', stat: 'super', value: -10 }] },
    'Whisper of Fractures': { name: 'Whisper of Fractures', subclass: 'stasis', bonuses: [{ name: 'Whisper of Fractures', stat: 'grenade', value: -10 }] },
    'Whisper of Hedrons': { name: 'Whisper of Hedrons', subclass: 'stasis', bonuses: [{ name: 'Whisper of Hedrons', stat: 'melee', value: -10 }] },
    'Whisper of Hunger': { name: 'Whisper of Hunger', subclass: 'stasis', bonuses: [{ name: 'Whisper of Hunger', stat: 'weapons', value: -10 }, { name: 'Whisper of Hunger', stat: 'class', value: -10 }] },
    'Whisper of Impetus': { name: 'Whisper of Impetus', subclass: 'stasis', bonuses: [{ name: 'Whisper of Impetus', stat: 'health', value: -10 }] },
    'Whisper of Refraction': { name: 'Whisper of Refraction', subclass: 'stasis', bonuses: [{ name: 'Whisper of Refraction', stat: 'health', value: -10 }] },
    'Whisper of Rending': { name: 'Whisper of Rending', subclass: 'stasis', bonuses: [{ name: 'Whisper of Rending', stat: 'weapons', value: -10 }] },
    'Whisper of Rime': { name: 'Whisper of Rime', subclass: 'stasis', bonuses: [{ name: 'Whisper of Rime', stat: 'health', value: 10 }, { name: 'Whisper of Rime', stat: 'melee', value: 10 }] },
    'Whisper of Shards': { name: 'Whisper of Shards', subclass: 'stasis', bonuses: [{ name: 'Whisper of Shards', stat: 'health', value: 10 }] },
    'Whisper of Torment': { name: 'Whisper of Torment', subclass: 'stasis', bonuses: [{ name: 'Whisper of Torment', stat: 'grenade', value: 10 }] },
    // Strand Fragments
    'Thread of Ascent': { name: 'Thread of Ascent', subclass: 'strand', bonuses: [{ name: 'Thread of Ascent', stat: 'weapons', value: 10 }] },
    'Thread of Binding': { name: 'Thread of Binding', subclass: 'strand', bonuses: [{ name: 'Thread of Binding', stat: 'health', value: 10 }] },
    'Thread of Continuity': { name: 'Thread of Continuity', subclass: 'strand', bonuses: [{ name: 'Thread of Continuity', stat: 'melee', value: 10 }] },
    'Thread of Evolution': { name: 'Thread of Evolution', subclass: 'strand', bonuses: [{ name: 'Thread of Evolution', stat: 'super', value: 10 }] },
    'Thread of Finality': { name: 'Thread of Finality', subclass: 'strand', bonuses: [{ name: 'Thread of Finality', stat: 'class', value: 10 }] },
    'Thread of Fury': { name: 'Thread of Fury', subclass: 'strand', bonuses: [{ name: 'Thread of Fury', stat: 'melee', value: -10 }] },
    'Thread of Generation': { name: 'Thread of Generation', subclass: 'strand', bonuses: [{ name: 'Thread of Generation', stat: 'grenade', value: -10 }] },
    'Thread of Isolation': { name: 'Thread of Isolation', subclass: 'strand', bonuses: [{ name: 'Thread of Isolation', stat: 'grenade', value: 10 }] },
    'Thread of Mind': { name: 'Thread of Mind', subclass: 'strand', bonuses: [{ name: 'Thread of Mind', stat: 'weapons', value: -10 }] },
    'Thread of Propagation': { name: 'Thread of Propagation', subclass: 'strand', bonuses: [{ name: 'Thread of Propagation', stat: 'melee', value: -10 }] },
    'Thread of Rebirth': { name: 'Thread of Rebirth', subclass: 'strand', bonuses: [{ name: 'Thread of Rebirth', stat: 'health', value: -10 }] },
    'Thread of Transmutation': { name: 'Thread of Transmutation', subclass: 'strand', bonuses: [{ name: 'Thread of Transmutation', stat: 'melee', value: 10 }] },
    'Thread of Warding': { name: 'Thread of Warding', subclass: 'strand', bonuses: [{ name: 'Thread of Warding', stat: 'class', value: -10 }] },
    'Thread of Wisdom': { name: 'Thread of Wisdom', subclass: 'strand', bonuses: [{ name: 'Thread of Wisdom', stat: 'grenade', value: 10 }] },
};

// Legacy format for backwards compatibility
export const SUBCLASS_FRAGMENTS: Record<string, FragmentBonus[]> = Object.fromEntries(
    Object.entries(FRAGMENT_DATA).map(([name, data]) => [name, data.bonuses])
);

// Subclass colors
export const SUBCLASS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    solar: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500' },
    void: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500' },
    arc: { bg: 'bg-blue-400/20', text: 'text-blue-400', border: 'border-blue-400' },
    stasis: { bg: 'bg-cyan-400/20', text: 'text-cyan-300', border: 'border-cyan-400' },
    strand: { bg: 'bg-green-400/20', text: 'text-green-400', border: 'border-green-400' },
    prismatic: { bg: 'bg-white/10', text: 'text-white', border: 'border-white/50' },
};

// ===== Helper Functions =====

export function createEmptyStats(): ArmorStats {
    return {
        weapons: 0,
        health: 0,
        class: 0,
        grenade: 0,
        super: 0,
        melee: 0,
    };
}

export function sumStats(...statArrays: ArmorStats[]): ArmorStats {
    const result = createEmptyStats();
    
    for (const stats of statArrays) {
        result.weapons += stats.weapons;
        result.health += stats.health;
        result.class += stats.class;
        result.grenade += stats.grenade;
        result.super += stats.super;
        result.melee += stats.melee;
    }
    
    return result;
}

export function addStatBonus(stats: ArmorStats, stat: keyof ArmorStats, value: number): ArmorStats {
    return {
        ...stats,
        [stat]: stats[stat] + value,
    };
}

export function applyFragmentBonuses(stats: ArmorStats, fragments: FragmentBonus[]): ArmorStats {
    const result = { ...stats };
    for (const fragment of fragments) {
        result[fragment.stat] += fragment.value;
    }
    return result;
}

export function getTotalStats(stats: ArmorStats): number {
    return stats.weapons + stats.health + stats.class + 
           stats.grenade + stats.super + stats.melee;
}

// T20 tier calculation (200 max, 10 per tier)
export function getTiers(stats: ArmorStats): number {
    return Math.floor(Math.min(MAX_STAT_VALUE, stats.weapons) / STAT_PER_TIER) +
           Math.floor(Math.min(MAX_STAT_VALUE, stats.health) / STAT_PER_TIER) +
           Math.floor(Math.min(MAX_STAT_VALUE, stats.class) / STAT_PER_TIER) +
           Math.floor(Math.min(MAX_STAT_VALUE, stats.grenade) / STAT_PER_TIER) +
           Math.floor(Math.min(MAX_STAT_VALUE, stats.super) / STAT_PER_TIER) +
           Math.floor(Math.min(MAX_STAT_VALUE, stats.melee) / STAT_PER_TIER);
}

export function getStatTier(value: number): number {
    return Math.floor(Math.min(MAX_STAT_VALUE, value) / STAT_PER_TIER);
}

export function getWastedStats(stats: ArmorStats): number {
    const calcWaste = (val: number) => {
        const capped = Math.min(MAX_STAT_VALUE, val);
        const over = Math.max(0, val - MAX_STAT_VALUE);
        return (capped % STAT_PER_TIER) + over;
    };
    
    return calcWaste(stats.weapons) + calcWaste(stats.health) + calcWaste(stats.class) +
           calcWaste(stats.grenade) + calcWaste(stats.super) + calcWaste(stats.melee);
}

/**
 * Extract armor piece data from profile/inventory data
 */
export function extractArmorPiece(
    item: any,
    itemDef: any,
    instanceData: any,
    socketsData: any,
    plugDefs: Record<number, any>
): ArmorPiece | null {
    if (!itemDef || itemDef.itemType !== 2) return null; // Not armor
    
    // Use definition bucket first (item.bucketHash can be VAULT for vault items)
    const defBucket = itemDef.inventory?.bucketTypeHash;
    const validBuckets = [
        BUCKETS.HELMET,
        BUCKETS.GAUNTLETS,
        BUCKETS.CHEST_ARMOR,
        BUCKETS.LEG_ARMOR,
        BUCKETS.CLASS_ARMOR,
    ];
    
    // Prioritize definition bucket to correctly identify vault items
    const bucketHash = validBuckets.includes(defBucket) ? defBucket : item.bucketHash;
    
    if (!validBuckets.includes(bucketHash)) return null;
    
    const isMasterworked = instanceData ? (instanceData.state & 4) === 4 : false;
    const isExotic = itemDef.inventory?.tierType === 6;
    
    // Check for Artifice slot
    let isArtifice = false;
    const ARTIFICE_MOD_HASHES = [4030660414, 455024236, 4164883102, 4026414261, 3121760799];
    
    if (socketsData?.sockets) {
        for (const socket of socketsData.sockets) {
            if (ARTIFICE_MOD_HASHES.includes(socket.plugHash)) {
                isArtifice = true;
                break;
            }
            if (socket.reusablePlugs) {
                for (const rp of socket.reusablePlugs) {
                    if (ARTIFICE_MOD_HASHES.includes(rp.plugItemHash)) {
                        isArtifice = true;
                        break;
                    }
                }
            }
        }
    }
    
    // Calculate base stats
    const activePlugs: any[] = [];
    if (socketsData?.sockets && plugDefs) {
        socketsData.sockets.forEach((socket: any) => {
            if (socket.plugHash && plugDefs[socket.plugHash]) {
                activePlugs.push(plugDefs[socket.plugHash]);
            }
        });
    }
    
    const rawBaseStats = instanceData?.stats 
        ? getArmorBaseStats(instanceData.stats, activePlugs, isMasterworked)
        : {};
    
    // Map old stat hashes to new stat keys
    const baseStats: ArmorStats = {
        weapons: rawBaseStats[STAT_HASHES.MOBILITY] || 0,
        health: rawBaseStats[STAT_HASHES.RESILIENCE] || 0,
        class: rawBaseStats[STAT_HASHES.RECOVERY] || 0,
        grenade: rawBaseStats[STAT_HASHES.DISCIPLINE] || 0,
        super: rawBaseStats[STAT_HASHES.INTELLECT] || 0,
        melee: rawBaseStats[STAT_HASHES.STRENGTH] || 0,
    };
    
    // Get exotic perk name if applicable
    let exoticPerk: string | undefined;
    if (isExotic && socketsData?.sockets && plugDefs) {
        const intrinsicSocket = socketsData.sockets[0];
        if (intrinsicSocket?.plugHash && plugDefs[intrinsicSocket.plugHash]) {
            exoticPerk = plugDefs[intrinsicSocket.plugHash].displayProperties?.name;
        }
    }
    
    return {
        itemHash: item.itemHash,
        itemInstanceId: item.itemInstanceId,
        bucketHash,
        name: itemDef.displayProperties?.name || 'Unknown',
        icon: itemDef.displayProperties?.icon || '',
        classType: itemDef.classType ?? 3,
        tierType: itemDef.inventory?.tierType || 5,
        baseStats,
        totalStats: getTotalStats(baseStats),
        isMasterworked,
        isArtifice,
        isExotic,
        exoticPerk,
    };
}

/**
 * Filter armor pieces by class and slot
 */
export function filterArmorBySlot(
    armorPieces: ArmorPiece[],
    bucketHash: number,
    classType: number
): ArmorPiece[] {
    return armorPieces.filter(
        (piece) =>
            piece.bucketHash === bucketHash &&
            (piece.classType === classType || piece.classType === 3)
    );
}

/**
 * Check if stats meet constraints
 */
export function meetsConstraints(
    stats: ArmorStats,
    constraints: StatConstraints
): boolean {
    return (
        stats.weapons >= constraints.weapons.min &&
        stats.weapons <= constraints.weapons.max &&
        stats.health >= constraints.health.min &&
        stats.health <= constraints.health.max &&
        stats.class >= constraints.class.min &&
        stats.class <= constraints.class.max &&
        stats.grenade >= constraints.grenade.min &&
        stats.grenade <= constraints.grenade.max &&
        stats.super >= constraints.super.min &&
        stats.super <= constraints.super.max &&
        stats.melee >= constraints.melee.min &&
        stats.melee <= constraints.melee.max
    );
}

/**
 * Check if stats can potentially meet constraints with mods
 */
export function canMeetConstraints(
    stats: ArmorStats,
    constraints: StatConstraints,
    availableModSlots: number,
    artificeSlots: number,
    settings: OptimizerSettings
): boolean {
    const maxModBoost = availableModSlots * STAT_MODS.major.value;
    const maxArtificeBoost = settings.artificeBonus ? artificeSlots * STAT_MODS.artifice.value : 0;
    const maxBoost = maxModBoost + maxArtificeBoost;
    
    for (const stat of ALL_STAT_KEYS) {
        const current = stats[stat];
        const target = constraints[stat].min;
        
        if (current + maxBoost < target) {
            return false;
        }
    }
    
    return true;
}

/**
 * Calculate what mods are needed to reach target stats
 */
export function calculateModsNeeded(
    currentStats: ArmorStats,
    constraints: StatConstraints,
    artificeSlots: number = 0,
    useArtifice: boolean = true
): { mods: ModConfiguration[]; artificeBonus: ArmorStats } {
    const mods: ModConfiguration[] = [];
    const artificeBonus = createEmptyStats();
    
    const deficits: { stat: keyof ArmorStats; deficit: number }[] = [];
    
    for (const stat of ALL_STAT_KEYS) {
        const deficit = constraints[stat].min - currentStats[stat];
        if (deficit > 0) {
            deficits.push({ stat, deficit });
        }
    }
    
    deficits.sort((a, b) => b.deficit - a.deficit);
    
    let remainingModSlots = MAX_MOD_SLOTS;
    let remainingArtificeSlots = useArtifice ? artificeSlots : 0;
    
    for (const { stat, deficit } of deficits) {
        let remaining = deficit;
        
        while (remaining > 0 && remainingArtificeSlots > 0 && remaining <= STAT_MODS.artifice.value) {
            artificeBonus[stat] += STAT_MODS.artifice.value;
            remaining -= STAT_MODS.artifice.value;
            remainingArtificeSlots--;
        }
        
        while (remaining > STAT_MODS.minor.value && remainingModSlots > 0) {
            mods.push({ stat, value: STAT_MODS.major.value, cost: STAT_MODS.major.cost });
            remaining -= STAT_MODS.major.value;
            remainingModSlots--;
        }
        
        while (remaining > 0 && remainingModSlots > 0) {
            mods.push({ stat, value: STAT_MODS.minor.value, cost: STAT_MODS.minor.cost });
            remaining -= STAT_MODS.minor.value;
            remainingModSlots--;
        }
        
        while (remaining > 0 && remainingArtificeSlots > 0) {
            artificeBonus[stat] += STAT_MODS.artifice.value;
            remaining -= STAT_MODS.artifice.value;
            remainingArtificeSlots--;
        }
    }
    
    return { mods, artificeBonus };
}

/**
 * Score an armor set based on priority stats and optimization goals
 */
export function scoreArmorSet(
    set: ArmorSet,
    priorityStats: (keyof ArmorStats)[],
    constraints: StatConstraints,
    settings: OptimizerSettings
): number {
    let score = 0;
    
    score += set.tiers * 1000;
    
    priorityStats.forEach((stat, index) => {
        const tier = getStatTier(set.totalStats[stat]);
        const weight = (priorityStats.length - index) * 50;
        score += tier * weight;
        
        if (tier >= 10) {
            score += (priorityStats.length - index) * 100;
        }
        if (tier >= 20) {
            score += (priorityStats.length - index) * 200;
        }
    });
    
    if (settings.minimizeWaste) {
        score -= set.wastedStats * 15;
    }
    
    const baseStatsMeetConstraints = meetsConstraints(set.baseStats, constraints);
    if (baseStatsMeetConstraints) {
        score += 300;
    }
    
    score -= set.modsNeeded.length * 30;
    score -= set.modEnergyCost * 5;
    
    score += set.totalBaseStats;
    score += set.artificeSlots * 20;
    
    return score;
}

/**
 * Main optimizer function - finds optimal armor combinations
 * - If a specific exotic is selected, it MUST be included in the set
 * - Only 1 exotic armor piece is allowed per set (Destiny rule)
 */
export function findOptimalArmorSets(
    armorPieces: ArmorPiece[],
    classType: number,
    constraints: StatConstraints,
    settings: OptimizerSettings,
    maxResults: number = 50
): ArmorSet[] {
    const helmets = filterArmorBySlot(armorPieces, BUCKETS.HELMET, classType);
    const gauntlets = filterArmorBySlot(armorPieces, BUCKETS.GAUNTLETS, classType);
    const chests = filterArmorBySlot(armorPieces, BUCKETS.CHEST_ARMOR, classType);
    const legs = filterArmorBySlot(armorPieces, BUCKETS.LEG_ARMOR, classType);
    const classItems = filterArmorBySlot(armorPieces, BUCKETS.CLASS_ARMOR, classType);
    
    // Determine which slot has the required exotic (if any)
    const requiredExoticHash = settings.exoticFilter.itemHash;
    const requiredExoticSlot = settings.exoticFilter.slot;
    const noExotics = requiredExoticSlot === 'none';
    
    // Find the required exotic piece if one is specified
    let requiredExoticPiece: ArmorPiece | null = null;
    if (requiredExoticHash) {
        requiredExoticPiece = armorPieces.find(p => p.itemHash === requiredExoticHash) || null;
    }
    
    // Filter function: For the slot with required exotic, ONLY include that exotic
    // For other slots, exclude ALL exotics (can only wear 1)
    const filterByExotic = (pieces: ArmorPiece[], slot: string): ArmorPiece[] => {
        // No exotics mode - remove all exotics
        if (noExotics) {
            return pieces.filter(p => !p.isExotic);
        }
        
        // If a specific exotic is required
        if (requiredExoticHash && requiredExoticPiece) {
            // This is the slot that MUST have the required exotic
            if (requiredExoticSlot === slot) {
                // ONLY return the required exotic for this slot
                return pieces.filter(p => p.itemHash === requiredExoticHash);
            } else {
                // Other slots: NO exotics allowed (only 1 exotic per loadout)
                return pieces.filter(p => !p.isExotic);
            }
        }
        
        // "Any exotic" mode - allow exotics but still only 1 per set (handled in loop)
        if (!settings.allowExotics) {
            return pieces.filter(p => !p.isExotic);
        }
        
        return pieces;
    };
    
    const filterByMasterwork = (pieces: ArmorPiece[]) => {
        if (settings.onlyMasterworked) {
            return pieces.filter(p => p.isMasterworked);
        }
        return pieces;
    };
    
    const results: ArmorSet[] = [];
    
    const sortByTotal = (a: ArmorPiece, b: ArmorPiece) => b.totalStats - a.totalStats;
    const topN = 30; // Increased for better coverage
    
    const filteredHelmets = filterByMasterwork(filterByExotic(helmets, 'helmet')).sort(sortByTotal).slice(0, topN);
    const filteredGauntlets = filterByMasterwork(filterByExotic(gauntlets, 'gauntlets')).sort(sortByTotal).slice(0, topN);
    const filteredChests = filterByMasterwork(filterByExotic(chests, 'chest')).sort(sortByTotal).slice(0, topN);
    const filteredLegs = filterByMasterwork(filterByExotic(legs, 'legs')).sort(sortByTotal).slice(0, topN);
    const filteredClassItems = filterByMasterwork(classItems).sort(sortByTotal).slice(0, Math.min(topN, classItems.length));
    
    // If a specific exotic is required but not found, return empty
    if (requiredExoticHash && !requiredExoticPiece) {
        console.warn('Required exotic not found in inventory');
        return [];
    }
    
    if (filteredClassItems.length === 0) {
        filteredClassItems.push({
            itemHash: 0,
            itemInstanceId: '',
            bucketHash: BUCKETS.CLASS_ARMOR,
            name: 'Any Class Item',
            icon: '',
            classType,
            tierType: 5,
            baseStats: createEmptyStats(),
            totalStats: 0,
            isMasterworked: true,
            isArtifice: false,
            isExotic: false,
        });
    }
    
    const fragmentStats = settings.subclassConfig?.totalBonus || createEmptyStats();
    
    for (const helmet of filteredHelmets) {
        for (const gauntlet of filteredGauntlets) {
            let exoticCount = (helmet.isExotic ? 1 : 0) + (gauntlet.isExotic ? 1 : 0);
            if (exoticCount > settings.maxExotics) continue;
            
            for (const chest of filteredChests) {
                exoticCount = (helmet.isExotic ? 1 : 0) + (gauntlet.isExotic ? 1 : 0) + (chest.isExotic ? 1 : 0);
                if (exoticCount > settings.maxExotics) continue;
                
                for (const leg of filteredLegs) {
                    exoticCount = (helmet.isExotic ? 1 : 0) + (gauntlet.isExotic ? 1 : 0) + 
                                  (chest.isExotic ? 1 : 0) + (leg.isExotic ? 1 : 0);
                    if (exoticCount > settings.maxExotics) continue;
                    
                    for (const classItem of filteredClassItems) {
                        const baseStats = sumStats(
                            helmet.baseStats,
                            gauntlet.baseStats,
                            chest.baseStats,
                            leg.baseStats,
                            classItem.baseStats
                        );
                        
                        const artificeSlots = [helmet, gauntlet, chest, leg, classItem]
                            .filter(p => p.isArtifice).length;
                        
                        const mwStats = createEmptyStats();
                        const pieces = [helmet, gauntlet, chest, leg];
                        pieces.forEach(piece => {
                            const bonus = (piece.isMasterworked || settings.assumeMasterwork) ? 2 : 0;
                            ALL_STAT_KEYS.forEach(stat => {
                                mwStats[stat] += bonus;
                            });
                        });
                        const ciBonus = (classItem.isMasterworked || settings.assumeClassItemMasterwork) ? 2 : 0;
                        ALL_STAT_KEYS.forEach(stat => {
                            mwStats[stat] += ciBonus;
                        });
                        
                        let totalStats = sumStats(baseStats, mwStats, fragmentStats);
                        
                        if (!canMeetConstraints(totalStats, constraints, MAX_MOD_SLOTS, artificeSlots, settings)) {
                            continue;
                        }
                        
                        const { mods: modsNeeded, artificeBonus } = calculateModsNeeded(
                            totalStats,
                            constraints,
                            artificeSlots,
                            settings.artificeBonus
                        );
                        
                        let finalStats = { ...totalStats };
                        modsNeeded.forEach(mod => {
                            finalStats[mod.stat] += mod.value;
                        });
                        finalStats = sumStats(finalStats, artificeBonus);
                        
                        if (!meetsConstraints(finalStats, constraints)) {
                            continue;
                        }
                        
                        const modEnergyCost = modsNeeded.reduce((sum, mod) => sum + mod.cost, 0);
                        
                        const armorSet: ArmorSet = {
                            helmet,
                            gauntlets: gauntlet,
                            chest,
                            legs: leg,
                            classItem,
                            baseStats,
                            totalStats: finalStats,
                            totalBaseStats: getTotalStats(baseStats),
                            tiers: getTiers(finalStats),
                            exoticCount,
                            modsNeeded,
                            modEnergyCost,
                            wastedStats: getWastedStats(finalStats),
                            artificeSlots,
                        };
                        
                        results.push(armorSet);
                    }
                }
            }
        }
    }
    
    return results
        .sort((a, b) => {
            const scoreA = scoreArmorSet(a, settings.priorityStats, constraints, settings);
            const scoreB = scoreArmorSet(b, settings.priorityStats, constraints, settings);
            return scoreB - scoreA;
        })
        .slice(0, maxResults);
}

/**
 * Quick stat breakdown for display
 */
export function getStatBreakdown(stats: ArmorStats): { stat: keyof ArmorStats; value: number; tier: number; waste: number }[] {
    return ALL_STAT_KEYS.map(stat => ({
        stat,
        value: stats[stat],
        tier: getStatTier(stats[stat]),
        waste: stats[stat] > MAX_STAT_VALUE ? stats[stat] - MAX_STAT_VALUE : stats[stat] % STAT_PER_TIER,
    }));
}

/**
 * Get exotic armor pieces grouped by slot
 */
export function getExoticsBySlot(
    armorPieces: ArmorPiece[],
    classType: number
): Record<string, ArmorPiece[]> {
    const exotics = armorPieces.filter(p => 
        p.isExotic && 
        (p.classType === classType || p.classType === 3)
    );
    
    return {
        helmet: exotics.filter(p => p.bucketHash === BUCKETS.HELMET),
        gauntlets: exotics.filter(p => p.bucketHash === BUCKETS.GAUNTLETS),
        chest: exotics.filter(p => p.bucketHash === BUCKETS.CHEST_ARMOR),
        legs: exotics.filter(p => p.bucketHash === BUCKETS.LEG_ARMOR),
    };
}

/**
 * Calculate subclass total bonus from selected fragments
 */
export function calculateSubclassBonus(fragmentNames: string[]): ArmorStats {
    const bonus = createEmptyStats();
    
    for (const name of fragmentNames) {
        const fragments = SUBCLASS_FRAGMENTS[name];
        if (fragments) {
            for (const frag of fragments) {
                bonus[frag.stat] += frag.value;
            }
        }
    }
    
    return bonus;
}
