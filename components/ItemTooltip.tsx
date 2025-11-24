import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getBungieImage } from '@/lib/bungie';
import { useObjectiveDefinitions } from '@/hooks/useObjectiveDefinitions';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { STAT_HASHES, ARMOR_STAT_HASHES, getArmorBaseStats, ArmorQuality } from '@/lib/destinyUtils';
import { STAT_NAMES_BY_HASH, StatHashes } from '@/lib/dim-stats';
import { PlugCategoryHashes } from '@/data/d2/generated-enums';

// Map common stat hashes to readable names
const STAT_NAMES: Record<number, string> = {
    ...STAT_NAMES_BY_HASH,
    [STAT_HASHES.MOBILITY!]: 'Mobility',
    [STAT_HASHES.RESILIENCE!]: 'Resilience',
    [STAT_HASHES.RECOVERY!]: 'Recovery',
    [STAT_HASHES.DISCIPLINE!]: 'Discipline',
    [STAT_HASHES.INTELLECT!]: 'Intellect',
    [STAT_HASHES.STRENGTH!]: 'Strength'
};

// Order in which stats should appear
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
    STAT_HASHES.MOBILITY!,
    STAT_HASHES.RESILIENCE!,
    STAT_HASHES.RECOVERY!,
    STAT_HASHES.DISCIPLINE!,
    STAT_HASHES.INTELLECT!,
    STAT_HASHES.STRENGTH!
];

interface ItemTooltipProps {
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
}

import { ScrollingText } from "@/components/ScrollingText";

export function ItemTooltip({ 
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
    plugDefs
}: ItemTooltipProps) {
  const [position, setPosition] = useState<{x: number, y: number} | null>(initialPosition || null);

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
    
    // Add archetype plug if we can find it
    if (itemDef?.sockets?.socketEntries && itemDef.sockets.socketEntries.length > 0) {
      const firstSocket = itemDef.sockets.socketEntries[0];
      if (firstSocket?.socketCategoryHash === 778194869 && firstSocket.singleInitialItemHash) {
        hashes.push(firstSocket.singleInitialItemHash);
      }
    }
    
    return hashes;
  }, [itemDef]);
  
  // Fetch Definitions
  const { definitions: objectiveDefs } = useObjectiveDefinitions(objectiveHashes);
  const { definitions: stepDefs } = useItemDefinitions(stepHashes);
  
  // Extract Armor Set Information
  const armorSetInfo = useMemo(() => {
    // Check if it's armor
    const isArmorItem = 
      itemDef?.itemType === 2 || 
      itemType?.includes("Armor") ||
      itemType?.includes("Helmet") ||
      itemType?.includes("Gauntlets") ||
      itemType?.includes("Chest") ||
      itemType?.includes("Leg") ||
      itemType?.includes("Class");
    
    if (!itemDef || !isArmorItem) return null;
    
    // Check for setData - it might be in different locations
    const setData = itemDef.setData;
    if (!setData) return null;
    
    const setItems = setData.itemList || [];
    if (!setItems || setItems.length === 0) return null;
    
    const setTrackingUnlockValueHash = setData.trackingUnlockValueHash;
    const setRequirementNodeHash = setData.requirementNodeHash;
    
    return {
      items: setItems,
      setTrackingUnlockValueHash,
      setRequirementNodeHash,
      setName: setData.questLineName || setData.trackingUnlockValueHash || null
    };
  }, [itemDef, itemType]);
  
  // Extract Armor Archetype - check first socket which is usually the archetype
  const armorArchetype = useMemo(() => {
    // Check if it's armor - use multiple detection methods
    const isArmorItem = 
      itemDef?.itemType === 2 || 
      itemType?.includes("Armor") ||
      itemType?.includes("Helmet") ||
      itemType?.includes("Gauntlets") ||
      itemType?.includes("Chest") ||
      itemType?.includes("Leg") ||
      itemType?.includes("Class");
    
    
    if (!itemDef || !isArmorItem) return null;
    
    const archetypeHash = 778194869; // ArmorArchetypes plug category hash
    
    // Method 1: Check itemDef.sockets.socketEntries for archetype socket category
    // The archetype socket is usually the first socket in the definition
    if (itemDef.sockets?.socketEntries && itemDef.sockets.socketEntries.length > 0) {
      for (const socketEntry of itemDef.sockets.socketEntries) {
        if (socketEntry.socketCategoryHash === archetypeHash) {
          // Found the archetype socket! Now get the plug
          const defaultPlugHash = socketEntry.singleInitialItemHash;
          
          // Try to get from stepDefs (if we fetched it)
          if (defaultPlugHash && stepDefs[defaultPlugHash]) {
            const archetypeDef = stepDefs[defaultPlugHash];
            return {
              name: archetypeDef.displayProperties?.name || "Armor Archetype",
              description: archetypeDef.displayProperties?.description || "",
              icon: archetypeDef.displayProperties?.icon
            };
          }
          
          // If not in stepDefs, try to get from socketsData
          if (socketsData?.sockets && plugDefs) {
            const socketIndex = itemDef.sockets.socketEntries.indexOf(socketEntry);
            const liveSocket = socketsData.sockets[socketIndex];
            if (liveSocket?.plugHash && plugDefs[liveSocket.plugHash]) {
              const plug = plugDefs[liveSocket.plugHash];
              return {
                name: plug.displayProperties?.name || "Unknown Archetype",
                description: plug.displayProperties?.description || "",
                icon: plug.displayProperties?.icon
              };
            }
          }
        }
      }
    }
    
    // Method 2: Check all sockets in socketsData for archetype plugs
    if (socketsData?.sockets && socketsData.sockets.length > 0 && plugDefs) {
      for (let i = 0; i < socketsData.sockets.length; i++) {
        const socket = socketsData.sockets[i];
        if (socket?.plugHash) {
          const plug = plugDefs[socket.plugHash];
          if (plug) {
            const categoryId = plug.plug?.plugCategoryIdentifier || "";
            const categoryHash = plug.plug?.plugCategoryHash || plug.plugCategoryHash;
            
            // Check if it's an archetype plug
            if (categoryHash === archetypeHash || 
                categoryId?.includes("armor_archetypes") ||
                categoryId?.includes("ArmorArchetypes") ||
                plug.itemTypeDisplayName?.toLowerCase().includes("archetype")) {
              return {
                name: plug.displayProperties?.name || "Unknown Archetype",
                description: plug.displayProperties?.description || "",
                icon: plug.displayProperties?.icon
              };
            }
          }
        }
      }
    }
    
    // Method 3: Check if we have the archetype plug in detailedPerks
    if (detailedPerks && detailedPerks.length > 0) {
      for (const socket of detailedPerks) {
        if (socket?.activePlug) {
          const plug = socket.activePlug;
          const categoryId = plug.plug?.plugCategoryIdentifier || "";
          const categoryHash = plug.plug?.plugCategoryHash || plug.plugCategoryHash;
          
          // Check if it's an archetype plug
          if (categoryHash === archetypeHash || 
              categoryId?.includes("armor_archetypes") ||
              categoryId?.includes("ArmorArchetypes") ||
              plug.itemTypeDisplayName?.toLowerCase().includes("archetype")) {
            return {
              name: plug.displayProperties?.name || "Unknown Archetype",
              description: plug.displayProperties?.description || "",
              icon: plug.displayProperties?.icon
            };
          }
        }
      }
    }
    
    
    return null;
  }, [itemDef, detailedPerks, itemType, socketsData, plugDefs, stepDefs]);

  useEffect(() => {
    if (fixedPosition) {
        if (initialPosition) setPosition(initialPosition);
        return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Offset tooltip slightly from cursor
      // Ensure it stays within viewport
      let x = e.clientX + 15;
      let y = e.clientY + 15;
      
      // Simple boundary checks (will be handled by transform in render for Y)
      if (x + 320 > window.innerWidth) {
          x = e.clientX - 365; // Flip to left
      }
      
      setPosition({ x, y });
    };

    // If we have an initial position, apply boundary check logic to it too immediately
    if (initialPosition) {
        let x = initialPosition.x + 15;
        let y = initialPosition.y + 15;
        if (x + 320 > window.innerWidth) {
             x = initialPosition.x - 365;
        }
        setPosition({ x, y });
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [fixedPosition, initialPosition]);

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
                  // Sort armor stats in order: Mobility, Resilience, Recovery, Discipline, Intellect, Strength
                  const armorOrder = [STAT_HASHES.MOBILITY, STAT_HASHES.RESILIENCE, STAT_HASHES.RECOVERY, STAT_HASHES.DISCIPLINE, STAT_HASHES.INTELLECT, STAT_HASHES.STRENGTH];
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
        const armorOrder = [STAT_HASHES.MOBILITY, STAT_HASHES.RESILIENCE, STAT_HASHES.RECOVERY, STAT_HASHES.DISCIPLINE, STAT_HASHES.INTELLECT, STAT_HASHES.STRENGTH];
        return armorOrder.indexOf(a.hash) - armorOrder.indexOf(b.hash);
      });
      
      return processed;
    }
    
    return [];
  }, [visibleStats, stats, itemDef]);
  
  const isArmor = displayStats.some(s => s.isArmorStat) || itemDef?.itemType === 2;
  const armorTotal = isArmor ? displayStats.reduce((acc, s) => s.isArmorStat ? acc + s.value : acc, 0) : 0;
  const armorTierSum = isArmor ? displayStats.reduce((acc, s) => s.isArmorStat ? acc + Math.floor(s.value / 10) : acc, 0) : 0;

  // Render via Portal
  if (typeof document === 'undefined' || !position) return null;

    return createPortal(
    <div 
        ref={containerRef}
        className={cn(
            "fixed z-300 w-[350px] flex flex-col shadow-2xl font-sans backdrop-blur-xl",
            fixedPosition ? "pointer-events-auto" : "pointer-events-none"
        )}
        style={{ 
            left: position.x, 
            top: position.y,
            // Prevent running off screen bottom
            transform: position.y > window.innerHeight - 500 ? 'translateY(-100%)' : 'none'
        }}
    >
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
                <ScrollingText className="font-bold text-white uppercase tracking-widest text-xl drop-shadow-md">
                    {name}
                </ScrollingText>
                <p className="text-[10px] text-white/90 uppercase tracking-wider font-bold truncate">{rarity} / {itemType}</p>
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
                    <div className="flex flex-col items-center justify-center bg-black/40 px-1.5 py-0.5 rounded-sm">
                        <span className="text-[8px] text-destiny-gold uppercase font-bold leading-none tracking-widest">Tier</span>
                        <span className="text-sm font-bold text-destiny-gold leading-none">{enhancementTier}</span>
                    </div>
                )}
                {elementIcon && (
                    <Image 
                        src={elementIcon} 
                        width={32} 
                        height={32} 
                        className="object-contain drop-shadow-md" 
                        alt="Element" 
                    />
                )}
                {seasonBadge && (
                    <div className="relative w-20 h-20 flex items-center justify-center -mr-18 mt-4">
                        <Image 
                            src={seasonBadge} 
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
        <div className="bg-gray-800/20 border-x border-b border-white/10 p-1">
            {/* Screenshot Section */}
            {screenshot ? (
                <div className="relative w-full h-48 overflow-hidden mb-1 group">
                    <Image 
                        src={screenshot} 
                        alt="" 
                        fill
                        sizes="(max-width: 768px) 100vw, 350px"
                        className="object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
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
            ) : itemType === "Emblem" && itemDef?.secondaryIcon ? (
                // Special case for Emblems: Show full emblem (secondaryIcon is usually the wide banner)
                <div className="relative w-full aspect-474/96 overflow-hidden mb-1">
                     <Image 
                        src={getBungieImage(itemDef.secondaryIcon)} 
                        alt="" 
                        fill
                        sizes="(max-width: 768px) 100vw, 350px"
                        className="object-cover" 
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

                {/* Details Grid - Show Power here if no screenshot */}
                {!screenshot && power !== undefined && power !== 0 && (
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-slate-400 uppercase text-xs font-bold tracking-widest">Power Level</span>
                        <div className="flex items-center">
                            <span className="text-3xl font-bold text-destiny-gold">{power}</span>
                            <span className="text-lg text-destiny-gold ml-1">✧</span>
                        </div>
                    </div>
                )}

                {/* Armor Archetype Section */}
                {armorArchetype && (
                    <div className="space-y-2 pt-2 border-t border-white/10 mt-2">
                        <div className="flex items-start gap-2">
                            {armorArchetype.icon && (
                                <div className="w-8 h-8 shrink-0 rounded-sm overflow-hidden border border-white/20 bg-slate-800/50">
                                    <Image 
                                        src={getBungieImage(armorArchetype.icon)} 
                                        width={32}
                                        height={32}
                                        className="object-cover"
                                        alt=""
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-destiny-gold leading-tight">{armorArchetype.name}</p>
                                {armorArchetype.description && (
                                    <p className="text-xs text-slate-300 leading-relaxed mt-1">{armorArchetype.description}</p>
                                )}
                            </div>
                        </div>
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
                {(detailedPerks && detailedPerks.length > 0) || mods.length > 0 ? (
                    <div className="mt-2 border-t border-white/10 pt-2 space-y-2">
                        {detailedPerks && detailedPerks.length > 0 && (
                            <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Perks & Traits</h4>
                        )}
                        <div className="flex items-start gap-4">
                            {/* Perks Scroll Area */}
                            {detailedPerks && detailedPerks.length > 0 && (
                                <div className="flex-1 flex flex-row flex-wrap gap-2 pb-2">
                                    {detailedPerks.map((socket, idx) => (
                                         <div key={idx} className="flex flex-col gap-2 shrink-0">
                                            {/* Intrinsic / Active Plug usually first */}
                                            {socket.options.length > 0 ? (
                                                socket.options.map((plug: any, i: number) => {
                                                   const isSelected = plug.hash === socket.activePlug?.hash;
                                                   const isEnhanced = plug.displayProperties?.name?.includes("Enhanced");
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
                                                                 "border-gray-500",
                                                                 isSelected 
                                                                    ? "bg-[#5b94be] opacity-100" 
                                                                    : "bg-black/20 opacity-40 hover:opacity-100"
                                                             )}>
                                                                 <Image 
                                                                     src={getBungieImage(plug.displayProperties?.icon)} 
                                                                     width={32}
                                                                     height={32}
                                                                     className="object-cover" 
                                                                     alt="" 
                                                                 />
                                                                 
                                                                 {isEnhanced && (
                                                                     <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-destiny-gold" />
                                                                 )}
                                                             </div>
                                                             
                                                             {/* Hover Tooltip for Icon */}
                                                             <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 bg-[#0f0f0f] border border-white/20 p-3 rounded shadow-2xl pointer-events-none opacity-0 group-hover/perkicon:opacity-100 transition-opacity z-1000 backdrop-blur-md">
                                                                 <p className="text-sm font-bold text-destiny-gold mb-0.5 leading-tight">{plug.displayProperties?.name}</p>
                                                                 <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">{plug.itemTypeDisplayName}</p>
                                                                 <p className="text-xs text-slate-300 leading-relaxed">{plug.displayProperties?.description}</p>
                                                             </div>
                                                        </div>
                                                    );
                                                 })
                                             ) : (
                                                 // Fallback if no options but we have active
                                                 socket.activePlug && (
                                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-500 bg-[#5b94be]">
                                                        <Image 
                                                            src={getBungieImage(socket.activePlug.displayProperties?.icon)} 
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

                            {/* Mods Only - Horizontal display */}
                            {mods.length > 0 && (
                                <div className="flex flex-row gap-1.5 shrink-0 pt-0.5 border-l border-white/10 pl-3">
                                    {mods.map((plug, i) => {
                                        const iconUrl = getBungieImage(plug.displayProperties?.icon);
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
                                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-[#0f0f0f] border border-white/20 p-2 rounded shadow-xl pointer-events-none opacity-0 group-hover/cosmetic:opacity-100 transition-opacity z-100 backdrop-blur-md">
                                                    <p className="text-xs font-bold text-destiny-gold">{plug.displayProperties?.name}</p>
                                                    <p className="text-[9px] text-slate-400 uppercase">{plug.itemTypeDisplayName}</p>
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
                                        src={getBungieImage(plug.displayProperties?.icon)} 
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

            </div>
        </div>
    </div>,
    document.body
  );
}
