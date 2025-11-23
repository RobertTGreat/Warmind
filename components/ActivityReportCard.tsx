import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { ActivityDefinition } from '@/lib/activityDefinitions';
import { cn } from '@/lib/utils';
import { Skull, ShieldAlert, Sword, ChevronLeft, Loader2 } from 'lucide-react';
import { ActivityStats } from './ActivityStats';
import { ActivityHistoryItem, usePGCR, PGCRPlayer } from '@/hooks/useActivityHistory';
import { useMemo, useState } from 'react';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface ActivityReportCardProps {
    activity: ActivityDefinition;
    metrics: any; // profile.metrics.data
    records: any; // profile.profileRecords.data
    collectibles: any; // profile.profileCollectibles.data
    history: ActivityHistoryItem[];
    onSelectRun: (instanceId: string) => void;
    characterIds: string[]; // IDs of characters (for weekly progress)
    characterClasses: Record<string, string>; // Map ID to Class Name (Titan/Hunter/Warlock)
    className?: string;
}

function CardBack({ instanceId, onBack }: { instanceId: string, onBack: () => void }) {
    const { pgcr, isLoading, isError } = usePGCR(instanceId);

    if (isLoading) return (
        <div className="w-full h-full flex items-center justify-center bg-[#161b22]">
            <Loader2 className="w-8 h-8 animate-spin text-destiny-gold" />
        </div>
    );

    if (isError || !pgcr) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#161b22] p-4 text-center">
            <p className="text-red-400 mb-4">Failed to load report</p>
            <button onClick={onBack} className="text-sm text-slate-400 hover:text-white">Back</button>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-[#161b22] overflow-hidden">
            <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-slate-900/50">
                <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <h3 className="text-sm font-bold text-white truncate">
                    {new Date(pgcr.period).toLocaleString()}
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {pgcr.entries.map((entry: PGCRPlayer, idx: number) => {
                    const isCompleted = entry.values.completed.basic.value === 1;
                    const emblem = getBungieImage(entry.player.destinyUserInfo.iconPath);
                    
                    return (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-slate-800/30 rounded border border-white/5 text-xs">
                            <div className="w-8 h-8 rounded overflow-hidden bg-slate-700 shrink-0">
                                <img src={emblem} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-white truncate">
                                    {entry.player.destinyUserInfo.displayName}
                                </div>
                                <div className="flex justify-between text-slate-400 mt-1">
                                    <span>K: {entry.values.kills.basic.displayValue}</span>
                                    <span className={isCompleted ? "text-green-400" : "text-red-400"}>
                                        {isCompleted ? "✓" : "✕"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function ActivityReportCard({ 
    activity, 
    metrics, 
    records, 
    collectibles, 
    history, 
    onSelectRun,
    characterIds,
    characterClasses,
    className 
}: ActivityReportCardProps) {
    // Local state for flipping
    const [flippedInstanceId, setFlippedInstanceId] = useState<string | null>(null);

    // Fetch Activity Definition
    const { data: activityDefData } = useSWR(
        endpoints.getActivityDefinition(activity.activityHash),
        fetcher,
        { revalidateOnFocus: false }
    );
    const def = activityDefData?.Response;

    // 1. Get Completions (Metric)
    let completions = 0;
    if (activity.metricHash && metrics?.metrics?.[activity.metricHash]) {
        completions = metrics.metrics[activity.metricHash].objectiveProgress.progress;
    }

    // 2. Check Flawless
    const isFlawless = activity.flawlessRecordHash 
        ? records?.records?.[activity.flawlessRecordHash]?.objectives?.[0]?.complete 
        : false;

    // 3. Check Solo Flawless
    const isSoloFlawless = activity.soloFlawlessRecordHash
        ? records?.records?.[activity.soloFlawlessRecordHash]?.objectives?.[0]?.complete
        : false;

    // 4. Check Exotic
    const isExoticAcquired = activity.exoticItemHash 
        ? (collectibles?.collectibles?.[activity.exoticItemHash]?.state & 1) === 0
        : false;

    // Filter history for this activity (matching primary hash OR any related hashes)
    const activityHistory = history.filter(h => 
        h.activityDetails.referenceId === activity.activityHash || 
        activity.relatedActivityHashes?.includes(h.activityDetails.referenceId)
    );

    // 5. Weekly Progress (Client-side calculation from history)
    const weeklyProgress = useMemo(() => {
        const now = new Date();
        const dayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue...
        // Destiny Reset is Tuesday 17:00 UTC
        // Calculate most recent Tuesday 17:00 UTC
        
        const resetDay = 2; // Tuesday
        let daysSinceReset = dayOfWeek - resetDay;
        if (daysSinceReset < 0) daysSinceReset += 7;
        
        const lastReset = new Date(now);
        lastReset.setUTCDate(now.getUTCDate() - daysSinceReset);
        lastReset.setUTCHours(17, 0, 0, 0);

        if (now < lastReset) {
            lastReset.setUTCDate(lastReset.getUTCDate() - 7);
        }

        const progress: Record<string, boolean> = {};
        characterIds.forEach(id => progress[id] = false);

        activityHistory.forEach(run => {
             if (run.values.completed.basic.value === 1) {
                 const runDate = new Date(run.period);
                 if (runDate >= lastReset) {
                     if (run.characterId) {
                         progress[run.characterId] = true;
                     }
                 }
             }
        });
        
        return progress;
    }, [activityHistory, characterIds]);

    const rawName = def?.displayProperties?.name || activity.name;
    const name = rawName?.replace(/: Normal|: Standard/g, '').trim() || rawName;
    const image = def?.pgcrImage ? getBungieImage(def.pgcrImage) : activity.image;

    return (
        <div className={cn(
            "group/card relative flex flex-col rounded-xl border border-white/10 bg-[#161b22] text-white shadow-xl transition-all hover:border-white/30 hover:shadow-2xl min-h-[400px]",
            className
        )} style={{ perspective: '1000px' }}>
            <div className={cn(
                "relative w-full h-full transition-transform duration-500 transform-style-3d",
                flippedInstanceId ? "rotate-y-180" : ""
            )}>
                {/* FRONT */}
                <div className={cn(
                    "w-full h-full backface-hidden flex flex-col transition-opacity duration-200",
                    flippedInstanceId ? "opacity-0 pointer-events-none delay-150" : "opacity-100 delay-150"
                )}>
                    {/* Background Image Section */}
                    <div className="relative h-48 shrink-0 overflow-hidden bg-slate-900 rounded-t-xl">
                        {image && (
                            <img 
                                src={image} 
                                alt={name} 
                                className="w-full h-full object-cover opacity-75 transition-transform duration-700 group-hover/card:scale-105"
                            />
                        )}
                        <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/20 to-[#161b22]" />
                        
                        {/* Title Overlay */}
                        <div className="absolute bottom-3 left-4 z-10">
                            <h3 className="text-2xl font-bold text-white drop-shadow-md tracking-wide">{name}</h3>
                        </div>

                        {/* Weekly Progress (Top Left) */}
                        <div className="absolute top-3 left-3 flex gap-2 z-20">
                            {characterIds.map(charId => {
                                const clsName = characterClasses[charId] || 'Unknown';
                                const isDone = weeklyProgress[charId];
                                const iconPath = `/class-${clsName.toLowerCase()}.svg`;

                                return (
                                     <div key={charId} className={cn(
                                         "w-8 h-8 rounded-full flex items-center justify-center border transition-all backdrop-blur-sm",
                                         isDone 
                                             ? "border-destiny-gold shadow-[0_0_15px_rgba(227,206,98,0.6)] bg-destiny-gold/20" 
                                             : "border-white/20 bg-black/50 opacity-60"
                                     )} title={`${clsName} - ${isDone ? 'Completed' : 'Not Completed'}`}>
                                         <img src={iconPath} alt={clsName} className="w-5 h-5" style={{ filter: isDone ? 'none' : 'brightness(0.7)' }} /> 
                                     </div>
                                );
                            })}
                        </div>

                        {/* Badges Overlay (Top Right) */}
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                            {isSoloFlawless && (
                                 <div className="px-2 py-1 bg-black/70 backdrop-blur rounded border border-destiny-gold/50 text-[10px] text-destiny-gold font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                    <Skull className="w-3 h-3" /> Solo Flawless
                                 </div>
                            )}
                            {isFlawless && !isSoloFlawless && (
                                 <div className="px-2 py-1 bg-black/70 backdrop-blur rounded border border-purple-500/50 text-[10px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                    <ShieldAlert className="w-3 h-3" /> Flawless
                                 </div>
                            )}
                            {activity.exoticItemHash && isExoticAcquired && (
                                <div className="px-2 py-1 bg-black/70 backdrop-blur rounded border border-yellow-500/50 text-[10px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                    <Sword className="w-3 h-3" /> Exotic
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col p-5 gap-4 bg-[#161b22] rounded-b-xl">
                        {/* Header Stats Row */}
                        <div className="flex justify-between items-start border-b border-white/5 pb-4">
                            <div className="flex flex-col w-full">
                                 {/* Use ActivityStats for summary dots & stats */}
                                 {/* We intercept onSelectRun to toggle flip instead */}
                                 <ActivityStats 
                                    activity={activity} 
                                    history={activityHistory} 
                                    onSelectRun={(id) => setFlippedInstanceId(id)} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* BACK */}
                <div className="absolute inset-0 h-full w-full backface-hidden rotate-y-180 rounded-xl overflow-hidden bg-[#161b22] border border-white/10 shadow-xl">
                    {flippedInstanceId && (
                        <CardBack 
                            instanceId={flippedInstanceId} 
                            onBack={() => setFlippedInstanceId(null)} 
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
