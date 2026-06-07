import React, { useEffect, useState, useMemo, memo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { tooltipBungieImageSrc } from '@/lib/bungieImageProxy';
import {
    getWishListMatchBorderClass,
    getWishListMatchTextClass,
} from '@/lib/wishlistVisuals';
import { useObjectiveDefinitions } from '@/hooks/useObjectiveDefinitions';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useManifestTable } from '@/hooks/useManifestTable';
import { STAT_HASHES, ARMOR_STAT_HASHES, getArmorBaseStats, ArmorQuality } from '@/lib/destinyUtils';
import { STAT_NAMES_BY_HASH, StatHashes } from '@/lib/dim-stats';
import {
    formatArmorSetBonusRequirement,
    getArmorSetBonusInfo,
    isExoticArmorItem,
} from '@/lib/armorSetBonus';
import {
    getExoticArmorTraitPlugs,
    getPlugDisplayText,
    getPlugHash,
    getPlugTypeText,
} from '@/lib/armorTraits';
import { useClarityDescriptions } from '@/hooks/useClarityDescriptions';
import type { ClarityDescription } from '@/lib/clarityDescriptions';

// Map common stat hashes to readable names (Edge of Fate / Armor 3.0 names)
const STAT_NAMES: Record<number, string> = {
    ...STAT_NAMES_BY_HASH,
    [STAT_HASHES.MOBILITY!]: 'Weapons',
    [STAT_HASHES.RESILIENCE!]: 'Health',
    [STAT_HASHES.RECOVERY!]: 'Class',
    [STAT_HASHES.DISCIPLINE!]: 'Grenade',
    [STAT_HASHES.INTELLECT!]: 'Super',
    [STAT_HASHES.STRENGTH!]: 'Melee'
};

// Order in which stats should appear (Armor stats use Edge of Fate order: Health, Melee, Grenade, Super, Class, Weapons)
const STAT_ORDER = [
    StatHashes.Impact,
    StatHashes.Range,
    StatHashes.BlastRadius,
    StatHashes.Velocity,
    StatHashes.Handling,
    StatHashes.ReloadSpeed,
    StatHashes.ChargeTime,
    StatHashes.DrawTime,
    StatHashes.AimAssistance,
    StatHashes.Zoom,
    StatHashes.RecoilDirection,
    StatHashes.AirborneEffectiveness,
    STAT_HASHES.RESILIENCE!,  // Health
    STAT_HASHES.STRENGTH!,    // Melee
    STAT_HASHES.DISCIPLINE!,  // Grenade
    STAT_HASHES.INTELLECT!,   // Super
    STAT_HASHES.RECOVERY!,    // Class
    STAT_HASHES.MOBILITY!,    // Weapons
];

export interface WishListInfo {
    isWishListed: boolean;
    isTrash: boolean;
    notes?: string;
    tags?: string[];
    matchType: 'exact' | 'partial' | 'item' | 'none';
    matchedPerkHashes: number[];
}

export interface PatternUnlockProgress {
    current: number;
    total: number;
    isComplete?: boolean;
}

export interface ItemTooltipProps {
  name: string;
  itemType: string;
  rarity: string;
  icon?: string;
  power?: number;
  screenshot?: string;
  flavorText?: string;
  seasonBadge?: string;
  elementIcon?: string;
  stats?: Record<string, { value: number, maximum: number }>;
    itemHash?: number;
    perks?: any[];
    mods?: any[];
    shaders?: any[];
    ornaments?: any[];
    killEffects?: any[];
    killTrackers?: any[];
    enhancementTier?: number | null;
    tier?: string | null;
    initialPosition?: { x: number, y: number };
    objectives?: any[]; // Instance objectives
    itemDef?: any; // Full item definition
    fixedPosition?: boolean; // If true, tooltip won't follow mouse
    detailedPerks?: { // New structure for detailed perk grid
        socketIndex: number;
        activePlug: any;
        options: any[]; // Array of plug definitions
    }[]; 
    isShiny?: boolean;
    onPlugClick?: (socketIndex: number, plugHash: number) => void;
    containerRef?: React.RefObject<HTMLDivElement | null>;
    armorQuality?: ArmorQuality | null;
    socketsData?: any; // Socket data to check for archetype
    plugDefs?: Record<number, any>; // Plug definitions for archetype lookup
    wishListInfo?: WishListInfo; // Wish list match info
    patternUnlockProgress?: PatternUnlockProgress;
    isLocked?: boolean;
    showWishListSection?: boolean; // Only show wish list section when true (context menu)
    showFullSetBonusDescriptions?: boolean;
    /** Render body only (no portal) — use inside a parent shell, e.g. context menu + tooltip row. */
    docked?: boolean;
}

import { ScrollingText } from "@/components/ScrollingText";

type TooltipPosition = { x: number; y: number };

const TOOLTIP_WIDTH_PX = 350;
const TOOLTIP_OFFSET_PX = 15;
const TOOLTIP_VIEWPORT_PADDING_PX = 8;
const TOOLTIP_ESTIMATED_HEIGHT_PX = 640;

function computeTooltipPosition(clientX: number, clientY: number): TooltipPosition {
  let x = clientX + TOOLTIP_OFFSET_PX;
  let y = clientY + TOOLTIP_OFFSET_PX;

  if (typeof window !== "undefined") {
    const availableTooltipHeight = Math.max(
      240,
      Math.min(
        TOOLTIP_ESTIMATED_HEIGHT_PX,
        window.innerHeight - TOOLTIP_VIEWPORT_PADDING_PX * 2
      )
    );

    if (x + TOOLTIP_WIDTH_PX > window.innerWidth - TOOLTIP_VIEWPORT_PADDING_PX) {
      x = clientX - TOOLTIP_WIDTH_PX - TOOLTIP_OFFSET_PX;
    }

    x = Math.min(
      Math.max(TOOLTIP_VIEWPORT_PADDING_PX, x),
      Math.max(
        TOOLTIP_VIEWPORT_PADDING_PX,
        window.innerWidth - TOOLTIP_WIDTH_PX - TOOLTIP_VIEWPORT_PADDING_PX
      )
    );

    if (y + availableTooltipHeight > window.innerHeight - TOOLTIP_VIEWPORT_PADDING_PX) {
      y = window.innerHeight - availableTooltipHeight - TOOLTIP_VIEWPORT_PADDING_PX;
    }

    y = Math.max(TOOLTIP_VIEWPORT_PADDING_PX, y);
  }

  return { x, y };
}

function addPlugHash(hashes: Set<number>, plug: any) {
  const plugHash = getPlugHash(plug);

  if (plugHash) {
    hashes.add(plugHash);
  }
}

function collectClarityPlugHashes({
  detailedPerks,
  perks,
  mods,
  wishListInfo,
  socketsData,
  plugDefs,
}: {
  detailedPerks?: ItemTooltipProps["detailedPerks"];
  perks: any[];
  mods: any[];
  wishListInfo?: WishListInfo;
  socketsData?: any;
  plugDefs?: Record<number, any>;
}): number[] {
  const hashes = new Set<number>();

  for (const socket of detailedPerks ?? []) {
    addPlugHash(hashes, socket.activePlug);
    for (const option of socket.options ?? []) {
      addPlugHash(hashes, option);
    }
  }

  for (const perk of perks) {
    addPlugHash(hashes, perk);
  }

  for (const mod of mods) {
    addPlugHash(hashes, mod);
  }

  if (socketsData?.sockets && plugDefs) {
    for (const socket of socketsData.sockets) {
      const activePlug = socket?.plugHash ? plugDefs[socket.plugHash] : null;
      addPlugHash(hashes, activePlug);
    }
  }

  for (const matchedPerkHash of wishListInfo?.matchedPerkHashes ?? []) {
    if (Number.isSafeInteger(matchedPerkHash) && matchedPerkHash > 0) {
      hashes.add(matchedPerkHash);
    }
  }

  return Array.from(hashes);
}

function PatternUnlockProgressFooter({
  progress,
}: {
  progress: PatternUnlockProgress;
}) {
  const requiredPatterns = Math.max(1, progress.total);
  const completedPatterns = Math.min(
    requiredPatterns,
    Math.max(0, progress.current)
  );
  const progressPercent = progress.isComplete
    ? 100
    : (completedPatterns / requiredPatterns) * 100;

  return (
    <div className="overflow-hidden border border-red-400/25 bg-red-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="relative min-h-9">
        <div
          className="absolute inset-y-0 left-0 bg-red-500/80"
          style={{ width: `${progressPercent}%` }}
        />
        <div className="relative z-10 flex min-h-9 items-center gap-3 pr-3 text-sm font-bold text-red-50">
          <Image
            src="/deepsight.png"
            width={36}
            height={36}
            alt=""
            className="h-9 w-9 shrink-0 object-cover"
          />
          <span className="min-w-0 flex-1 truncate">Pattern unlock progress</span>
          <span className="shrink-0 text-red-100">
            {completedPatterns}/{requiredPatterns}
          </span>
        </div>
      </div>
    </div>
  );
}

function ClarityTooltipSection({
  clarityDescription,
}: {
  clarityDescription?: ClarityDescription;
}) {
  if (!clarityDescription) return null;

  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-cyan-200">
        Clarity
      </p>
      <div className="mt-1 space-y-1.5 text-[10px] leading-relaxed text-slate-200">
        {clarityDescription.lines.map((line, index) =>
          line ? (
            <p key={`${clarityDescription.hash}-${index}`} className="break-words">
              {line}
            </p>
          ) : (
            <div
              key={`${clarityDescription.hash}-${index}`}
              className="h-1"
              aria-hidden="true"
            />
          )
        )}
      </div>
    </div>
  );
}

const ItemTooltipBody = memo(function ItemTooltipBody({ 
    name, 
    itemType, 
    rarity, 
    icon, 
    power, 
    screenshot, 
    flavorText, 
    seasonBadge, 
    elementIcon,
    stats,
    perks = [],
    mods = [],
    shaders = [],
    ornaments = [],
    killEffects = [],
    killTrackers = [],
    enhancementTier,
    tier,
    initialPosition,
    objectives,
    itemDef,
    itemHash: itemTooltipItemHash,
    fixedPosition = false,
    detailedPerks,
    isShiny,
    onPlugClick,
    containerRef,
    armorQuality,
    socketsData,
    plugDefs,
    wishListInfo,
    patternUnlockProgress,
    isLocked,
    showWishListSection = false,
    showFullSetBonusDescriptions = false,
    docked = false,
}: ItemTooltipProps) {
  const [screenshotFailed, setScreenshotFailed] = useState(false);
  const [emblemBannerFailed, setEmblemBannerFailed] = useState(false);

  useEffect(() => {
    setScreenshotFailed(false);
  }, [screenshot]);

  useEffect(() => {
    setEmblemBannerFailed(false);
  }, [itemDef?.secondaryIcon]);

  // Calculate Hashes for Data Fetching
  const objectiveHashes = useMemo(() => objectives?.map((o: any) => o.objectiveHash) || [], [objectives]);
  const stepHashes = useMemo(() => {
    const hashes: number[] = [];
    
    // Add set items
    if (itemDef?.setData?.itemList) {
      itemDef.setData.itemList.forEach((i: any) => {
        if (i.itemHash) hashes.push(i.itemHash);
      });
    }

    return hashes;
  }, [itemDef]);
  
  // Fetch Definitions
  const { definitions: objectiveDefs } = useObjectiveDefinitions(objectiveHashes);
  const { definitions: stepDefs } = useItemDefinitions(stepHashes);
  const { table: equipableItemSetDefinitions } =
    useManifestTable<any>("DestinyEquipableItemSetDefinition");
  const { table: sandboxPerkDefinitions } =
    useManifestTable<any>("DestinySandboxPerkDefinition");
  const clarityPlugHashes = useMemo(
    () =>
      collectClarityPlugHashes({
        detailedPerks,
        perks,
        mods,
        wishListInfo,
        socketsData,
        plugDefs,
      }),
    [detailedPerks, perks, mods, wishListInfo, socketsData, plugDefs]
  );
  const { descriptions: clarityDescriptions } =
    useClarityDescriptions(clarityPlugHashes);
  const exoticArmorTraits = useMemo(
    () =>
      getExoticArmorTraitPlugs({
        itemDefinition: itemDef,
        itemType,
        detailedPerks,
        socketsData,
        plugDefinitions: plugDefs,
      }),
    [itemDef, itemType, detailedPerks, socketsData, plugDefs]
  );
  const exoticWeaponTraits = useMemo(() => {
    if (itemDef?.itemType !== 3 || itemDef?.inventory?.tierTypeName !== "Exotic") {
      return [];
    }

    const traitPlugs: any[] = [];
    const seenHashes = new Set<number>();

    for (const socket of detailedPerks ?? []) {
      const traitPlug = socket.activePlug;
      const traitHash = getPlugHash(traitPlug);
      const traitType = getPlugTypeText(traitPlug).toLowerCase();
      const traitCategory = traitPlug?.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
      const isIntrinsicTrait =
        socket.socketIndex === 0 ||
        traitType.includes("intrinsic") ||
        traitCategory.includes("intrinsic");

      if (!traitPlug || !traitHash || !isIntrinsicTrait || seenHashes.has(traitHash)) {
        continue;
      }

      seenHashes.add(traitHash);
      traitPlugs.push(traitPlug);
    }

    return traitPlugs;
  }, [itemDef, detailedPerks]);
  const exoticTraitPlugs =
    exoticArmorTraits.length > 0 ? exoticArmorTraits : exoticWeaponTraits;
  const hasExoticTraitPlugs = exoticTraitPlugs.length > 0;
  const exoticTraitPlugHashes = useMemo(() => {
    const traitHashes = new Set<number>();

    for (const traitPlug of exoticTraitPlugs) {
      const traitHash = getPlugHash(traitPlug);
      if (traitHash) {
        traitHashes.add(traitHash);
      }
    }

    return traitHashes;
  }, [exoticTraitPlugs]);
  
  const armorSetBonus = useMemo(() => {
    if (isExoticArmorItem(itemDef, itemType)) return null;

    return getArmorSetBonusInfo({
      itemDefinition: itemDef,
      itemType,
      equipableItemSetDefinitions,
      sandboxPerkDefinitions,
      socketsData,
      plugDefinitions: plugDefs,
      detailedPerks,
    });
  }, [
    equipableItemSetDefinitions,
    itemDef,
    itemType,
    detailedPerks,
    sandboxPerkDefinitions,
    socketsData,
    plugDefs,
  ]);

  const rarityColors = {
      'Exotic': { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500' },
      'Legendary': { text: 'text-purple-400', bg: 'bg-purple-600', border: 'border-purple-500' },
      'Rare': { text: 'text-blue-400', bg: 'bg-blue-600', border: 'border-blue-500' },
      'Common': { text: 'text-green-500', bg: 'bg-green-600', border: 'border-green-500' },
      'Basic': { text: 'text-white', bg: 'bg-slate-600', border: 'border-white/20' }
  }[rarity] || { text: 'text-white', bg: 'bg-slate-600', border: 'border-white/20' };

  // ARMOR_STAT_HASHES imported from destinyUtils

  // Calculate Base Stats for Armor
  const baseStats = useMemo(() => {
      // Only relevant for armor
      // Improved detection for Armor items (handles "Titan Helmet", "Leg Armor" etc.)
      const isArmorItem = 
        itemDef?.itemType === 2 || 
        itemType === "Armor" || 
        itemType.includes("Armor") ||
        itemType.includes("Helmet") ||
        itemType.includes("Gauntlets") ||
        itemType.includes("Chest") ||
        itemType.includes("Leg") ||
        itemType.includes("Class") ||
        itemType.includes("Cloak") ||
        itemType.includes("Mark") ||
        itemType.includes("Bond") ||
        itemType.includes("Robes") ||
        itemType.includes("Boots");

      if (!isArmorItem || !stats) return null;
      
      // Determine active plugs
      let activePlugs: any[] = [...mods];
      if (detailedPerks && detailedPerks.length > 0) {
          activePlugs = [...activePlugs, ...detailedPerks.map(p => p.activePlug).filter(Boolean)];
      }
      
      const isMasterworked = enhancementTier === 10;
      
      return getArmorBaseStats(stats, activePlugs, isMasterworked);
  }, [stats, detailedPerks, mods, enhancementTier, itemType, itemDef]);

  const baseTotal = baseStats ? Object.values(baseStats).reduce((acc, val) => acc + val, 0) : 0;

  const visibleStats = stats ? Object.entries(stats)
      .map(([hash, stat]) => {
          const statHash = Number(hash);
          // Hardcode armor stat hashes for check to ensure consistency
          const ARMOR_HASHES = [2996146975, 392767087, 1943323491, 1735777505, 144602215, 4244567218];
          const isArmorStat = ARMOR_HASHES.includes(statHash);
          
          // Handle different stat structures
          const statValue = typeof stat === 'object' && stat !== null ? (stat.value ?? 0) : (typeof stat === 'number' ? stat : 0);
          const statMax = typeof stat === 'object' && stat !== null ? (stat.maximum || (isArmorStat ? 42 : 100)) : (isArmorStat ? 42 : 100);
          
          // Use a visual max of 42 for armor stats to make bars readable (base max is ~30, +12 MW)
          // Weapons use 100.
          const max = statMax;
          
          return {
              hash: statHash,
              name: STAT_NAMES[statHash] || "Unknown Stat",
              value: statValue,
              max,
              isArmorStat
          };
      })
      .filter(s => {
          // For armor, show all armor stats. For weapons, filter by STAT_ORDER
          if (itemDef?.itemType === 2) {
              return s.isArmorStat || STAT_ORDER.includes(s.hash);
          }
          return STAT_ORDER.includes(s.hash);
      })
      .sort((a, b) => {
          // For armor, sort armor stats first, then others
          if (itemDef?.itemType === 2) {
              if (a.isArmorStat && !b.isArmorStat) return -1;
              if (!a.isArmorStat && b.isArmorStat) return 1;
              if (a.isArmorStat && b.isArmorStat) {
                  // Sort armor stats in Edge of Fate order: Health, Melee, Grenade, Super, Class, Weapons
                  const armorOrder = [STAT_HASHES.RESILIENCE, STAT_HASHES.STRENGTH, STAT_HASHES.DISCIPLINE, STAT_HASHES.INTELLECT, STAT_HASHES.RECOVERY, STAT_HASHES.MOBILITY];
                  return armorOrder.indexOf(a.hash) - armorOrder.indexOf(b.hash);
              }
          }
          return STAT_ORDER.indexOf(a.hash) - STAT_ORDER.indexOf(b.hash);
      })
      : [];

  // Debug check for missing stats
  const rawStatsCount = stats ? Object.keys(stats).length : 0;
  const debugMissingStats = visibleStats.length === 0 && rawStatsCount > 0 && (itemType?.includes("Armor") || itemType?.includes("Helmet"));
  

  // Calculate armor stats for display (use visibleStats or fallback to raw stats for armor)
  const displayStats = useMemo(() => {
    if (visibleStats.length > 0) {
      return visibleStats;
    }
    
    // For armor, process raw stats if visibleStats is empty
    if (stats && itemDef?.itemType === 2) {
      const processed = Object.entries(stats).map(([hash, stat]: [string, any]) => {
        const statHash = Number(hash);
        const ARMOR_HASHES = [2996146975, 392767087, 1943323491, 1735777505, 144602215, 4244567218];
        const isArmorStat = ARMOR_HASHES.includes(statHash);
        
        // Handle different stat structures - stats can be {value, maximum} or just a number
        const statValue = typeof stat === 'object' && stat !== null ? (stat.value ?? 0) : (typeof stat === 'number' ? stat : 0);
        const statMax = typeof stat === 'object' && stat !== null ? (stat.maximum || 42) : 42;
        
        // Include all armor stats, even if value is 0
        if (isArmorStat) {
          return {
            hash: statHash,
            name: STAT_NAMES[statHash] || "Unknown Stat",
            value: statValue,
            max: statMax,
            isArmorStat: true
          };
        }
        return null;
      }).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => {
        // Edge of Fate order: Health, Melee, Grenade, Super, Class, Weapons
        const armorOrder = [STAT_HASHES.RESILIENCE, STAT_HASHES.STRENGTH, STAT_HASHES.DISCIPLINE, STAT_HASHES.INTELLECT, STAT_HASHES.RECOVERY, STAT_HASHES.MOBILITY];
        return armorOrder.indexOf(a.hash) - armorOrder.indexOf(b.hash);
      });
      
      return processed;
    }
    
    return [];
  }, [visibleStats, stats, itemDef]);
  
  const isArmor = displayStats.some(s => s.isArmorStat) || itemDef?.itemType === 2;
  const armorTotal = isArmor ? displayStats.reduce((acc, s) => s.isArmorStat ? acc + s.value : acc, 0) : 0;
  const armorTierSum = isArmor ? displayStats.reduce((acc, s) => s.isArmorStat ? acc + Math.floor(s.value / 10) : acc, 0) : 0;
  const shouldClampSetBonusDescriptions = !docked && !showFullSetBonusDescriptions;
  const detailedPerksForGrid = useMemo(() => {
    if (!detailedPerks || detailedPerks.length === 0 || exoticArmorTraits.length > 0) {
      return undefined;
    }

    if (exoticTraitPlugHashes.size === 0) {
      return detailedPerks;
    }

    const filteredPerks = detailedPerks
      .map((socket) => {
        const activePlugHash = getPlugHash(socket.activePlug);
        const activePlug =
          activePlugHash && exoticTraitPlugHashes.has(activePlugHash)
            ? null
            : socket.activePlug;
        const options = (socket.options ?? []).filter((option: any) => {
          const optionHash = getPlugHash(option);
          return !optionHash || !exoticTraitPlugHashes.has(optionHash);
        });

        if (!activePlug && options.length === 0) {
          return null;
        }

        return {
          ...socket,
          activePlug,
          options,
        };
      })
      .filter((socket): socket is NonNullable<typeof socket> => socket !== null);

    return filteredPerks.length > 0 ? filteredPerks : undefined;
  }, [detailedPerks, exoticArmorTraits.length, exoticTraitPlugHashes]);
  const shouldShowDetailedPerks =
    Boolean(detailedPerksForGrid && detailedPerksForGrid.length > 0);
  const shouldShowPlugSection = shouldShowDetailedPerks || mods.length > 0 || isLocked;
  const showTooltipScreenshots = false;

  return (
    <>
        {/* Header */}
        <div className={cn("relative h-14 flex items-center px-4 gap-3 overflow-hidden", rarityColors.bg)}>
            {/* Header Pattern Overlay (CSS Pattern) */}
            <div 
                className="absolute inset-0 opacity-20 mix-blend-overlay" 
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3Ccircle cx='13' cy='13' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundSize: '20px 20px'
                }}
            />

            {/* Moving Perlin Noise (Holofoil Effect) - Only for Shiny Items */}
            {isShiny && (
                <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none bg-noise-animated z-0" />
            )}
            
            <div className="relative z-10 flex-1 min-w-0 overflow-hidden">
                <ScrollingText
                    pauseOnHover={false}
                    duration={14}
                    className="font-bold text-white uppercase tracking-widest text-xl drop-shadow-md"
                >
                    {name}
                </ScrollingText>
                <ScrollingText
                    pauseOnHover={false}
                    duration={20}
                    className="text-[10px] font-bold uppercase tracking-wider text-white/90"
                >
                    {rarity} / {itemType}
                </ScrollingText>
            </div>

            {/* Top Right Element/Badge */}
            <div className="relative z-10 flex items-center gap-2">
                {/* Tier Box (Stars) */}
                {tier && (
                    <div className={cn(
                        "flex flex-col items-center justify-center px-1.5 py-0.5"
                    )}>
                         <span className={cn(
                             "text-[8px] uppercase font-bold leading-none tracking-widest",
                             tier === "Tier 5" ? "text-destiny-gold" : "text-slate-400"
                         )}>Tier</span>
                         <div className="flex items-center -space-x-0.5 mt-0.5">
                             {Array.from({ length: parseInt(tier.replace("Tier ", "")) || 0 }).map((_, i) => (
                                 <span key={i} className={cn(
                                     "text-sm font-bold leading-none",
                                     tier === "Tier 5" ? "text-destiny-gold" : "text-white"
                                 )}>
                                     ✦
                                 </span>
                             ))}
                         </div>
                    </div>
                )}

                {enhancementTier !== undefined && enhancementTier !== null && !tier && (
                    <div className="flex flex-col items-center justify-center bg-gray-800/20 px-1.5 py-0.5 rounded-sm">
                        <span className="text-[8px] text-destiny-gold uppercase font-bold leading-none tracking-widest">Tier</span>
                        <span className="text-sm font-bold text-destiny-gold leading-none">{enhancementTier}</span>
                    </div>
                )}
                {elementIcon && (
                    <Image 
                        src={tooltipBungieImageSrc(elementIcon, 32)} 
                        width={32} 
                        height={32} 
                        className="object-contain drop-shadow-md" 
                        alt="Element" 
                    />
                )}
                {seasonBadge && (
                    <div className="relative w-20 h-20 flex items-center justify-center -mr-18 mt-4">
                        <Image 
                            src={tooltipBungieImageSrc(seasonBadge, 80)} 
                            fill 
                            sizes="80px"
                            className="object-contain drop-shadow-md pt-1" 
                            alt="Season Badge"
                        />
                    </div>
                )}
            </div>
        </div>

        {/* Body */}
        <div
          className={cn(
            "bg-gray-800/20 border-b border-white/10 p-1 overflow-visible",
            docked ? "border-r" : "border-x",
          )}
        >
            {/* Screenshot Section — Bungie often 404s old screenshot paths; fall back to item icon. */}
            {showTooltipScreenshots && screenshot && !screenshotFailed ? (
                <div className="relative w-full h-48 overflow-hidden mb-1 group">
                    <Image 
                        src={tooltipBungieImageSrc(screenshot, 350)} 
                        alt="" 
                        fill
                        sizes="(max-width: 768px) 100vw, 350px"
                        className="object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                        onError={() => setScreenshotFailed(true)}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                    
                    {/* Power Overlay on Image */}
                    {power && (
                        <div className="absolute bottom-2 left-3 flex items-end">
                            <span className="text-5xl font-bold text-destiny-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{power}</span>
                            <span className="text-2xl text-destiny-gold mb-1 ml-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">✧</span>
                        </div>
                    )}
                </div>
            ) : showTooltipScreenshots && screenshot && screenshotFailed && icon ? (
                <div className="relative mb-1 flex h-48 w-full items-center justify-center overflow-hidden bg-slate-950/90 group">
                    <Image
                        src={tooltipBungieImageSrc(icon, 256)}
                        alt=""
                        width={256}
                        height={256}
                        className="object-contain opacity-95 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                    {power && (
                        <div className="absolute bottom-2 left-3 flex items-end">
                            <span className="text-5xl font-bold text-destiny-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{power}</span>
                            <span className="text-2xl text-destiny-gold mb-1 ml-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">✧</span>
                        </div>
                    )}
                </div>
            ) : itemType === "Emblem" && itemDef?.secondaryIcon && !emblemBannerFailed ? (
                // Special case for Emblems: Show full emblem (secondaryIcon is usually the wide banner)
                <div className="relative w-full aspect-474/96 overflow-hidden mb-1">
                     <Image 
                        src={tooltipBungieImageSrc(itemDef.secondaryIcon, 350)} 
                        alt="" 
                        fill
                        sizes="(max-width: 768px) 100vw, 350px"
                        className="object-cover" 
                        onError={() => setEmblemBannerFailed(true)}
                     />
                </div>
            ) : null}

            <div className="p-3 space-y-4">
                {/* Description */}
                {itemDef?.displayProperties?.description && (
                     <div className="text-sm text-slate-300 leading-relaxed">
                         {itemDef.displayProperties.description}
                     </div>
                )}
                
                {/* Objectives Progress */}
                {objectives && objectives.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
                         <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Progress</h4>
                         {objectives.map((obj: any) => {
                             const def = objectiveDefs[obj.objectiveHash];
                             const progress = obj.progress || 0;
                             const total = obj.completionValue || def?.completionValue || 100;
                             const percent = Math.min(100, (progress / total) * 100);
                             const isComplete = obj.complete;
                             const description = def?.progressDescription || def?.displayProperties?.name || "Objective";
                             
                             return (
                                 <div key={obj.objectiveHash} className="space-y-1">
                                     <div className="flex justify-between text-xs text-slate-300">
                                         <span>{description}</span>
                                         <span>{progress} / {total}</span>
                                     </div>
                                     <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                         <div 
                                             className={cn(
                                                 "h-full transition-all duration-500",
                                                 isComplete ? "bg-destiny-gold" : "bg-blue-500"
                                             )}
                                             style={{ width: `${percent}%` }}
                                         />
                                     </div>
                                 </div>
                             );
                         })}
                    </div>
                )}

                {/* Quest Steps (setData) */}
                {stepHashes.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
                         <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Quest Steps</h4>
                         <div className="flex flex-col gap-1">
                            {stepHashes.map((hash: number, i: number) => {
                                const stepDef = stepDefs[hash];
                                // itemHash is passed as prop
                                const isCurrent = hash === itemTooltipItemHash;
                                
                                // Use description if name is generic or missing, or combine them
                                const stepName = stepDef?.displayProperties?.name;
                                const stepDesc = stepDef?.displayProperties?.description;
                                
                                // Logic: If current step, show full description if available. If not current, show summary.
                                // Actually user asked for descriptors like "Complete the Lost Sector...". That's usually in description.
                                // Truncate for cleanliness.
                                
                                let displayText = stepName || `Step ${i + 1}`;
                                if (stepDesc) {
                                    displayText = stepDesc;
                                }

                                return (
                                    <div key={hash} className={cn(
                                        "flex items-start gap-2 text-xs p-1 rounded",
                                        isCurrent ? "bg-white/10 text-destiny-gold" : "text-slate-500"
                                    )}>
                                        <div className={cn(
                                            "w-4 h-4 shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold border mt-0.5",
                                            isCurrent ? "border-destiny-gold text-destiny-gold" : "border-slate-600 text-slate-600"
                                        )}>
                                            {i + 1}
                                        </div>
                                        <span className="truncate line-clamp-2 leading-tight" title={displayText}>
                                            {displayText}
                                        </span>
                                    </div>
                                );
                            })}
                         </div>
                    </div>
                )}

                {/* Details Grid */}
                {power !== undefined && power !== 0 && (
                    <div className="flex items-center justify-between pb-2">
                        <span className="text-slate-400 uppercase text-xs font-bold tracking-widest">Power Level</span>
                        <div className="flex items-center">
                            <span className="text-3xl font-bold text-destiny-gold">{power}</span>
                            <span className="text-lg text-destiny-gold ml-1">✧</span>
                        </div>
                    </div>
                )}

                {/* Exotic Trait Section */}
                {hasExoticTraitPlugs && (
                    <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
                        <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                            {exoticTraitPlugs.length === 1 ? "Exotic Trait" : "Exotic Traits"}
                        </h4>
                        <div className="space-y-2">
                            {exoticTraitPlugs.map((traitPlug, traitIndex) => {
                                const traitHash = getPlugHash(traitPlug);
                                const clarityDescription = traitHash
                                    ? clarityDescriptions[traitHash]
                                    : undefined;
                                const traitName = getPlugDisplayText(traitPlug, "name");
                                const traitDescription = getPlugDisplayText(
                                    traitPlug,
                                    "description"
                                );
                                const traitType = getPlugTypeText(traitPlug);

                                return (
                                    <div
                                        key={traitHash ?? `${traitName}-${traitIndex}`}
                                        className="group/exotictrait relative flex items-start gap-2 border border-white/10 bg-black/20 p-2"
                                    >
                                        {traitPlug.displayProperties?.icon && (
                                            <div className="w-8 h-8 shrink-0 rounded-sm overflow-hidden border border-white/20 bg-slate-800/50">
                                                <Image
                                                    src={tooltipBungieImageSrc(
                                                        traitPlug.displayProperties.icon,
                                                        32
                                                    )}
                                                    width={32}
                                                    height={32}
                                                    className="object-cover"
                                                    alt=""
                                                />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-destiny-gold leading-tight">
                                                {traitName}
                                            </p>
                                            {traitType && (
                                                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                                                    {traitType}
                                                </p>
                                            )}
                                            {traitDescription && (
                                                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                                                    {traitDescription}
                                                </p>
                                            )}
                                        </div>
                                        {clarityDescription && (
                                            <div className="absolute left-1/2 bottom-full z-[1000] mb-2 w-80 max-w-[min(20rem,calc(100vw-1rem))] -translate-x-1/2 rounded border border-white/20 bg-[#0f0f0f] p-3 shadow-2xl backdrop-blur-md pointer-events-none opacity-0 transition-opacity group-hover/exotictrait:opacity-100">
                                                <p className="break-words text-sm font-bold leading-tight text-destiny-gold">
                                                    {traitName}
                                                </p>
                                                {traitType && (
                                                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                                                        {traitType}
                                                    </p>
                                                )}
                                                <ClarityTooltipSection
                                                    clarityDescription={clarityDescription}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Armor Set Bonus Section */}
                {armorSetBonus && (
                    <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
                        <div className="flex items-start gap-2">
                            {armorSetBonus.icon && (
                                <div className="w-8 h-8 shrink-0 rounded-sm overflow-hidden border border-white/20 bg-slate-800/50">
                                    <Image 
                                        src={tooltipBungieImageSrc(armorSetBonus.icon, 32)} 
                                        width={32}
                                        height={32}
                                        className="object-cover"
                                        alt=""
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-destiny-gold leading-tight">{armorSetBonus.name}</p>
                                <div className="mt-2 space-y-2">
                                    {armorSetBonus.bonuses.map((setBonusTier) => (
                                        <div
                                            key={`${setBonusTier.requiredSetCount ?? "bonus"}-${setBonusTier.sandboxPerkHash ?? setBonusTier.name}`}
                                            className="border border-white/10 bg-black/20 p-2"
                                        >
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-destiny-gold">
                                                {formatArmorSetBonusRequirement(setBonusTier.requiredSetCount)}
                                                {setBonusTier.name && (
                                                    <span className="ml-1 normal-case tracking-normal text-slate-100">
                                                        - {setBonusTier.name}
                                                    </span>
                                                )}
                                            </p>
                                            {setBonusTier.description && (
                                                <p
                                                    className={cn(
                                                        "mt-1 text-xs leading-relaxed text-slate-300",
                                                        shouldClampSetBonusDescriptions && "line-clamp-2"
                                                    )}
                                                    title={
                                                        shouldClampSetBonusDescriptions
                                                            ? setBonusTier.description
                                                            : undefined
                                                    }
                                                >
                                                    {setBonusTier.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Wishlist Status Section - Always shown when item is wishlisted */}
                {wishListInfo && wishListInfo.isWishListed && !wishListInfo.isTrash && (
                    <div className={cn(
                        "pt-2 border-t mt-2",
                        getWishListMatchBorderClass(wishListInfo.matchType)
                    )}>
                        {/* Wishlist Status Header */}
                        <div className="flex items-center gap-2 mb-1.5">
                            <span
                                className={cn(
                                    "text-sm drop-shadow-sm",
                                    getWishListMatchTextClass(wishListInfo.matchType)
                                )}
                            >
                                {"\u2605"}
                            </span>
                            <span className={cn(
                                "text-xs font-bold uppercase tracking-wider",
                                getWishListMatchTextClass(wishListInfo.matchType)
                            )}>
                                {wishListInfo.matchType === 'exact' ? 'God Roll' : 
                                 wishListInfo.matchType === 'partial' ? 'Wish List' : 'Keep'}
                            </span>
                            {wishListInfo.tags && wishListInfo.tags.length > 0 && (
                                <div className="flex gap-1">
                                    {wishListInfo.tags.slice(0, 2).map((tag, i) => (
                                        <span 
                                            key={i}
                                            className={cn(
                                                "px-1.5 py-0.5 text-[9px] uppercase font-medium rounded",
                                                tag.toLowerCase().includes('pvp') ? "bg-red-500/20 text-red-300" :
                                                tag.toLowerCase().includes('pve') ? "bg-blue-500/20 text-blue-300" :
                                                "bg-slate-700 text-slate-300"
                                            )}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {wishListInfo.notes && (
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-2 line-clamp-2">
                                {wishListInfo.notes}
                            </p>
                        )}

                        {/* Wishlisted Perks - only if there are matched perks */}
                        {wishListInfo.matchedPerkHashes && wishListInfo.matchedPerkHashes.length > 0 && plugDefs && (
                            <>
                                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                                    Matched Perks
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {wishListInfo.matchedPerkHashes.map((perkHash) => {
                                        const perkDef = plugDefs[perkHash];
                                        if (!perkDef) return null;
                                        const clarityDescription = clarityDescriptions[perkHash];
                                        
                                        // Check if this perk is currently equipped
                                        const isEquipped = socketsData?.sockets?.some((s: any) => s.plugHash === perkHash);
                                        
                                        return (
                                            <div 
                                                key={perkHash}
                                                className="relative group/wishperk z-0 hover:z-50"
                                            >
                                                <div className={cn(
                                                    "w-7 h-7 rounded-full overflow-hidden border-2 transition-all",
                                                    isEquipped 
                                                        ? "border-destiny-gold bg-destiny-gold/20 ring-1 ring-destiny-gold/30" 
                                                        : "border-green-400/60 bg-gray-800/20 opacity-70 hover:opacity-100"
                                                )}>
                                                    {perkDef.displayProperties?.icon ? (
                                                        <Image 
                                                            src={tooltipBungieImageSrc(perkDef.displayProperties.icon, 28)} 
                                                            width={28}
                                                            height={28}
                                                            className="object-cover"
                                                            alt=""
                                                            onError={(e) => {
                                                                // Fallback if image fails to load
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-700" />
                                                    )}
                                                    {isEquipped && (
                                                        <div className="absolute -top-0.5 -right-0.5 text-[7px] text-destiny-gold drop-shadow-md">★</div>
                                                    )}
                                                </div>
                                                
                                                {/* Hover Tooltip */}
                                                <div
                                                    className={cn(
                                                        "absolute left-1/2 bottom-full z-[1000] mb-2 -translate-x-1/2 rounded border border-white/20 bg-[#0f0f0f] p-2.5 shadow-2xl backdrop-blur-md pointer-events-none opacity-0 transition-opacity group-hover/wishperk:opacity-100",
                                                        clarityDescription
                                                            ? "w-72 max-w-[min(18rem,calc(100vw-1rem))]"
                                                            : "w-44 max-w-[min(11rem,calc(100vw-1rem))]"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <p className="text-xs font-bold text-destiny-gold leading-tight">{perkDef.displayProperties?.name}</p>
                                                        <span className="text-destiny-gold text-[10px]">★</span>
                                                    </div>
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-1.5">{perkDef.itemTypeDisplayName}</p>
                                                    <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-3">{perkDef.displayProperties?.description}</p>
                                                    <ClarityTooltipSection clarityDescription={clarityDescription} />
                                                    {isEquipped && (
                                                        <p className="text-[9px] text-green-400 mt-1.5 uppercase font-medium">✓ Currently Equipped</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Trash Roll Section - Shown when item is in trash list */}
                {wishListInfo && wishListInfo.isTrash && (
                    <div className="pt-2 border-t mt-2 border-red-500/30">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-5 h-5 rounded flex items-center justify-center bg-red-500/20 text-red-400 text-sm font-bold">
                                ✕
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                                Trash Roll
                            </span>
                            {wishListInfo.tags && wishListInfo.tags.length > 0 && (
                                <div className="flex gap-1">
                                    {wishListInfo.tags.slice(0, 2).map((tag, i) => (
                                        <span 
                                            key={i}
                                            className="px-1.5 py-0.5 text-[9px] uppercase font-medium rounded bg-slate-700 text-slate-300"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {wishListInfo.notes && (
                            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                                {wishListInfo.notes}
                            </p>
                        )}
                    </div>
                )}
                


                {/* Stats Section - Always show for armor if stats exist */}
                {(displayStats.length > 0 || (itemDef?.itemType === 2 && stats && Object.keys(stats).length > 0)) && (
                    <div className="space-y-1.5 pt-2 border-t border-white/10 mt-2">
                        {/* Armor Total Header */}
                        {isArmor && (
                             <div className="flex items-center justify-between mb-2 px-0.5 pb-1 border-b border-white/5">
                                <span className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Total Stats</span>
                                <div className="flex items-center gap-3">
                                    {/* Quality Display */}
                                    {armorQuality && armorQuality.percentage > 0 && (
                                        <div className="flex items-center gap-1.5 border-r border-white/10 pr-3 mr-1">
                                            <span className={cn(
                                                "text-xs font-bold",
                                                armorQuality.percentage === 100 ? "text-destiny-gold" :
                                                armorQuality.percentage >= 95 ? "text-green-400" :
                                                armorQuality.percentage >= 90 ? "text-blue-400" : "text-slate-300"
                                            )}>
                                                {armorQuality.percentage}%
                                            </span>
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                                                Qual
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Base Total Display */}
                                    {baseTotal > 0 && baseTotal !== armorTotal && (
                                        <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                                            Base <span className="text-slate-300 font-bold text-xs">{baseTotal}</span>
                                        </span>
                                    )}
                                    <span className={cn(
                                        "text-sm font-bold",
                                        armorTotal >= 65 ? "text-destiny-gold" : (armorTotal >= 60 ? "text-white" : "text-slate-400")
                                    )}>
                                        {armorTotal} 
                                        <span className="text-[10px] text-slate-500 ml-1.5 font-normal tracking-wider opacity-70">
                                            T{armorTierSum}
                                        </span>
                                    </span>
                                </div>
                             </div>
                        )}
                        {(displayStats.length > 0 ? displayStats : []).map(stat => {
                            // Calculate split for Armor
                            let baseVal = stat.value;
                            let mwVal = 0;
                            let modVal = 0;
                            const isMasterworked = enhancementTier === 10;

                            if (stat.isArmorStat && baseStats && baseStats[stat.hash] !== undefined) {
                                baseVal = baseStats[stat.hash];
                                mwVal = isMasterworked ? 2 : 0;
                                modVal = Math.max(0, stat.value - baseVal - mwVal);
                            }

                            return (
                            <div key={stat.hash} className="flex items-center gap-3 text-xs relative group/stat">
                                <span className="text-slate-400 w-24 text-right font-medium">{stat.name}</span>
                                
                                <div className="flex-1 h-3 bg-slate-800/60 relative overflow-hidden">
                                    {/* Grid Lines */}
                                    {stat.isArmorStat ? (
                                        // Armor: Every 10
                                        [10, 20, 30, 40].map(tick => (
                                            <div 
                                                key={tick}
                                                className="absolute top-0 bottom-0 w-px bg-white/10 z-0"
                                                style={{ left: `${(tick / stat.max) * 100}%` }}
                                            />
                                        ))
                                    ) : (
                                        // Weapons: Every 25
                                        [25, 50, 75, 100].map(tick => (
                                            <div 
                                                key={tick}
                                                className="absolute top-0 bottom-0 w-px bg-white/10 z-0"
                                                style={{ left: `${tick}%` }}
                                            />
                                        ))
                                    )}

                                    {/* Base Bar */}
                                    <div 
                                        className={cn(
                                            "absolute top-0 bottom-0 left-0 transition-all z-10",
                                            stat.isArmorStat ? "bg-slate-400" : "bg-white"
                                        )}
                                        style={{ width: `${Math.min((baseVal / stat.max) * 100, 100)}%` }} 
                                    />
                                    
                                    {/* Masterwork Bar (Stacked) */}
                                    {mwVal > 0 && (
                                        <div 
                                            className="absolute top-0 bottom-0 transition-all z-10 bg-destiny-gold"
                                            style={{ 
                                                left: `${Math.min((baseVal / stat.max) * 100, 100)}%`,
                                                width: `${Math.min((mwVal / stat.max) * 100, 100)}%` 
                                            }}
                                        />
                                    )}

                                    {/* Mod Bar (Stacked) */}
                                    {modVal > 0 && (
                                        <div 
                                            className="absolute top-0 bottom-0 transition-all z-10 bg-cyan-500"
                                            style={{ 
                                                left: `${Math.min(((baseVal + mwVal) / stat.max) * 100, 100)}%`,
                                                width: `${Math.min((modVal / stat.max) * 100, 100)}%` 
                                            }}
                                        />
                                    )}
                                </div>

                                <div className="w-12 text-right relative flex items-center justify-end gap-1">
                                    <span className={cn(
                                        "font-bold",
                                        stat.value > 100 ? "text-destiny-gold" : "text-white",
                                        modVal > 0 ? "text-cyan-400" : ""
                                    )}>
                                        {stat.value}
                                    </span>
                                    {/* Tier Indicator (T1, T2...) */}
                                    {stat.isArmorStat && (
                                        <span className="text-[9px] text-slate-500 font-medium w-3 text-center">
                                            T{Math.floor(stat.value / 10)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )})}
                    </div>
                )}

                {/* Perks / Traits - Detailed Grid View & Mods */}
                {shouldShowPlugSection ? (
                    <div className="mt-2 border-t border-white/10 pt-2 space-y-2 overflow-visible">
                        {shouldShowDetailedPerks && (
                            <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Perks & Traits</h4>
                        )}
                        <div className="flex items-start gap-4 overflow-visible">
                            {/* Perks Scroll Area */}
                            {shouldShowDetailedPerks && detailedPerksForGrid && (
                                <div className="flex min-w-0 flex-1 flex-row flex-wrap gap-2 overflow-visible pb-2">
                                    {detailedPerksForGrid.map((socket, idx) => (
                                         <div key={idx} className="flex flex-col gap-2 shrink-0">
                                            {/* Intrinsic / Active Plug usually first */}
                                            {socket.options.length > 0 ? (
                                                socket.options.map((plug: any, i: number) => {
                                                   const isSelected = plug.hash === socket.activePlug?.hash;
                                                   const isEnhanced = plug.displayProperties?.name?.includes("Enhanced");
                                                   const isWishListedPerk = wishListInfo?.matchedPerkHashes?.includes(plug.hash);
                                                   const clarityDescription = clarityDescriptions[plug.hash];
                                                   const uniqueKey = `${plug.hash}-${i}`; // Ensure unique key
                                                   return (
                                                       <div 
                                                            key={uniqueKey} 
                                                            className={cn(
                                                                "relative group/perkicon z-0 hover:z-50",
                                                                onPlugClick ? "cursor-pointer" : ""
                                                            )}
                                                            onClick={() => {
                                                                if (onPlugClick) {
                                                                    onPlugClick(socket.socketIndex, plug.hash);
                                                                }
                                                            }}
                                                        >
                                                             <div className={cn(
                                                                 "w-8 h-8 rounded-full overflow-hidden relative transition-all border",
                                                                 isWishListedPerk && isSelected
                                                                    ? "border-destiny-gold ring-1 ring-destiny-gold/50" 
                                                                    : isWishListedPerk
                                                                    ? "border-green-400"
                                                                    : "border-gray-500",
                                                                 isSelected 
                                                                    ? "bg-[#5b94be] opacity-100" 
                                                                    : "bg-black-800/20 opacity-40 hover:opacity-100"
                                                             )}>
                                                                 <Image 
                                                                     src={tooltipBungieImageSrc(plug.displayProperties?.icon, 32)} 
                                                                     width={32}
                                                                     height={32}
                                                                     className="object-cover" 
                                                                     alt="" 
                                                                 />
                                                                 
                                                                 {isEnhanced && (
                                                                     <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-destiny-gold" />
                                                                 )}

                                                                 {/* Wish List Star Indicator */}
                                                                 {isWishListedPerk && (
                                                                     <div className={cn(
                                                                         "absolute -top-0.5 -right-0.5 text-[8px] drop-shadow-md",
                                                                         isSelected ? "text-destiny-gold" : "text-green-400"
                                                                     )}>
                                                                         ★
                                                                     </div>
                                                                 )}
                                                             </div>
                                                             
                                                             {/* Hover Tooltip for Icon */}
                                                             <div
                                                                 className={cn(
                                                                     "absolute left-1/2 bottom-full z-[1000] mb-2 -translate-x-1/2 overflow-visible rounded border border-white/20 bg-[#0f0f0f] p-3 shadow-2xl backdrop-blur-md pointer-events-none opacity-0 transition-opacity group-hover/perkicon:opacity-100",
                                                                     clarityDescription
                                                                         ? "w-80 max-w-[min(20rem,calc(100vw-1rem))]"
                                                                         : "w-52 max-w-[min(13rem,calc(100vw-1rem))]"
                                                                 )}
                                                             >
                                                                 <div className="flex items-center gap-1.5 mb-0.5">
                                                                     <p className="min-w-0 break-words text-sm font-bold leading-tight text-destiny-gold">{plug.displayProperties?.name}</p>
                                                                     {isWishListedPerk && (
                                                                         <span className="text-destiny-gold text-xs">★</span>
                                                                     )}
                                                                 </div>
                                                                 <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">{plug.itemTypeDisplayName}</p>
                                                                 <p className="break-words text-xs leading-relaxed text-slate-300">{plug.displayProperties?.description}</p>
                                                                 <ClarityTooltipSection clarityDescription={clarityDescription} />
                                                                 {isWishListedPerk && (
                                                                     <p className="text-[10px] text-destiny-gold mt-2 uppercase font-medium">Wish List Perk</p>
                                                                 )}
                                                             </div>
                                                        </div>
                                                    );
                                                 })
                                             ) : (
                                                 // Fallback if no options but we have active
                                                 socket.activePlug && (
                                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-500 bg-[#5b94be]">
                                                        <Image 
                                                            src={tooltipBungieImageSrc(socket.activePlug.displayProperties?.icon, 32)} 
                                                            width={32}
                                                            height={32}
                                                            className="object-cover" 
                                                            alt="" 
                                                        />
                                                    </div>
                                                 )
                                             )}
                                         </div>
                                    ))}
                                </div>
                            )}

                            {(mods.length > 0 || isLocked) && (
                                <div className="ml-auto flex shrink-0 flex-row items-center gap-1.5 border-l border-white/10 pl-3 pt-0.5">
                                    {isLocked && (
                                        <div
                                            className="flex h-8 items-center gap-1.5 rounded border border-orange-400/30 bg-orange-500/10 px-2 text-[9px] font-bold uppercase tracking-wide text-orange-300"
                                            title="Locked"
                                        >
                                            <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)]" />
                                            Locked
                                        </div>
                                    )}
                                    {mods.map((plug, i) => {
                                        const iconUrl = tooltipBungieImageSrc(plug.displayProperties?.icon, 32);
                                        const clarityDescription = clarityDescriptions[plug.hash];
                                        return (
                                            <div key={i} className="group/cosmetic relative">
                                                <div className="w-8 h-8 border border-gray-500 bg-black/40 overflow-hidden shadow-sm hover:border-white/60 transition-colors flex items-center justify-center">
                                                    {iconUrl && (
                                                        <Image 
                                                            src={iconUrl} 
                                                            width={32}
                                                            height={32}
                                                            className="object-cover"
                                                            alt="" 
                                                        />
                                                    )}
                                                </div>
                                                {/* Mod Tooltip */}
                                                <div
                                                    className={cn(
                                                        "absolute left-1/2 bottom-full z-[1000] mb-2 -translate-x-1/2 overflow-visible rounded border border-white/20 bg-[#0f0f0f] p-2 shadow-xl backdrop-blur-md pointer-events-none opacity-0 transition-opacity group-hover/cosmetic:opacity-100",
                                                        clarityDescription
                                                            ? "w-72 max-w-[min(18rem,calc(100vw-1rem))]"
                                                            : "w-48 max-w-[min(12rem,calc(100vw-1rem))]"
                                                    )}
                                                >
                                                    <p className="min-w-0 break-words text-xs font-bold text-destiny-gold">{plug.displayProperties?.name}</p>
                                                    <p className="text-[9px] text-slate-400 uppercase">{plug.itemTypeDisplayName}</p>
                                                    <ClarityTooltipSection clarityDescription={clarityDescription} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Standard Perks List (Legacy/Hover Behavior) */
                    perks.length > 0 && (
                    <div className="mt-2 border-t border-white/10 divide-y divide-white/10">
                        {perks.map((plug: any, i) => (
                            <div key={i} className="flex items-start gap-3 group/perk py-3">
                                {/* Icon */}
                                <div className="w-10 h-10 shrink-0 rounded-sm overflow-hidden group-hover/perk:border-destiny-gold transition-colors relative">
                                    <Image 
                                        src={tooltipBungieImageSrc(plug.displayProperties?.icon, 40)} 
                                        width={40}
                                        height={40}
                                        className="object-cover" 
                                        alt="" 
                                    />
                                </div>
                                
                                {/* Info */}
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-[#F5F5F5] group-hover/perk:text-destiny-gold transition-colors leading-tight">
                                        {plug.displayProperties?.name}
                                    </span>
                                    
                                    {/* Show Type for all, Description only for first item (Intrinsic) or if explicitly a frame/trait without type name collision */}
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        {plug.itemTypeDisplayName}
                                    </span>

                                    {/* Description (mainly for the Intrinsic/First item) */}
                                    {i === 0 && plug.displayProperties?.description && (
                                        <p className="text-xs text-slate-300 mt-1 leading-relaxed font-light opacity-90">
                                            {plug.displayProperties?.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {patternUnlockProgress && (
                    <PatternUnlockProgressFooter progress={patternUnlockProgress} />
                )}

            </div>
        </div>
    </>
  );
});

ItemTooltipBody.displayName = "ItemTooltipBody";

export function ItemTooltip(props: ItemTooltipProps) {
  const { fixedPosition, initialPosition, containerRef, docked } = props;

  const [position, setPosition] = useState<TooltipPosition | null>(() => {
    if (typeof window === "undefined" || docked) return null;
    if (!initialPosition) return null;
    return computeTooltipPosition(initialPosition.x, initialPosition.y);
  });

  const rafRef = useRef<number | null>(null);
  const latestMoveRef = useRef<TooltipPosition | null>(null);

  const setShellRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (containerRef && "current" in containerRef) {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }
    },
    [containerRef],
  );

  useEffect(() => {
    if (docked) return;

    if (fixedPosition) {
      if (initialPosition) {
        setPosition(
          computeTooltipPosition(initialPosition.x, initialPosition.y),
        );
      }
      return;
    }

    const flushMove = () => {
      rafRef.current = null;
      const p = latestMoveRef.current;
      if (p) setPosition(p);
    };

    const onMove = (e: MouseEvent) => {
      latestMoveRef.current = computeTooltipPosition(e.clientX, e.clientY);
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushMove);
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [docked, fixedPosition, initialPosition]);

  if (docked) {
    return (
      <div className="flex w-full min-h-0 min-w-0 flex-col overflow-visible">
        <ItemTooltipBody {...props} />
      </div>
    );
  }

  if (typeof document === "undefined" || !position) return null;

  return createPortal(
    <div
      ref={setShellRef}
      className={cn(
        "fixed z-300 w-[350px] max-h-[calc(100vh-1rem)] flex flex-col overflow-visible shadow-2xl font-sans backdrop-blur-md",
        fixedPosition ? "pointer-events-auto" : "pointer-events-none",
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <ItemTooltipBody {...props} />
    </div>,
    document.body,
  );
}
