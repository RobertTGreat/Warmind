import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { Loader2, Lock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FrostedCard } from './FrostedCard';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface SeasonPassTrackProps {
    seasonHash?: number;
    progressions?: Record<string, any>;
}

export function SeasonPassTrack({ seasonHash, progressions }: SeasonPassTrackProps) {
    const [rewards, setRewards] = useState<any[]>([]);
    const [currentRank, setCurrentRank] = useState(0);
    const [seasonName, setSeasonName] = useState("");

    // 1. Get Season Definition
    const { data: seasonDefData } = useSWR(
        seasonHash ? endpoints.getSeasonDefinition(seasonHash) : null,
        fetcher
    );
    const seasonDef = seasonDefData?.Response;

    // 2. Get Season Pass Definition
    const { data: seasonPassDefData } = useSWR(
        seasonDef?.seasonPassHash ? endpoints.getSeasonPassDefinition(seasonDef.seasonPassHash) : null,
        fetcher
    );
    const seasonPassDef = seasonPassDefData?.Response;

    // 3. Get Progression Definition (Reward Track)
    const { data: progressionDefData } = useSWR(
        seasonPassDef?.rewardProgressionHash ? endpoints.getProgressionDefinition(seasonPassDef.rewardProgressionHash) : null,
        fetcher
    );
    const progressionDef = progressionDefData?.Response;

    useEffect(() => {
        if (seasonDef) {
            setSeasonName(seasonDef.displayProperties?.name);
        }
    }, [seasonDef]);

    useEffect(() => {
        if (progressionDef && progressions && seasonPassDef) {
            const progressionHash = seasonPassDef.rewardProgressionHash;
            const prestigeProgressionHash = seasonPassDef.prestigeRewardProgressionHash;
            
            const userProgression = progressions[progressionHash];
            const userPrestigeProgression = progressions[prestigeProgressionHash];
            
            const level = userProgression?.level || 0;
            const prestigeLevel = userPrestigeProgression?.level || 0;
            const totalLevel = level + prestigeLevel;

            setCurrentRank(totalLevel);

            // Get steps around current level
            // For simplicity, show levels 1-100 or focused range. 
            // Let's show 5 previous and 10 next
            const steps = progressionDef.steps;
            
            // Map steps to rewards
            // This is heavy if we fetch all items. For now, let's just list them and fetch items for visible range.
            // We'll just handle the display logic in render
        }
    }, [progressionDef, progressions, seasonPassDef]);

    if (!seasonDef || !progressionDef) {
        return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;
    }

    const steps = progressionDef.steps;
    // Determine visible range: Start at max(0, currentRank - 2), show 7 items
    const startRank = Math.max(0, Math.min(currentRank - 2, steps.length - 7));
    const visibleSteps = steps.slice(startRank, startRank + 7);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wide">{seasonName}</h3>
                    <p className="text-xs text-slate-400">Season Pass</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-destiny-gold">Rank {currentRank}</div>
                </div>
            </div>

            {/* Track Container */}
            <div className="relative overflow-x-auto pb-4 no-scrollbar">
                <div className="flex gap-2 min-w-max px-1">
                    {visibleSteps.map((step: any, index: number) => {
                        const rank = startRank + index + 1;
                        const isUnlocked = rank <= currentRank;
                        const isNext = rank === currentRank + 1;
                        
                        return (
                            <RewardStep 
                                key={rank} 
                                rank={rank} 
                                step={step} 
                                isUnlocked={isUnlocked}
                                isNext={isNext}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function RewardStep({ rank, step, isUnlocked, isNext }: { rank: number, step: any, isUnlocked: boolean, isNext: boolean }) {
    // Extract item hash from step
    // step.rewardItems is array of { itemHash, quantity, ... }
    const freeReward = step.rewardItems.find((i: any) => i.uiDisplayStyle !== 'premium'); // simplified logic
    // Actually Destiny structure usually has separate arrays for free/paid in the UI or just one list in progression
    // In `DestinyProgressionDefinition`, steps have `rewardItems`.
    // BUT Season Pass usually has TWO tracks. One for free, one for premium.
    // However, `rewardProgressionHash` is usually just ONE track.
    // Wait, Season Pass definition has `rewardProgressionHash` AND `prestigeRewardProgressionHash`.
    // Usually the Main track (1-100) is `rewardProgressionHash`.
    // And inside that, each step has `rewardItems`.
    // Usually item at index 0 is free, index 1 is paid? Or different properties?
    // Let's just show the first item for now to be safe.

    const itemHash = step.rewardItems[0]?.itemHash;

    const { data: itemDefData } = useSWR(
        itemHash ? endpoints.getItemDefinition(itemHash) : null,
        fetcher
    );
    const itemDef = itemDefData?.Response;

    if (!itemDef) return <div className="w-16 h-24 bg-white/5 animate-pulse rounded-sm" />;

    return (
        <div className={cn(
            "w-20 flex flex-col items-center gap-2 p-2 rounded-sm border transition-all",
            isUnlocked ? "bg-green-900/20 border-green-500/30 opacity-70" : 
            isNext ? "bg-destiny-gold/10 border-destiny-gold scale-105 z-10 shadow-[0_0_15px_rgba(227,206,98,0.2)]" : 
            "bg-gray-800/40 border-white/10 opacity-50"
        )}>
             <div className="text-xs font-mono text-slate-400 mb-1">
                 {rank}
             </div>
             <div className="relative w-12 h-12 bg-black rounded-sm border border-white/5 overflow-hidden">
                 <img src={getBungieImage(itemDef.displayProperties.icon)} alt="" className="w-full h-full object-cover" />
                 {isUnlocked && (
                     <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                         <Check className="w-6 h-6 text-green-500" />
                     </div>
                 )}
                 {!isUnlocked && !isNext && (
                     <div className="absolute inset-0 flex items-center justify-center">
                         <Lock className="w-4 h-4 text-slate-500" />
                     </div>
                 )}
             </div>
        </div>
    );
}

