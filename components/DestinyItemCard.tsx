import useSWR from 'swr';
import Image from 'next/image';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';
import { ItemTooltip } from './ItemTooltip';
import { ItemContextMenu } from './ItemContextMenu';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useTransferStore } from '@/store/transferStore';
import { getItemTier, BUCKETS } from '@/lib/destinyUtils';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface DestinyItemCardProps {
  itemHash: number;
  instanceData?: any;
  socketsData?: any;
  className?: string;
  isHighlighted?: boolean; 
  onDefinitionLoaded?: (hash: number, def: any) => void;
    itemInstanceId?: string;
    ownerId?: string;
    quantity?: number;
    powerDiff?: number;
    classFilter?: number; // If provided, hides item if classType doesn't match (and isn't 3)
    hidePower?: boolean;
    hideTooltipPower?: boolean;
    hideBorder?: boolean;
    minimal?: boolean;
    showClassSymbolOnMismatch?: boolean;
    size?: 'small' | 'medium' | 'large';
    reusablePlugs?: any[]; // Passed from profile.itemComponents.reusablePlugs
}

// Element Icons (Updated with transparent PNGs where possible)
const ELEMENT_ICONS: Record<number, string> = {
    1847026933: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png', // Solar
    2303181850: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png', // Arc
    3454344768: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png', // Void
    151347233: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png', // Stasis
    3949783978: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png', // Strand
    3373582085: '', // Kinetic
};

const CLASS_ICONS: Record<number, string> = {
    0: '/class-titan.svg', // Titan
    1: '/class-hunter.svg', // Hunter
    2: '/class-warlock.svg', // Warlock
};

export function DestinyItemCard({ 
    itemHash, 
    instanceData, 
    socketsData, 
    className, 
    isHighlighted, 
    onDefinitionLoaded,
    itemInstanceId,
    ownerId,
    quantity,
    definition,
    objectives,
    powerDiff,
    classFilter,
    hidePower,
    hideTooltipPower,
    hideBorder,
    minimal,
    showClassSymbolOnMismatch,
    size = 'medium',
    reusablePlugs
}: DestinyItemCardProps & { definition?: any; objectives?: any[] }) {
  const { data: defResponse, error } = useSWR(
    !definition && itemHash ? endpoints.getItemDefinition(itemHash) : null,
    fetcher,
    {
        revalidateOnFocus: false,
        dedupingInterval: 600000, 
    }
  );
  
  // Watch store for this item
  const pendingOperations = useTransferStore(state => state.pendingOperations);
  const isPending = itemInstanceId ? pendingOperations.some(op => op.itemInstanceId === itemInstanceId) : false;

  const def = definition || defResponse?.Response;

  // Check if item is a subclass
  const isSubclass = def?.inventory?.bucketTypeHash === BUCKETS.SUBCLASS;

  // State hooks moved up to prevent "Rendered fewer hooks" error
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{x: number, y: number} | null>(null);
  const [initialTooltipPos, setInitialTooltipPos] = useState<{x: number, y: number} | undefined>(undefined);
    
  // Calculate plug hashes to fetch
  // Fetch ALL active plugs AND reusable plugs (options)
  const hashesToFetch = useMemo(() => {
      const allHashes: number[] = [];
      
      if (socketsData?.sockets) {
          socketsData.sockets.forEach((s: any, index: number) => {
              // Active plug
              if (s.plugHash) allHashes.push(s.plugHash);
              // Reusable plugs (options) - Check prop or socket
              const options = reusablePlugs?.[index] || s.reusablePlugs;
              if (options) {
                  options.forEach((rp: any) => allHashes.push(rp.plugItemHash));
              }
          });
      }
      
      const intrinsic = socketsData?.sockets?.[0]?.plugHash;
      if (intrinsic) allHashes.push(intrinsic);
      
      return Array.from(new Set(allHashes));
  }, [socketsData, reusablePlugs]);

  const { definitions: plugDefs } = useItemDefinitions(hashesToFetch);

  // Create a resolved list of relevant sockets for the Context Menu Tooltip
  const resolvedSockets = useMemo(() => {
      if (!socketsData?.sockets || !plugDefs) return [];
      
      return socketsData.sockets
          .map((s: any) => {
              if (!s.plugHash) return null;
              const def = plugDefs[s.plugHash];
              if (!def) return null;
              
              const typeName = def.itemTypeDisplayName?.toLowerCase() || "";
              const category = def.plug?.plugCategoryIdentifier || "";
              
              // Filter out cosmetics and empty sockets
              if (typeName.includes("shader") || typeName.includes("ornament")) return null;
              if (typeName.includes("masterwork") && !category.includes("masterwork")) return null; // Keep actual masterworks, filter weird ones if any
              
              // We want: Perks, Barrels, Mags, Mods
              // This is a broad filter to include most functional items
              return { socket: s, def };
          })
          .filter((item: { socket: any, def: any } | null): item is { socket: any, def: any } => !!item);
  }, [socketsData, plugDefs]);

  // Determine Shiny Status (Heuristic: Legendary Weapon + Double Perks in both Trait Columns)
  // Or check for specific ornament if we had a list.
  // Using Multi-Perk Logic:
  const isShiny = useMemo(() => {
      // 1. Check API property first if available (Bungie added isHolofoil in later updates for BRAVE weapons)
      if (def?.isHolofoil) return true;

      // 2. Fallback Heuristic Logic
      if (!def || def.itemType !== 3 || def.inventory?.tierTypeName !== 'Legendary') return false;
      if (!socketsData?.sockets || !plugDefs) return false;

      let multiPerkColumns = 0;
      socketsData.sockets.forEach((socket: any) => {
          if (!socket.plugHash) return;
          const plug = plugDefs[socket.plugHash];
          if (!plug) return;
          
          const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
          // Check for gameplay sockets (traits, barrels, mags)
           const isGameplaySocket = 
                typeName.includes("trait") || 
                typeName.includes("magazine") || 
                typeName.includes("barrel") ||
                typeName.includes("sight");

           const options = reusablePlugs?.[socketsData.sockets.indexOf(socket)] || socket.reusablePlugs;
           if (isGameplaySocket && options?.length > 1) {
               multiPerkColumns++;
           }
      });

      // BRAVE Shiny weapons have double perks in at least 2 columns (usually 3 and 4)
      return multiPerkColumns >= 2;
  }, [def, socketsData, plugDefs, reusablePlugs]);

  // Calculate detailed perks for tooltip
  const detailedPerks = useMemo(() => {
    if (!socketsData?.sockets || !plugDefs) return undefined;
    
    const perksList: any[] = [];
    
    socketsData.sockets.forEach((s: any, idx: number) => {
        if (!s.plugHash) return;
        const activePlug = plugDefs[s.plugHash];
        if (!activePlug) return;

        const typeName = activePlug.itemTypeDisplayName?.toLowerCase() || "";
        const category = activePlug.plug?.plugCategoryIdentifier || "";
        const name = activePlug.displayProperties?.name?.toLowerCase() || "";

        // Filter for perks/traits/barrels/mags/sights/scopes
        const isPerk = typeName.includes("trait") || 
                       typeName.includes("perk") || 
                       category.includes("trait") || 
                       category.includes("frames") ||
                       typeName.includes("barrel") ||
                       typeName.includes("magazine") ||
                       typeName.includes("sight") || 
                       typeName.includes("scope");

        // Exclude mods, shaders, ornaments, masterworks, trackers
        if (typeName.includes("mod") || 
            typeName.includes("shader") || 
            typeName.includes("ornament") || 
            typeName.includes("masterwork") ||
            typeName.includes("tracker") ||
            name.includes("kill tracker")) return;
        
        if (isPerk) {
             // Gather options
             let options: any[] = [];
             const socketOptions = reusablePlugs?.[idx] || s.reusablePlugs;
             
             if (socketOptions) {
                 options = socketOptions.map((rp: any) => plugDefs[rp.plugItemHash]).filter(Boolean);
             } else {
                 options = [activePlug];
             }
             
             // Only add if we have valid options
             if (options.length > 0) {
                perksList.push({
                    socketIndex: idx,
                    activePlug,
                    options
                });
             }
        }
    });
    
    return perksList.length > 0 ? perksList : undefined;
  }, [socketsData, plugDefs, reusablePlugs]);

  useEffect(() => {
      if (def && onDefinitionLoaded) {
          onDefinitionLoaded(itemHash, def);
      }
  }, [def, itemHash, onDefinitionLoaded]);


  // EARLY RETURNS AFTER ALL HOOKS
  
  // Filter by class if requested
  if (classFilter !== undefined && def && def.classType !== 3 && def.classType !== classFilter) {
      if (showClassSymbolOnMismatch) {
          // Render simple box with class icon
          return (
              <div className={cn(
                  "flex items-center justify-center bg-black/20 border border-white/5 opacity-40 select-none pointer-events-none",
                  className
              )}>
                  <Image 
                    src={CLASS_ICONS[def.classType] || ""} 
                    alt="Class Mismatch" 
                    width={24} 
                    height={24} 
                    className="object-contain opacity-50" 
                  />
              </div>
          );
      }
      return null;
  }

  const isLoading = !def && !error;
  const isDimmed = isHighlighted === false;

  if (isLoading) {
      return (
          <div className={cn("w-16 h-16 bg-slate-800/50 animate-pulse", className)} />
      );
  }

  if (!def) {
      return (
          <div className={cn("w-16 h-16 bg-red-900/20 border border-red-500/20 flex items-center justify-center text-xs text-red-500", className)}>
              ?
          </div>
      );
  }

  const icon = getBungieImage(def.displayProperties?.icon);
  const name = def.displayProperties?.name;
  const rarity = def.inventory?.tierTypeName; 
  const itemType = def.itemTypeDisplayName;
  const screenshot = getBungieImage(def.screenshot);
  
  // Determine Element
  const damageTypeHash = instanceData?.damageTypeHash || def.defaultDamageTypeHash;
  const elementIcon = ELEMENT_ICONS[damageTypeHash];

  // Filter Plugs and Find Masterwork Status
  const perks: any[] = [];
  const mods: any[] = [];
  const shaders: any[] = [];
  const ornaments: any[] = [];
  const killEffects: any[] = []; // Transmat / Kill Effects
  const killTrackers: any[] = []; // Kill Trackers
  let enhancementTier: number | null = null;

  if (socketsData?.sockets && plugDefs) {
      socketsData.sockets.forEach((socket: any) => {
          if (!socket.plugHash) return;
          const plug = plugDefs[socket.plugHash];
          if (!plug) return;

          const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
          const category = plug.plug?.plugCategoryIdentifier || "";
          const name = plug.displayProperties?.name?.toLowerCase() || "";
          
          // Check for Masterwork / Enhancement Tier
          // We check this, but we don't return immediately because some plugs might be multi-purpose or we might want to categorize them
          if (typeName.includes("masterwork") || category.includes("masterwork")) {
             const tierMatch = plug.displayProperties?.name?.match(/Tier (\d+)/);
             if (tierMatch) {
                 enhancementTier = parseInt(tierMatch[1], 10);
             }
             // If it's just a masterwork, we usually don't show it in the grid, 
             // but let's continue to check if it falls into other categories (unlikely but safe)
          }

          let isCosmetic = false;

          if (typeName.includes("shader")) {
              shaders.push(plug);
              isCosmetic = true;
          } 
          
          if (typeName.includes("ornament") || category.includes("skins")) {
              ornaments.push(plug);
              isCosmetic = true;
          } 
          
          if (name.includes("kill tracker") || typeName.includes("tracker")) {
              killTrackers.push(plug);
              isCosmetic = true;
          } 
          
          if (typeName.includes("transmat")) {
              killEffects.push(plug);
              isCosmetic = true;
          }
          
          if (!isCosmetic) {
              // Mods Logic - Check strictly for "mod" in type
              if (typeName.includes("mod")) {
                  mods.push(plug);
              }
              // Perks Logic - Catch-all for remaining traits/perks
              else if (typeName.includes("trait") || typeName.includes("perk") || category.includes("trait") || category.includes("frames")) {
                  perks.push(plug);
              }
          }
      });
  }

  // Rarity Colors (Border)
  // Check bit 2 (value 4) for Masterwork state in instanceData, OR if Tier is 10
  const isMasterwork = (instanceData ? (instanceData.state & 4) === 4 : false) || (enhancementTier === 10);

  // Ensure enhancement tier reflects masterwork state if not found via plugs
  if (isMasterwork && (!enhancementTier || enhancementTier < 10)) {
      enhancementTier = 10;
  }

  const rarityBorder = hideBorder ? 'border-transparent' : (
      isMasterwork ? 'border-destiny-gold shadow-[0_0_4px_rgba(227,206,98,0.5)]' :
      ({
      'Exotic': 'border-yellow-500',
      'Legendary': 'border-purple-500',
      'Rare': 'border-blue-500',
      'Common': 'border-green-500',
      'Basic': 'border-white/20'
  }[rarity as string] || 'border-white/20'));

  // Merge Stats (Prefer Instance over Definition)
  const stats = { ...(def.stats?.stats || {}) };
  if (instanceData?.stats) {
      Object.entries(instanceData.stats).forEach(([hash, stat]: [string, any]) => {
          stats[hash] = { ...stats[hash], value: stat.value };
      });
  }
  
  // Calculate Tier (Custom Logic)
  const tierNumber = getItemTier(def, socketsData, plugDefs, instanceData);
  const tier = tierNumber > 1 ? `Tier ${tierNumber}` : null;


  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenuPos({ x: e.clientX, y: e.clientY });
      // Disable tooltip when menu is open? Maybe not strictly needed but good UX
      setIsHovered(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
      if (!itemInstanceId) return;
      e.dataTransfer.setData('application/json', JSON.stringify({
          itemHash,
          itemInstanceId,
          ownerId,
          def // Maybe too big?
      }));
      // Also set text for debugging
      e.dataTransfer.setData('text/plain', itemInstanceId);
  };

  // Check lock state (bit 0 of state)
    const isLocked = instanceData ? (instanceData.state & 1) === 1 : false;

    // Expiration Logic
    const expirationDate = instanceData?.expirationDate ? new Date(instanceData.expirationDate) : null;
    const timeLeft = expirationDate ? (() => {
        const diff = expirationDate.getTime() - new Date().getTime();
        if (diff <= 0) return "Expired";
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 24) return `${Math.floor(hours / 24)}d`;
        if (hours > 0) return `${hours}h`;
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}m`;
    })() : null;

    const handleMouseEnter = (e: React.MouseEvent) => {
        if (!contextMenuPos) {
            setInitialTooltipPos({ x: e.clientX, y: e.clientY });
            setIsHovered(true);
        }
    };

    // Size-based styles
    const starConfig = {
        small: { text: 'text-[9px]', top: 'top-3.5', left: 'left-[0.3rem]', gap: 'gap-0' },
        medium: { text: 'text-[11px]', top: 'top-4.5', left: 'left-[0.38rem]', gap: 'gap-0' },
        large: { text: 'text-[13px]', top: 'top-5.5', left: 'left-[0.45rem]', gap: 'gap-0' }
    }[size];

    return (
    <>
        <div 
            className={cn(
                "group relative flex flex-col bg-transparent transition-all cursor-pointer select-none", 
                "h-auto! border-none! overflow-visible!",
                className,
                isPending && "opacity-50 grayscale animate-pulse pointer-events-none"
            )} 
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsHovered(false)}
            onContextMenu={handleContextMenu}
            draggable={!!itemInstanceId}
            onDragStart={handleDragStart}
        >
            {/* Main Icon Container */}
            <div className={cn(
                "relative w-full aspect-square overflow-hidden border-2",
                isSubclass ? "bg-transparent border-none" : "bg-slate-900",
                rarityBorder,
                isDimmed ? "opacity-20 grayscale" : ""
            )}>
                {icon && (
                  <Image 
                    src={icon} 
                    alt={name || "Item Icon"} 
                    title=""
                    fill
                    sizes="(max-width: 768px) 15vw, 10vw"
                    className="object-cover"
                  />
                )}
                
                {/* Seasonal Badge */}
                {(def.iconWatermark || def.iconWatermarkShelved) && (
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <Image 
                            src={getBungieImage(def.iconWatermark || def.iconWatermarkShelved)} 
                            alt="Season"
                            fill
                            sizes="10vw"
                            className="object-cover opacity-100" 
                        />
                    </div>
                )}

                {/* Lock Icon Overlay */}
                {isLocked && (
                    <div className="absolute top-0.5 right-0.5 z-20">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full shadow-sm" />
                    </div>
                )}

                {/* Tier Indicator Overlay (Stars) */}
                {tierNumber > 1 && (
                    <div className={cn(
                        "absolute z-20 flex flex-col leading-none",
                        starConfig.top,
                        starConfig.left,
                        starConfig.gap
                    )}>
                         {Array.from({ length: tierNumber }).map((_, i) => (
                             <span key={i} className={cn(
                                 "drop-shadow-md",
                                 starConfig.text,
                                 tierNumber === 5 ? "text-destiny-gold" : "text-white"
                             )}>
                                ✦
                             </span>
                         ))}
                    </div>
                )}

                {/* Hover Border Overlay */}
                <div className="absolute inset-0 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>

            {/* Bottom Section */}
            {(!minimal && !hidePower && (instanceData?.primaryStat?.value || elementIcon || quantity || (objectives && objectives.length > 0) || timeLeft)) && (
                <div className="mt-1 w-full flex flex-col gap-1 bg-slate-900/90 border border-white/10 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                    {/* Stats/Quantity/Expiration Row */}
                    {(instanceData?.primaryStat?.value || elementIcon || quantity || timeLeft) && (
                        <div className="flex items-center justify-between w-full">
                            {quantity ? (
                                <span className="text-[10px] font-bold leading-none text-white">
                                    {quantity}
                                </span>
                            ) : timeLeft ? (
                                <span className="text-[10px] font-bold leading-none text-yellow-400 flex items-center gap-1">
                                    <span className="text-[8px]">⏳</span> {timeLeft}
                                </span>
                            ) : (
                                <div className="flex flex-col leading-none">
                                    <span className={cn(
                                        "text-[10px] font-bold",
                                        instanceData?.primaryStat?.value ? "text-destiny-gold" : "text-transparent"
                                    )}>
                                        {instanceData?.primaryStat?.value || "0"}
                                    </span>
                                    {powerDiff !== undefined && powerDiff !== 0 && (
                                        <span className={cn(
                                            "text-[9px] font-bold",
                                            powerDiff > 0 ? "text-green-400" : "text-red-400"
                                        )}>
                                            {powerDiff > 0 ? '+' : ''}{powerDiff}
                                        </span>
                                    )}
                                </div>
                            )}
                            
                            {elementIcon && (
                                <Image 
                                    src={elementIcon} 
                                    width={12} 
                                    height={12} 
                                    className="object-contain" 
                                    alt="Element" 
                                />
                            )}
                        </div>
                    )}

                    {/* Objectives Progress (for Quests/Bounties) */}
                    {objectives?.map((obj: any, i: number) => {
                         // Find matching objective definition
                         // Note: We need the objective definition to get the completionValue if not in instance
                         // Usually instance has progress and completionValue
                         const progress = obj.progress || 0;
                         const total = obj.completionValue || 100;
                         const percent = Math.min(100, (progress / total) * 100);
                         const isComplete = obj.complete;

                         return (
                             <div key={i} className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                                 <div 
                                     className={cn("h-full transition-all duration-500", isComplete ? "bg-destiny-gold" : "bg-blue-500")}
                                     style={{ width: `${percent}%` }}
                                 />
                             </div>
                         );
                    })}
                </div>
            )}
        </div>

        {/* Portal Tooltip */}
        {isHovered && !isDimmed && !contextMenuPos && (
            <ItemTooltip 
                name={name} 
                itemType={itemType} 
                rarity={rarity} 
                power={hideTooltipPower ? undefined : instanceData?.primaryStat?.value}
                screenshot={screenshot}
                flavorText={def.flavorText}
                seasonBadge={getBungieImage(def.iconWatermark || def.iconWatermarkShelved)}
                elementIcon={elementIcon}
                stats={stats}
                itemHash={itemHash}
                perks={perks}
                mods={mods}
                shaders={shaders}
                ornaments={ornaments}
                killEffects={killEffects}
                killTrackers={killTrackers}
                enhancementTier={enhancementTier}
                tier={tier}
                initialPosition={initialTooltipPos}
                objectives={objectives}
                itemDef={def}
                isShiny={isShiny}
                detailedPerks={detailedPerks}
            />
        )}

        {/* Context Menu */}
        {contextMenuPos && (
            <ItemContextMenu 
                x={contextMenuPos.x}
                y={contextMenuPos.y}
                onClose={() => setContextMenuPos(null)}
                itemHash={itemHash}
                itemInstanceId={itemInstanceId}
                ownerId={ownerId}
                isLocked={isLocked}
                itemDef={def}
                sockets={resolvedSockets}
                instanceData={instanceData}
                detailedPerks={detailedPerks}
            />
        )}
    </>
  );
}
