import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { getBungieImage } from "@/lib/bungie";
import { getItemTier } from "@/lib/destinyUtils";
import { cn } from "@/lib/utils";
import { Loader2, Lock, Check, Star } from "lucide-react";
import { useMemo } from "react";
import { ItemTooltip } from "./ItemTooltip";
import { useState } from "react";

interface RewardItemProps {
    itemHash: number;
    quantity?: number;
    isUnlocked?: boolean;
    isClaimed?: boolean;
    className?: string;
    showLabel?: boolean;
    hideTooltip?: boolean;
}

const TIER_STYLES: Record<number, string> = {
    1: "border-white/10 bg-gray-900/40",
    2: "border-green-500/50 bg-green-900/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]",
    3: "border-blue-500/50 bg-blue-900/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]",
    4: "border-purple-500/50 bg-purple-900/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]",
    5: "border-destiny-gold/80 bg-amber-900/20 shadow-[0_0_15px_rgba(227,206,98,0.3)] animate-pulse-slow ring-1 ring-destiny-gold/30",
};

export function RewardItem({ 
    itemHash, 
    quantity, 
    isUnlocked = false, 
    isClaimed = false, 
    className,
    showLabel = false,
    hideTooltip = false
}: RewardItemProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<{x: number, y: number} | undefined>(undefined);

    // Batch fetch item definition (though hook handles batching, single use is fine)
    const { definitions, isLoading } = useItemDefinitions([itemHash]);
    const def = definitions[itemHash];

    const tier = useMemo(() => {
        if (!def) return 1;
        // We pass empty sockets/plugs as we don't have instance data for rewards usually
        // But we can try to infer from default plugs if we had them.
        // For now, fallback to simple tier logic or map rarity.
        
        // Map standard TierTypeName to our Tiers
        if (def.inventory?.tierTypeName === "Exotic") return 5;
        if (def.inventory?.tierTypeName === "Legendary") return 4;
        if (def.inventory?.tierTypeName === "Rare") return 3;
        if (def.inventory?.tierTypeName === "Uncommon") return 2;
        
        return 1;
    }, [def]);

    const handleMouseEnter = (e: React.MouseEvent) => {
        setIsHovered(true);
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({ x: rect.right + 10, y: rect.top });
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setTooltipPos(undefined);
    };

    if (isLoading) return <div className={cn("w-12 h-12 bg-white/5 animate-pulse rounded-sm", className)} />;
    if (!def) return null;

    return (
        <div 
            className={cn(
                "relative group flex flex-col items-center gap-1", 
                className
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className={cn(
                "relative w-12 h-12 rounded-sm border overflow-hidden transition-all duration-300",
                TIER_STYLES[tier] || TIER_STYLES[1],
                isUnlocked ? "opacity-100 scale-100" : "opacity-50 grayscale scale-95",
                isClaimed && "opacity-40"
            )}>
                <img src={getBungieImage(def.displayProperties.icon)} alt={def.displayProperties.name} title="" className="w-full h-full object-cover" />
                
                {/* Quantity Overlay */}
                {quantity && quantity > 1 && (
                    <div className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white drop-shadow-md">
                        {quantity}
                    </div>
                )}

                {/* Status Overlays */}
                {isClaimed && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Check className="w-6 h-6 text-green-500" />
                    </div>
                )}
                {!isUnlocked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-white/50" />
                    </div>
                )}
                
                {/* "Edge of Fate" / High Tier Glow */}
                {tier >= 5 && isUnlocked && !isClaimed && (
                    <div className="absolute inset-0 bg-linear-to-t from-destiny-gold/20 to-transparent pointer-events-none mix-blend-overlay" />
                )}
            </div>
            
            {showLabel && (
                <div className="text-[10px] font-medium text-slate-300 text-center w-16 truncate leading-tight">
                    {def.displayProperties.name}
                </div>
            )}

            {/* Tooltip */}
            {isHovered && !hideTooltip && tooltipPos && (
                <ItemTooltip 
                    name={def.displayProperties.name}
                    itemType={def.itemTypeDisplayName}
                    rarity={def.inventory?.tierTypeName}
                    icon={getBungieImage(def.displayProperties.icon)}
                    flavorText={def.flavorText}
                    initialPosition={tooltipPos}
                    itemDef={def}
                />
            )}
        </div>
    );
}




