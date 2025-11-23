import { ActivityDefinition } from "@/lib/activityDefinitions";
import { ActivityHistoryItem } from "@/hooks/useActivityHistory";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo } from "react";

interface ActivityStatsProps {
    activity: ActivityDefinition;
    history: ActivityHistoryItem[];
    onSelectRun: (instanceId: string) => void;
}

export function ActivityStats({ activity, history, onSelectRun }: ActivityStatsProps) {
    // Filter history for this specific activity (matching primary hash OR any related hashes)
    const activityRuns = useMemo(() => history.filter(h => 
        h.activityDetails.referenceId === activity.activityHash || 
        activity.relatedActivityHashes?.includes(h.activityDetails.referenceId)
    ), [history, activity]);
    
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
        totalSeconds += duration;
        
        if (run.values.completed.basic.value === 1) {
            totalDurationForAvg += duration;
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

    // Recent Runs (Last 20)
    const recentRuns = activityRuns.slice(0, 20); // Newest first (index 0 is newest)

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
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest mb-4">
                    <span>Recent History</span>
                    <span>Faster ↓</span>
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
                                            <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white whitespace-nowrap shadow-xl flex flex-col gap-1 min-w-[100px]">
                                                <span className={cn("font-bold text-sm", isCompleted ? "text-green-400" : "text-red-400")}>
                                                    {isCompleted ? "Cleared" : "Failed"}
                                                </span>
                                                <span className="text-slate-300 font-mono">{tooltipTime}</span>
                                                <span className="text-slate-500 text-[10px] uppercase tracking-wider">{tooltipDate}</span>
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
