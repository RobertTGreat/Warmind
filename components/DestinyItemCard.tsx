import useSWR from 'swr';
import Image from 'next/image';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';
import { ItemTooltip } from './ItemTooltip';
import { ItemContextMenu } from './ItemContextMenu';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useTransferStore } from '@/store/transferStore';
import { getItemTier } from '@/lib/destinyUtils';

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
    hideBorder?: boolean;
    minimal?: boolean;
    showClassSymbolOnMismatch?: boolean;
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
    hideBorder,
    minimal,
    showClassSymbolOnMismatch
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

  // State hooks moved up to prevent "Rendered fewer hooks" error
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{x: number, y: number} | null>(null);
  const [initialTooltipPos, setInitialTooltipPos] = useState<{x: number, y: number} | undefined>(undefined);
    
  // Calculate plug hashes to fetch
  // UPDATED: Fetch ALL active plugs immediately to ensure Tier detection works without hover
  const hashesToFetch = useMemo(() => {
      const allHashes = socketsData?.sockets
          ?.filter((s: any) => s.isEnabled && s.isVisible && s.plugHash)
          .map((s: any) => s.plugHash) || [];
          
      const intrinsic = socketsData?.sockets?.[0]?.plugHash;
      
      // Ensure intrinsic is in the list
      if (intrinsic && !allHashes.includes(intrinsic)) {
          allHashes.push(intrinsic);
      }
      
      return Array.from(new Set(allHashes)) as number[];
  }, [socketsData]);

  const { definitions: plugDefs } = useItemDefinitions(hashesToFetch);

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

  // Rarity Colors (Border)
  const rarityBorder = hideBorder ? 'border-transparent' : ({
      'Exotic': 'border-yellow-500',
      'Legendary': 'border-purple-500',
      'Rare': 'border-blue-500',
      'Common': 'border-green-500',
      'Basic': 'border-white/20'
  }[rarity as string] || 'border-white/20');

  // Merge Stats (Prefer Instance over Definition)
  const stats = { ...(def.stats?.stats || {}) };
  if (instanceData?.stats) {
      Object.entries(instanceData.stats).forEach(([hash, stat]: [string, any]) => {
          stats[hash] = { ...stats[hash], value: stat.value };
      });
  }

  // Filter Plugs into Perks and Mods
  const perks: any[] = [];
  const mods: any[] = [];
  
  // Enhancement Tier
  let enhancementTier: number | null = null;

  // Calculate Tier
  const tierNumber = getItemTier(def, socketsData, plugDefs);
  const tier = tierNumber > 1 ? `Tier ${tierNumber}` : null;

  if (socketsData && plugDefs) {
      Object.entries(plugDefs).forEach(([hash, plug]: [string, any]) => {
          if (!plug) return;
          const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
          const category = plug.plug?.plugCategoryIdentifier || "";
          const plugName = plug.displayProperties?.name || "";

          // Check for Masterwork / Enhancement Tier
          if (typeName.includes("masterwork") || category.includes("masterwork")) {
             const tierMatch = plug.displayProperties?.name?.match(/Tier (\d+)/);
             if (tierMatch) {
                 enhancementTier = parseInt(tierMatch[1], 10);
             }
             return;
          }

          if (typeName.includes("shader") || typeName.includes("ornament")) return;
          
          if (typeName.includes("trait") || typeName.includes("perk") || category.includes("trait") || category.includes("frames")) {
              perks.push(plug);
          } 
          else if (typeName.includes("mod")) {
              mods.push(plug);
          }
      });
  }


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
                "relative w-full aspect-square overflow-hidden border-2 bg-slate-900",
                rarityBorder,
                isDimmed ? "opacity-20 grayscale" : ""
            )}>
                {icon && (
                  <Image 
                    src={icon} 
                    alt={name || "Item Icon"} 
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

                {/* Tier Indicator Overlay (Diamonds) */}
                {tierNumber > 1 && (
                    <div className="absolute top-8 left-1 z-20 flex flex-col gap-0.5">
                         {Array.from({ length: tierNumber }).map((_, i) => (
                             <div key={i} className={cn(
                                 "w-1.5 h-1.5 rotate-45 shadow-sm border-[0.5px] border-black/50",
                                 tierNumber === 5 ? "bg-destiny-gold" : "bg-white"
                             )} />
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
                power={instanceData?.primaryStat?.value}
                screenshot={screenshot}
                flavorText={def.flavorText}
                seasonBadge={getBungieImage(def.iconWatermark || def.iconWatermarkShelved)}
                elementIcon={elementIcon}
                stats={stats}
                itemHash={itemHash}
                perks={perks}
                mods={mods}
                enhancementTier={enhancementTier}
                tier={tier}
                initialPosition={initialTooltipPos}
                objectives={objectives}
                itemDef={def}
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
            />
        )}
    </>
  );
}
