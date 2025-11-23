import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { ActivityDefinition } from '@/lib/activityDefinitions';
import { cn } from '@/lib/utils';
import { Skull, ShieldAlert, Sword, ChevronLeft, Loader2, Timer, Zap, BarChart2, Target } from 'lucide-react';
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

function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
}

function AdvancedStats({ 
    activity, 
    history, 
    onBack 
}: { 
    activity: ActivityDefinition, 
    history: ActivityHistoryItem[], 
    onBack: () => void 
}) {
    const stats = useMemo<{
        totalKills: number;
        totalDeaths: number;
        totalAssists: number;
        totalTimeSeconds: number;
        normalRuns: number;
        masterRuns: number;
        fastestRun: ActivityHistoryItem | null;
        completedRuns: number;
        kd: string | number;
    }>(() => {
        let totalKills = 0;
        let totalDeaths = 0;
        let totalAssists = 0;
        let totalTimeSeconds = 0;
        let normalRuns = 0;
        let masterRuns = 0;
        let fastestRun: ActivityHistoryItem | null = null;
        let completedRuns = 0;

        const normalHash = activity.relatedActivityHashes?.[0] || activity.activityHash;
        const masterHash = activity.relatedActivityHashes?.[1];

        history.forEach(run => {
            const completed = run.values.completed.basic.value === 1;
            if (!completed) return;

            completedRuns++;
            totalKills += run.values.kills.basic.value;
            totalDeaths += run.values.deaths.basic.value;
            totalAssists += run.values.assists.basic.value;
            
            const duration = run.values.activityDurationSeconds.basic.value;
            totalTimeSeconds += duration;

            if (!fastestRun || duration < fastestRun.values.activityDurationSeconds.basic.value) {
                fastestRun = run;
            }

            if (run.activityDetails.referenceId === normalHash) {
                normalRuns++;
            } else if (masterHash && run.activityDetails.referenceId === masterHash) {
                masterRuns++;
            } else {
                // Fallback if hash doesn't match known (e.g. older versions)
                // Count as normal for now or just ignore
                normalRuns++;
            }
        });

        return {
            totalKills,
            totalDeaths,
            totalAssists,
            totalTimeSeconds,
            normalRuns,
            masterRuns,
            fastestRun,
            completedRuns,
            kd: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills
        };
    }, [history, activity]);

    return (
        <div className="w-full h-full flex flex-col bg-[#161b22] overflow-hidden">
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <h3 className="text-sm font-bold text-white">Advanced Statistics</h3>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                        <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                            <Target className="w-3 h-3" /> Total Kills
                        </div>
                        <div className="text-lg font-bold text-white">{stats.totalKills.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                        <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                            <Skull className="w-3 h-3" /> Total Deaths
                        </div>
                        <div className="text-lg font-bold text-white">{stats.totalDeaths.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                        <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                            <Sword className="w-3 h-3" /> Total Assists
                        </div>
                        <div className="text-lg font-bold text-white">{stats.totalAssists.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                        <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                            <Timer className="w-3 h-3" /> Total Time
                        </div>
                        <div className="text-lg font-bold text-white">
                            {Math.floor(stats.totalTimeSeconds / 3600)}h {Math.floor((stats.totalTimeSeconds % 3600) / 60)}m
                        </div>
                    </div>
                    <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                        <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                            <Target className="w-3 h-3" /> K/D Ratio
                        </div>
                        <div className="text-lg font-bold text-destiny-gold">{stats.kd}</div>
                    </div>
                     <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                        <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3" /> Completions
                        </div>
                        <div className="text-lg font-bold text-white">{stats.completedRuns}</div>
                    </div>
                </div>

                {/* Run Types */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Difficulty Breakdown</h4>
                    <div className="bg-slate-800/30 p-3 rounded border border-white/5 flex justify-between items-center">
                        <span className="text-sm text-white">Normal</span>
                        <span className="text-sm font-mono text-slate-300">{stats.normalRuns}</span>
                    </div>
                    {stats.masterRuns > 0 && (
                        <div className="bg-slate-800/30 p-3 rounded border border-white/5 flex justify-between items-center">
                            <span className="text-sm text-yellow-400 font-semibold">Master</span>
                            <span className="text-sm font-mono text-yellow-400">{stats.masterRuns}</span>
                        </div>
                    )}
                </div>

                 {/* Fastest Run */}
                 {stats.fastestRun && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fastest Run</h4>
                        <div className="bg-slate-800/30 p-3 rounded border border-white/5 border-l-4 border-l-destiny-gold">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-bold text-white">
                                    {formatDuration(stats.fastestRun.values.activityDurationSeconds.basic.value)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {new Date(stats.fastestRun.period).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="text-xs text-slate-500">
                                Instance: {stats.fastestRun.activityDetails.instanceId}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function CardBack({ instanceId, onBack }: { instanceId: string, onBack: () => void }) {
    const { pgcr, isLoading, isError } = usePGCR(instanceId);

    if (isLoading) return (
        <div className="w-full h-full flex items-center justify-center bg-[#161b22]">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-destiny-gold" />
                <span className="text-xs text-slate-500">Loading Report...</span>
            </div>
        </div>
    );

    if (isError || !pgcr) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#161b22] p-4 text-center">
            <p className="text-red-400 mb-4 text-sm">Failed to load report</p>
            <button onClick={onBack} className="text-xs text-slate-400 hover:text-white border border-white/10 px-3 py-1 rounded">Back</button>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-[#161b22] overflow-hidden">
            <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-slate-900/50 z-10">
                <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate leading-tight">
                        {new Date(pgcr.period).toLocaleString()}
                    </h3>
                    <div className="text-[10px] text-slate-400 flex gap-2">
                         <span>{formatDuration(pgcr.values?.activityDurationSeconds?.basic?.value || 0)}</span>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {pgcr.entries.map((entry: PGCRPlayer, idx: number) => {
                    const isCompleted = entry.values.completed.basic.value === 1;
                    const emblem = getBungieImage(entry.player.destinyUserInfo.iconPath);
                    const background = getBungieImage(entry.player.emblemBackgroundPath);
                    
                    const kills = entry.values.kills.basic.value;
                    const deaths = entry.values.deaths.basic.value;
                    const assists = entry.values.assists.basic.value;
                    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills;
                    const duration = entry.values.activityDurationSeconds?.basic?.value ?? 0;

                    return (
                        <div key={idx} className="group relative flex flex-col gap-1 p-2 bg-slate-800/30 rounded border border-white/5 text-xs overflow-hidden transition-colors hover:bg-slate-800/50">
                             {/* Hover Ambient Glow (Similar to ClanMemberCard) */}
                            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                                 <img 
                                    src={background || emblem} 
                                    alt="" 
                                    className="w-full h-full object-cover blur-sm opacity-30 mask-image-linear-to-r" 
                                />
                                <div className="absolute inset-0 bg-linear-to-r from-[#161b22] via-[#161b22]/80 to-transparent" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded overflow-hidden bg-slate-700 shrink-0 border border-white/10">
                                        <img src={emblem} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0 font-bold text-white truncate text-[11px] drop-shadow-md">
                                        {entry.player.destinyUserInfo.displayName}
                                    </div>
                                    <span className={cn("text-[10px] font-bold uppercase drop-shadow-md", isCompleted ? "text-green-400" : "text-red-400")}>
                                        {isCompleted ? "Cleared" : "DNF"}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-5 gap-1 text-[10px] text-center mt-1 bg-black/40 rounded p-1 backdrop-blur-sm border border-white/5">
                                    <div>
                                        <div className="text-slate-400 mb-0.5">K</div>
                                        <div className="text-white font-mono">{kills}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 mb-0.5">D</div>
                                        <div className="text-white font-mono">{deaths}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 mb-0.5">A</div>
                                        <div className="text-white font-mono">{assists}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 mb-0.5">KD</div>
                                        <div className="text-destiny-gold font-mono">{kd}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 mb-0.5">Time</div>
                                        <div className="text-slate-300 font-mono">{formatDuration(duration)}</div>
                                    </div>
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
    onSelectRun, // We will ignore this prop for internal flipping now, or use it if passed
    characterIds,
    characterClasses,
    className 
}: ActivityReportCardProps) {
    // Local state for flipping
    const [viewMode, setViewMode] = useState<'FRONT' | 'ADVANCED' | 'PGCR'>('FRONT');
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    
    const isFlipped = viewMode !== 'FRONT';

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

    const handleAdvancedClick = () => {
        setViewMode('ADVANCED');
    };

    const handleRunClick = (instanceId: string) => {
        setSelectedInstanceId(instanceId);
        setViewMode('PGCR');
    };

    const handleBack = () => {
        setViewMode('FRONT');
        setSelectedInstanceId(null);
    };

    return (
        <div className={cn(
            "group/card relative flex flex-col rounded-xl border border-white/10 bg-[#161b22] text-white shadow-xl transition-all hover:border-white/30 hover:shadow-2xl min-h-[400px]",
            className
        )} style={{ perspective: '1000px' }}>
            <div className={cn(
                "relative w-full h-full transition-transform duration-500 transform-style-3d",
                isFlipped ? "rotate-y-180" : ""
            )}>
                {/* FRONT */}
                <div className={cn(
                    "w-full h-full backface-hidden flex flex-col transition-opacity duration-200",
                    isFlipped ? "opacity-0 pointer-events-none delay-150" : "opacity-100 delay-150"
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
                        <div className="absolute bottom-3 left-4 z-10 pr-12">
                            <h3 className="text-2xl font-bold text-white drop-shadow-md tracking-wide">{name}</h3>
                        </div>

                        {/* Advanced Stats Button (Bottom Right of Image) */}
                        <button 
                            onClick={handleAdvancedClick}
                            className="absolute bottom-3 right-3 z-30 p-2 bg-black/60 hover:bg-destiny-gold/20 backdrop-blur rounded-full border border-white/20 hover:border-destiny-gold transition-all group/btn"
                            title="View Advanced Stats"
                        >
                            <BarChart2 className="w-5 h-5 text-slate-300 group-hover/btn:text-destiny-gold" />
                        </button>

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
                                 <ActivityStats 
                                    activity={activity} 
                                    history={activityHistory} 
                                    onSelectRun={handleRunClick} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* BACK */}
                <div className="absolute inset-0 h-full w-full backface-hidden rotate-y-180 rounded-xl overflow-hidden bg-[#161b22] border border-white/10 shadow-xl">
                    {viewMode === 'ADVANCED' && (
                        <AdvancedStats 
                            activity={activity}
                            history={activityHistory}
                            onBack={handleBack}
                        />
                    )}
                    {viewMode === 'PGCR' && selectedInstanceId && (
                        <CardBack 
                            instanceId={selectedInstanceId} 
                            onBack={handleBack} 
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
