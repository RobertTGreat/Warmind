import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 1. Get Season Definition
    const { data: seasonDefData, error: seasonError } = useSWR(
        seasonHash ? endpoints.getSeasonDefinition(seasonHash) : null,
        fetcher
    );
    const seasonDef = seasonDefData?.Response;

    // 2. Get Season Pass Definition
    const { data: seasonPassDefData, error: seasonPassError } = useSWR(
        seasonDef?.seasonPassHash ? endpoints.getSeasonPassDefinition(seasonDef.seasonPassHash) : null,
        fetcher
    );
    const seasonPassDef = seasonPassDefData?.Response;

    // 3. Get Progression Definition (Reward Track)
    const { data: progressionDefData, error: progressionError } = useSWR(
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
            // If we have prestige levels, we add them to the cap (usually 100)
            // But for the track display, we usually just care about the base level for the 1-100 track.
            // If level > 100, we show 100 as complete?
            // Actually, the progression level goes up to 100. Then prestige takes over.
            
            setCurrentRank(level + prestigeLevel);
        }
    }, [progressionDef, progressions, seasonPassDef]);

    // Scroll to current rank on load
    useEffect(() => {
        if (scrollContainerRef.current && currentRank > 0) {
            // Estimate width of a rank column (e.g., 80px)
            // Center the current rank
            const rankWidth = 90; // w-20 + gap
            const containerWidth = scrollContainerRef.current.clientWidth;
            const scrollPos = Math.max(0, (currentRank * rankWidth) - (containerWidth / 2));
            
            // Only scroll if we haven't interacted yet or it's initial load
            // Simple check: just scroll.
            scrollContainerRef.current.scrollTo({
                left: scrollPos,
                behavior: 'smooth'
            });
        }
    }, [currentRank, progressionDef]); // Run when progression loads and rank is set

    // Handle missing hash or errors
    if (!seasonHash) {
        return (
            <div className="h-40 flex flex-col items-center justify-center border border-white/10 rounded-sm bg-black/20 text-slate-500 gap-2">
                <span className="font-bold">No Active Season Found</span>
                <span className="text-xs opacity-70">Could not determine current season from profile.</span>
            </div>
        );
    }

    if (seasonError || seasonPassError || progressionError) {
        return (
            <div className="h-40 flex flex-col items-center justify-center border border-red-500/20 rounded-sm bg-red-900/10 text-red-400 gap-2">
                <span className="font-bold">Failed to load season data</span>
                <span className="text-xs opacity-70">Please try refreshing the page.</span>
            </div>
        );
    }

    if (!seasonDef) {
         return (
            <div className="h-64 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-destiny-gold w-8 h-8" />
                <span className="text-xs text-slate-500">Loading Season Definition...</span>
            </div>
         );
    }

    if (!seasonPassDef && !seasonPassError) {
         // If we have seasonDef but no seasonPassDef yet (and no error), it's loading.
         // But if seasonDef.seasonPassHash is missing, we'll never load.
         if (!seasonDef.seasonPassHash) {
             return (
                <div className="h-40 flex items-center justify-center border border-white/10 rounded-sm bg-black/20 text-slate-500">
                    No Season Pass available for this season.
                </div>
             );
         }
         return (
            <div className="h-64 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-destiny-gold w-8 h-8" />
                <span className="text-xs text-slate-500">Loading Season Pass...</span>
            </div>
         );
    }

    if (!progressionDef && !progressionError) {
         if (seasonPassDef && !seasonPassDef.rewardProgressionHash) {
              return (
                <div className="h-40 flex items-center justify-center border border-white/10 rounded-sm bg-black/20 text-slate-500">
                    No Reward Track available.
                </div>
             );
         }
         return (
            <div className="h-64 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-destiny-gold w-8 h-8" />
                <span className="text-xs text-slate-500">Loading Rewards...</span>
            </div>
         );
    }

    const steps = progressionDef.steps; // 0 to 100 usually

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -500, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 500, behavior: 'smooth' });
        }
    };

    return (
        <div className="space-y-4 bg-black/40 border border-white/10 rounded-lg p-6 backdrop-blur-md">
            <div className="flex justify-between items-end border-b border-white/10 pb-4">
                <div>
                    <h3 className="text-2xl font-bold text-white uppercase tracking-wide font-destiny">{seasonName}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="px-2 py-0.5 bg-destiny-gold/10 text-destiny-gold rounded border border-destiny-gold/20 uppercase text-xs font-bold">Season Pass</span>
                        <span>•</span>
                        <span>Rank {currentRank}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={scrollLeft}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button 
                        onClick={scrollRight}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Track Container */}
            <div 
                ref={scrollContainerRef}
                className="relative overflow-x-auto pb-4 no-scrollbar cursor-grab active:cursor-grabbing select-none"
                style={{ scrollBehavior: 'smooth' }}
            >
                <div className="flex px-4 min-w-max">
                    {/* Labels Column (Sticky?) - Hard to make sticky in horizontal scroll without extra markup. 
                        For now, we just render the track. 
                    */}
                    
                    {steps.map((step: any, index: number) => {
                        const rank = index + 1;
                        const isUnlocked = rank <= currentRank;
                        const isCurrent = rank === currentRank + 1;
                        
                        // rewardItems array. Usually [0] is free, [1] is premium? 
                        // Or maybe we just stack them.
                        // Let's render them in a stack.
                        const rewards = step.rewardItems;

                        return (
                            <div 
                                key={rank} 
                                className={cn(
                                    "flex flex-col items-center min-w-[80px] px-2 border-r border-white/5 relative group",
                                    isCurrent ? "bg-white/5" : ""
                                )}
                            >
                                {/* Rank Number */}
                                <div className={cn(
                                    "text-xs font-mono mb-4 py-1 px-2 rounded",
                                    isUnlocked ? "text-destiny-gold bg-destiny-gold/10" : "text-slate-600"
                                )}>
                                    {rank}
                                </div>

                                {/* Rewards Stack */}
                                <div className="flex flex-col gap-3 items-center justify-end h-full pb-2">
                                    {rewards.length === 0 && (
                                        <div className="w-12 h-12" /> /* Spacer */
                                    )}
                                    {rewards.map((reward: any, i: number) => (
                                        <div key={`${rank}-${i}`} className="relative">
                                            <RewardItem 
                                                itemHash={reward.itemHash} 
                                                quantity={reward.quantity}
                                                isUnlocked={isUnlocked}
                                                isClaimed={isUnlocked} // Assuming auto-claim visual for now
                                                className={cn(
                                                    "w-14 h-14",
                                                    isCurrent && "scale-110 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                                )}
                                                hideTooltip={false}
                                            />
                                            {/* Track Indicator (Top is Free? Bottom is Premium? We don't know for sure without more data, so we just list) */}
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Hover Effect Background */}
                                <div className="absolute inset-0 hover:bg-white/5 pointer-events-none transition-colors" />
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="flex justify-between text-xs text-slate-500 px-4">
                <div>Free Track</div>
                <div>Premium Track</div>
            </div>
        </div>
    );
}
