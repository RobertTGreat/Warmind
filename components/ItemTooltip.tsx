import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getBungieImage } from '@/lib/bungie';
import { useObjectiveDefinitions } from '@/hooks/useObjectiveDefinitions';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';

// Map common stat hashes to readable names
const STAT_NAMES: Record<number, string> = {
    1480404414: 'Attack',
    3897883278: 'Defense',
    4284895488: 'Impact',
    2961396640: 'Range',
    3614673599: 'Blast Radius',
    2523465841: 'Velocity',
    943549884: 'Handling',
    4188031367: 'Reload Speed',
    1591432999: 'Accuracy',
    1345609583: 'Aim Assistance',
    2715839340: 'Recoil Direction',
    3555269338: 'Zoom',
    447667954: 'Draw Time',
    360359141: 'Swing Speed',
    2591150011: 'Charge Time',
    2094266658: 'Shield Duration',
    4043523819: 'Guard Resistance',
    1240592695: 'Guard Efficiency',
    2762071195: 'Guard Endurance',
    2837207746: 'Swing Speed',
    4244567218: 'Strength',
    2996146975: 'Mobility',
    1943323491: 'Recovery',
    392767087: 'Resilience',
    1735777505: 'Intellect',
    144602215: 'Discipline'
};

// Order in which stats should appear
const STAT_ORDER = [
    4284895488, // Impact
    2961396640, // Range
    3614673599, // Blast Radius
    2523465841, // Velocity
    943549884, // Handling
    4188031367, // Reload Speed
    2591150011, // Charge Time
    447667954, // Draw Time
    1345609583, // Aim Assistance
    3555269338, // Zoom
    2715839340, // Recoil Direction
    4244567218, // Strength
    2996146975, // Mobility
    1943323491, // Recovery
    392767087, // Resilience
    1735777505, // Intellect
    144602215, // Discipline
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
    containerRef
}: ItemTooltipProps) {
  const [position, setPosition] = useState<{x: number, y: number} | null>(initialPosition || null);

  // Calculate Hashes for Data Fetching
  const objectiveHashes = useMemo(() => objectives?.map((o: any) => o.objectiveHash) || [], [objectives]);
  const stepHashes = useMemo(() => itemDef?.setData?.itemList?.map((i: any) => i.itemHash) || [], [itemDef]);
  
  // Fetch Definitions
  const { definitions: objectiveDefs } = useObjectiveDefinitions(objectiveHashes);
  const { definitions: stepDefs } = useItemDefinitions(stepHashes);

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

  // Process stats
  const visibleStats = stats ? Object.entries(stats)
      .map(([hash, stat]) => ({
          hash: Number(hash),
          name: STAT_NAMES[Number(hash)],
          value: stat.value,
          max: stat.maximum || 100 // Default max usually 100 for display bars
      }))
      .filter(s => STAT_ORDER.includes(s.hash) && s.name) // Only show known stats
      .sort((a, b) => STAT_ORDER.indexOf(a.hash) - STAT_ORDER.indexOf(b.hash))
      : [];

  // Render via Portal
  if (typeof document === 'undefined' || !position) return null;

  return createPortal(
    <div 
        ref={containerRef}
        className={cn(
            "fixed z-100 w-[350px] flex flex-col shadow-2xl font-sans backdrop-blur-xl",
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
                {/* Tier Box (New) */}
                {tier && (
                    <div className={cn(
                        "flex flex-col items-center justify-center px-1.5 py-0.5"
                    )}>
                         <span className={cn(
                             "text-[8px] uppercase font-bold leading-none tracking-widest",
                             tier === "Tier 5" ? "text-destiny-gold" : "text-slate-400"
                         )}>Tier</span>
                         <span className={cn(
                             "text-sm font-bold leading-none flex items-center gap-1",
                             tier === "Tier 5" ? "text-destiny-gold" : "text-white"
                         )}>
                             {tier.replace("Tier ", "")} 
                             <span className="text-[10px]">✦</span>
                         </span>
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
                {!screenshot && power && (
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-slate-400 uppercase text-xs font-bold tracking-widest">Power Level</span>
                        <div className="flex items-center">
                            <span className="text-3xl font-bold text-destiny-gold">{power}</span>
                            <span className="text-lg text-destiny-gold ml-1">✧</span>
                        </div>
                    </div>
                )}

                {/* Stats Section */}
                {visibleStats.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-white/10 mt-2">
                        {visibleStats.map(stat => (
                            <div key={stat.hash} className="flex items-center gap-3 text-xs">
                                <span className="text-slate-400 w-24 text-right font-medium">{stat.name}</span>
                                <div className="flex-1 h-3 bg-white/10 relative">
                                    <div 
                                        className={cn(
                                            "h-full transition-all",
                                            // Armor stats usually don't have bars in tooltip, but let's keep it consistent or color code
                                            // Using white for generic, maybe gold for high stats?
                                            "bg-white"
                                        )}
                                        style={{ width: `${Math.min((stat.value / stat.max) * 100, 100)}%` }} 
                                    />
                                </div>
                                <span className="text-white font-bold w-8 text-right">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Perks / Traits - Detailed Grid View & Cosmetics */}
                {(detailedPerks && detailedPerks.length > 0) || (mods.length + shaders.length + ornaments.length + killEffects.length + killTrackers.length > 0) ? (
                    <div className="mt-2 border-t border-white/10 pt-2 space-y-2">
                        <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Perks & Traits</h4>
                        <div className="flex items-start gap-4">
                            {/* Perks Scroll Area */}
                            {detailedPerks && detailedPerks.length > 0 && (
                                <div className="flex-1 flex flex-row gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
                                    {detailedPerks.map((socket, idx) => (
                                         <div key={idx} className="flex flex-col gap-2 shrink-0">
                                            {/* Intrinsic / Active Plug usually first */}
                                            {socket.options.length > 0 ? (
                                                socket.options.map((plug: any, i: number) => {
                                                   const isSelected = plug.hash === socket.activePlug?.hash;
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
                                                                 "w-8 h-8 rounded-full overflow-hidden relative transition-all",
                                                                 isSelected 
                                                                    ? "opacity-100 shadow-[0_0_16px_#eebc22] bg-transparent" 
                                                                    : "border border-white/10 opacity-40 hover:opacity-100 hover:border-white/40 bg-black/20"
                                                             )}>
                                                                 <Image 
                                                                     src={getBungieImage(plug.displayProperties?.icon)} 
                                                                     width={32}
                                                                     height={32}
                                                                     className="object-cover" 
                                                                     alt="" 
                                                                 />
                                                             </div>
                                                             
                                                             {/* Hover Tooltip for Icon */}
                                                             <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 bg-[#0f0f0f] border border-white/20 p-3 rounded shadow-2xl pointer-events-none opacity-0 group-hover/perkicon:opacity-100 transition-opacity z-50 backdrop-blur-md">
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
                                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
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

                            {/* Cosmetics Grid (Right Side) */}
                            {(mods.length > 0 || shaders.length > 0 || ornaments.length > 0 || killEffects.length > 0 || killTrackers.length > 0) && (
                                <div className="grid grid-cols-2 gap-1.5 shrink-0 pt-0.5 border-l border-white/10 pl-3">
                                    {[...mods, ...shaders, ...ornaments, ...killEffects, ...killTrackers].map((plug, i) => (
                                        <div key={i} className="group/cosmetic relative">
                                            <div className="w-8 h-8 border border-white/20 bg-black/40 overflow-hidden shadow-sm hover:border-white/60 transition-colors">
                                                <Image 
                                                    src={getBungieImage(plug.displayProperties?.icon)} 
                                                    width={32}
                                                    height={32}
                                                    className="object-cover"
                                                    alt="" 
                                                />
                                            </div>
                                            {/* Cosmetic Tooltip */}
                                            <div className="absolute right-full mr-2 top-0 w-48 bg-[#0f0f0f] border border-white/20 p-2 rounded shadow-xl pointer-events-none opacity-0 group-hover/cosmetic:opacity-100 transition-opacity z-100 backdrop-blur-md">
                                                <p className="text-xs font-bold text-destiny-gold">{plug.displayProperties?.name}</p>
                                                <p className="text-[9px] text-slate-400 uppercase">{plug.itemTypeDisplayName}</p>
                                            </div>
                                        </div>
                                    ))}
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
