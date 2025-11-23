import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RewardItem } from './RewardItem';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface SeasonPassTrackProps {
    seasonHash?: number;
    progressions?: Record<string, any>;
}

export function SeasonPassTrack({ seasonHash, progressions }: SeasonPassTrackProps) {
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
        }
    }, [progressionDef, progressions, seasonPassDef]);

    if (!seasonDef || !progressionDef) {
        return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;
    }

    const steps = progressionDef.steps;
    // Determine visible range: Start at max(0, currentRank - 2), show 8 items
    const startRank = Math.max(0, Math.min(currentRank - 2, steps.length - 8));
    const visibleSteps = steps.slice(startRank, startRank + 8);

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
                        
                        // Usually multiple items (free/premium), just pick first for now
                        const itemHash = step.rewardItems[0]?.itemHash;

                        if (!itemHash) return null;

                        return (
                            <div key={rank} className={cn(
                                "flex flex-col items-center p-2 rounded-sm border transition-all relative",
                                isNext ? "bg-destiny-gold/5 border-destiny-gold scale-105 z-10" : "border-transparent opacity-80"
                            )}>
                                <div className="text-xs font-mono text-slate-500 mb-2">{rank}</div>
                                <RewardItem 
                                    itemHash={itemHash} 
                                    isUnlocked={isUnlocked}
                                    isClaimed={isUnlocked} // Assume claimed if unlocked for now (UI limitation)
                                    className={isNext ? "scale-110" : ""}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
