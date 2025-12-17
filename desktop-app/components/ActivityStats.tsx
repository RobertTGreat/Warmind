import { ActivityDefinition } from "@/lib/activityDefinitions";
import { ActivityHistoryItem } from "@/hooks/useActivityHistory";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getInvalidInstanceIds, addInvalidInstanceId, purgeInvalidInstancesFromCache } from "@/lib/activityCache";
import { fetchPGCR as shimFetchPGCR } from '@/desktop-app/lib/api-shim';

// Track which instances we've already checked
const checkedInstances = new Set<string>();

interface ActivityStatsProps {
    activity: ActivityDefinition;
    history: ActivityHistoryItem[];
    onSelectRun: (instanceId: string) => void;
    isFlawless?: boolean;
    isMasterCompleted?: boolean;
    isDayOneCompleted?: boolean;
    isEpicCompleted?: boolean;
    weekOneCompletion?: { completed: boolean; date?: Date; instanceId?: string } | null;
    onMarkInvalid?: (instanceId: string) => void;
}

export function ActivityStats({ activity, history, onSelectRun, isFlawless, isMasterCompleted, isDayOneCompleted, isEpicCompleted, weekOneCompletion, onMarkInvalid }: ActivityStatsProps) {
    // Local state for invalid instances discovered during background checks
    const [localInvalidIds, setLocalInvalidIds] = useState<Set<string>>(new Set());
    
    // Load invalid IDs on mount
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const ids = await getInvalidInstanceIds();
                if (!mounted) return;

                if (ids instanceof Set) {
                    setLocalInvalidIds(ids);
                } else if (Array.isArray(ids)) {
                    setLocalInvalidIds(new Set(ids));
                } else {
                    console.warn("Invalid IDs returned unknown type:", ids);
                    setLocalInvalidIds(new Set());
                }
            } catch (e) {
                console.error("Failed to load invalid instance IDs", e);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);
    
    // Filter history for this specific activity (matching primary hash OR any related hashes)
    // Also filter out known invalid instances
    const activityRuns = useMemo(() => {
        // Paranoid safety check: Create a local safe copy of the set
        // This avoids any issues with state mutations or invalid objects
        const safeInvalidSet = new Set<string>();
        
        try {
            if (localInvalidIds && typeof (localInvalidIds as any).has === 'function') {
                // It looks like a Set, copy its values
                (localInvalidIds as Set<string>).forEach(id => safeInvalidSet.add(id));
            } else if (Array.isArray(localInvalidIds)) {
                // Handle array case just in case
                (localInvalidIds as string[]).forEach(id => safeInvalidSet.add(id));
            }
        } catch (e) {
            console.error("Error processing localInvalidIds in memo:", e);
        }
        
        return history.filter(h => 
            (h.activityDetails.referenceId === activity.activityHash || 
            activity.relatedActivityHashes?.includes(h.activityDetails.referenceId)) &&
            !safeInvalidSet.has(h.activityDetails.instanceId)
        );
    }, [history, activity, localInvalidIds]);
    
    // Background check for solo DNFs in failed runs
    useEffect(() => {
        const failedRuns = activityRuns.filter(h => h.values.completed.basic.value === 0);
        
        // Check failed runs for solo DNFs (batch with small delay to avoid rate limiting)
        const checkRuns = async () => {
            const invalidSet = (localInvalidIds instanceof Set) ? localInvalidIds : new Set<string>();
            for (const run of failedRuns) {
                const instanceId = run.activityDetails.instanceId;
                
                // Skip if already checked or already known invalid
                if (checkedInstances.has(instanceId) || invalidSet.has(instanceId)) {
                    continue;
                }
                
                checkedInstances.add(instanceId);
                
                try {
                    // Use server proxy (required due to CORS restrictions on Bungie's PGCR endpoint)
                    const data = await shimFetchPGCR(instanceId);
                    const pgcr = data.Response;
                    
                    if (pgcr) {
                        const playerCount = pgcr.entries?.length || 0;
                        const isCompleted = pgcr.entries?.some((e: any) => e.values.completed.basic.value === 1) || false;
                        const isSoloFailed = playerCount === 1 && !isCompleted;
                        const hasTooManyPlayers = playerCount > 15;
                        
                        if (isSoloFailed || hasTooManyPlayers) {
                            addInvalidInstanceId(instanceId);
                            setLocalInvalidIds(prev => {
                                const prevSet = (prev instanceof Set) ? prev : new Set<string>();
                                return new Set([...prevSet, instanceId]);
                            });
                            // Purge from IndexedDB cache as well
                            purgeInvalidInstancesFromCache();
                            if (onMarkInvalid) {
                                onMarkInvalid(instanceId);
                            }
                        }
                    }
                } catch (error) {
                    // Ignore fetch errors, will try again next time
                }
                
                // Small delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        };
        
        checkRuns();
    }, [activityRuns.length]); // Re-run when runs change
    
    // Navigation state for paginating through runs
    const [runOffset, setRunOffset] = useState(0);
    const RUNS_PER_PAGE = 20;
    
    const completedRuns = activityRuns.filter(h => h.values.completed.basic.value === 1);
    const totalClears = completedRuns.length;

    // Stats Calculation
    let totalKills = 0;
    let totalDeaths = 0;
    let totalSeconds = 0;
    let fastestSeconds = Infinity;
    let totalDurationForAvg = 0;

    activityRuns.forEach(run => {
        totalKills += run.values.kills.basic.value;
        totalDeaths += run.values.deaths.basic.value;
        const duration = run.values.activityDurationSeconds.basic.value;
        
        // Only count full clears (completed runs) for time calculations
        if (run.values.completed.basic.value === 1) {
            totalSeconds += duration; // Only count completed runs for total time
            totalDurationForAvg += duration;
            // Fastest run: only consider full clears
            if (duration < fastestSeconds) {
                fastestSeconds = duration;
            }
        }
    });

    const averageDuration = completedRuns.length > 0 ? totalDurationForAvg / completedRuns.length : 0;

    const formatTime = (seconds: number) => {
        if (seconds === Infinity || seconds === 0) return "--";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`;
    };

    // Recent Runs with pagination
    const maxOffset = Math.max(0, activityRuns.length - RUNS_PER_PAGE);
    const currentOffset = Math.min(runOffset, maxOffset);
    const recentRuns = activityRuns.slice(currentOffset, currentOffset + RUNS_PER_PAGE);
    const canGoBack = currentOffset < maxOffset;
    const canGoForward = currentOffset > 0;
    
    const handleBack = () => {
        setRunOffset(prev => Math.min(prev + RUNS_PER_PAGE, maxOffset));
    };
    
    const handleForward = () => {
        setRunOffset(prev => Math.max(prev - RUNS_PER_PAGE, 0));
    };

    return (
        <div className="mt-4 space-y-6">

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Clears</div>
                    <div className="text-2xl font-bold text-white tabular-nums">{totalClears}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Fastest</div>
                    <div className="text-lg font-bold text-white tabular-nums">{formatTime(fastestSeconds)}</div>
                </div>
                 <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Average</div>
                    <div className="text-lg font-bold text-white tabular-nums">{formatTime(averageDuration)}</div>
                </div>
                 <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Total Time</div>
                    <div className="text-lg font-bold text-white tabular-nums">{formatTime(totalSeconds)}</div>
                </div>
            </div>

            {/* Recent Runs Graph */}
            <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Recent History</span>
                    
                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBack}
                            disabled={!canGoBack}
                            className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded transition-all text-[10px] font-medium",
                                canGoBack
                                    ? " hover:scale-120 text-white"
                                    : " text-slate-600"
                            )}
                            title="View older runs"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Older</span>
                        </button>
                        <button
                            onClick={handleForward}
                            disabled={!canGoForward}
                            className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded transition-all text-[10px] font-medium",
                                canGoForward
                                    ? " hover:scale-120 text-white"
                                    : " text-slate-600"
                            )}
                            title="View newer runs"
                        >
                            <span>Newer</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Faster ↓</span>
                </div>

                {recentRuns.length === 0 ? (
                    <div className="text-slate-600 text-sm italic text-center py-4">No recent runs found.</div>
                ) : (
                    <div className="relative h-32 w-full flex items-center">
                        {/* Center Line (Average) */}
                        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10 z-0"></div>
                        
                        <div className="relative z-10 flex justify-between w-full h-full px-2">
                            {/* Since recentRuns is sorted Newest -> Oldest (0 -> 19), usually graphs go Oldest -> Newest (Left -> Right).
                                So we should reverse it for display.
                            */}
                            {[...recentRuns].reverse().map((run) => {
                                const isCompleted = run.values.completed.basic.value === 1;
                                const duration = run.values.activityDurationSeconds.basic.value;
                                
                                // Calculate offset from average
                                let yPos = 50; // Default center
                                if (isCompleted && averageDuration > 0) {
                                    const diff = duration - averageDuration;
                                    const percentDiff = diff / averageDuration; // e.g. +0.5 for 50% slower
                                    yPos = 50 - (percentDiff * 40);
                                    yPos = Math.max(10, Math.min(90, yPos));
                                } else if (!isCompleted && averageDuration > 0) {
                                    const diff = duration - averageDuration;
                                    const percentDiff = diff / averageDuration;
                                    yPos = 50 - (percentDiff * 40);
                                    yPos = Math.max(10, Math.min(90, yPos));
                                }

                                const kills = run.values.kills.basic.value;
                                const deaths = run.values.deaths.basic.value;
                                const assists = run.values.assists.basic.value;
                                const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills;

                                const tooltipTime = formatTime(duration);
                                const tooltipDate = format(new Date(run.period), 'MMM d');

                                return (
                                    <div key={run.activityDetails.instanceId} className="h-full flex flex-col justify-center relative group w-full items-center">
                                        {/* The Dot - Increased size */}
                                        <button
                                            onClick={() => onSelectRun(run.activityDetails.instanceId)}
                                            style={{ top: `${yPos}%`, position: 'absolute' }}
                                            className={cn(
                                                "w-3.5 h-3.5 rounded-full transition-all hover:scale-150 hover:z-50 shadow-lg border border-black/50",
                                                isCompleted 
                                                    ? (duration < averageDuration ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-green-600") 
                                                    : "bg-red-500"
                                            )}
                                        >
                                            <span className="sr-only">View Run</span>
                                        </button>

                                        {/* Connector Line to Center */}
                                        <div 
                                            className={cn("w-px bg-white/5 absolute left-1/2 -translate-x-1/2", 
                                                yPos > 50 ? "top-1/2" : "bottom-1/2"
                                            )}
                                            style={{ 
                                                height: `${Math.abs(yPos - 50)}%`,
                                                top: yPos > 50 ? '50%' : 'auto',
                                                bottom: yPos <= 50 ? '50%' : 'auto'
                                            }} 
                                        />

                                        {/* Tooltip - Increased Size */}
                                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                            <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white whitespace-nowrap shadow-xl flex flex-col gap-1 min-w-[140px]">
                                                <span className={cn("font-bold text-sm", isCompleted ? "text-green-400" : "text-red-400")}>
                                                    {isCompleted ? "Cleared" : "Failed"}
                                                </span>
                                                <span className="text-slate-300 font-mono">{tooltipTime}</span>
                                                
                                                {/* KDA Stats */}
                                                <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-1 mt-1">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] text-slate-500">K</span>
                                                        <span className="font-bold text-white">{kills}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] text-slate-500">D</span>
                                                        <span className="font-bold text-white">{deaths}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] text-slate-500">A</span>
                                                        <span className="font-bold text-white">{assists}</span>
                                                    </div>
                                                </div>
                                                <div className="text-center text-[10px] text-slate-400 mt-0.5">
                                                    K/D: <span className="text-destiny-gold font-bold">{kd}</span>
                                                </div>

                                                <span className="text-slate-500 text-[10px] uppercase tracking-wider mt-1">{tooltipDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
