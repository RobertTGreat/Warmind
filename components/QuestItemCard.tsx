'use client';

import Image from 'next/image';
import { getBungieImage } from '@/lib/bungie';
import { cn } from '@/lib/utils';
import { useObjectiveDefinitions } from '@/hooks/useObjectiveDefinitions';
import { useMemo, useState } from 'react';
import { ItemTooltip } from './ItemTooltip';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';

interface QuestItemCardProps {
  itemHash: number;
  instanceData: any;
  definition: any;
  objectives: any[];
  className?: string;
}

export function QuestItemCard({ 
    itemHash, 
    instanceData, 
    definition: def, 
    objectives,
    className 
}: QuestItemCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{x: number, y: number} | undefined>(undefined);

  // Resolve objective definitions
  const objectiveHashes = useMemo(() => objectives?.map((o: any) => o.objectiveHash) || [], [objectives]);
  const { definitions: objectiveDefs } = useObjectiveDefinitions(objectiveHashes);

  // Resolve Reward Items (if any)
  // Quest rewards are often in the definition under `value?.itemValue` or `rewardItemHash`?
  // Actually, for quests, rewards are complex. Often they are in `inventory.bucketTypeHash` or not directly exposed easily without vendor definitions.
  // BUT, `displayProperties.icon` is often the reward itself for some steps.
  // Let's check `value` first.
  const rewardItems = useMemo(() => {
      // Simple check for item value rewards
      if (def?.value?.itemValue) {
          return def.value.itemValue
            .filter((v: any) => v.itemHash > 0)
            .map((v: any) => ({ itemHash: v.itemHash, quantity: v.quantity }));
      }
      return [];
  }, [def]);

  const rewardHashes = useMemo(() => rewardItems.map((r: any) => r.itemHash), [rewardItems]);
  const { definitions: rewardDefs } = useItemDefinitions(rewardHashes);

  if (!def) return null;

  const icon = getBungieImage(def.displayProperties?.icon);
  const name = def.displayProperties?.name;
  const description = def.displayProperties?.description;
  const itemType = def.itemTypeDisplayName;
  
  const handleMouseEnter = (e: React.MouseEvent) => {
      setTooltipPos({ x: e.clientX, y: e.clientY });
      setIsHovered(true);
  };

  return (
    <>
        <div 
            className={cn(
                "flex gap-4 bg-gray-800/20 border border-white/10 p-4 hover:border-white/50 transition-colors cursor-pointer relative overflow-hidden group", 
                className
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background Image/Watermark */}
            {def.screenshot && (
                <div className="absolute inset-0 z-0 opacity-10 mask-image-linear-gradient">
                     <Image 
                        src={getBungieImage(def.screenshot)} 
                        fill 
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover" 
                        alt="" 
                     />
                </div>
            )}

            {/* Left: Icon */}
            <div className="shrink-0 relative z-10">
                <div className="w-24 h-24 border border-white/20 bg-slate-900 shadow-lg relative overflow-hidden">
                    <Image 
                        src={icon} 
                        alt={name} 
                        title=""
                        fill 
                        sizes="96px"
                        className="object-cover" 
                    />
                    {/* Season Badge - Adjusted to fit bottom right corner properly */}
                    {(def.iconWatermark || def.iconWatermarkShelved) && (
                        <Image 
                            src={getBungieImage(def.iconWatermark || def.iconWatermarkShelved)} 
                            width={32}
                            height={32}
                            className="absolute bottom-0 right-0 object-contain z-20" 
                            alt="Season"
                        />
                    )}
                </div>
            </div>

            {/* Right: Content */}
            <div className="flex-1 min-w-0 flex flex-col z-10 relative">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-white">{name}</h3>
                        <span className="text-xs text-destiny-gold font-bold uppercase tracking-widest">{itemType}</span>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                        {/* Expiration if applicable */}
                        {instanceData.expirationDate && (
                             <span className="text-xs text-yellow-500 font-bold">
                                 Expires in {Math.ceil((new Date(instanceData.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60))}h
                             </span>
                        )}

                        {/* Quest Rewards (Top Right) */}
                        {rewardItems.length > 0 && (
                            <div className="flex gap-1 mt-1">
                                {rewardItems.map((reward: any) => {
                                    const rDef = rewardDefs[reward.itemHash];
                                    if (!rDef) return null;
                                    return (
                                        <div key={reward.itemHash} className="w-6 h-6 border border-white/20 overflow-hidden bg-black relative" title={rDef.displayProperties?.name}>
                                            <Image 
                                                src={getBungieImage(rDef.displayProperties?.icon)} 
                                                fill 
                                                sizes="24px"
                                                className="object-cover" 
                                                alt={rDef.displayProperties?.name || ""} 
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                    {description}
                </p>

                {/* Objectives - Now for ALL quests if present */}
                {objectives && objectives.length > 0 && (
                    <div className="mt-auto pt-3 space-y-2">
                        {objectives.map((obj: any) => {
                             const objDef = objectiveDefs[obj.objectiveHash];
                             const progress = obj.progress || 0;
                             const total = obj.completionValue || objDef?.completionValue || 100;
                             const percent = Math.min(100, (progress / total) * 100);
                             const isComplete = obj.complete;
                             const objDesc = objDef?.progressDescription || objDef?.displayProperties?.name || "Objective";

                             return (
                                 <div key={obj.objectiveHash} className="w-full">
                                     <div className="flex justify-between text-xs mb-1 text-slate-400 uppercase tracking-wider font-bold">
                                         <span>{objDesc}</span>
                                         <span>{progress} / {total}</span>
                                     </div>
                                     <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                         <div 
                                             className={cn("h-full transition-all duration-500", isComplete ? "bg-destiny-gold" : "bg-teal-500")}
                                             style={{ width: `${percent}%` }}
                                         />
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* Tooltip */}
        {isHovered && (
            <ItemTooltip 
                name={name}
                itemType={itemType}
                rarity={def.inventory?.tierTypeName}
                icon={icon}
                screenshot={getBungieImage(def.screenshot)}
                flavorText={def.flavorText}
                seasonBadge={getBungieImage(def.iconWatermark || def.iconWatermarkShelved)}
                itemHash={itemHash}
                initialPosition={tooltipPos}
                objectives={objectives}
                itemDef={def}
            />
        )}
    </>
  );
}
