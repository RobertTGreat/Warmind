import { usePGCR, PGCRPlayer } from "@/hooks/useActivityHistory";
import { getBungieImage } from "@/lib/bungie";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PGCRViewer({ instanceId, onClose }: { instanceId: string | null; onClose: () => void }) {
    const { pgcr, isLoading, isError } = usePGCR(instanceId);

    if (!instanceId) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
                    <h2 className="text-xl font-bold text-white">Activity Report</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                         <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-destiny-gold" />
                        </div>
                    ) : isError ? (
                        <div className="text-center text-red-400 p-8">
                            Failed to load activity report.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Activity Info */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex-1">
                                     <h3 className="text-2xl font-bold text-white">
                                        {pgcr.activityDetails.mode === 4 ? "Raid" : "Dungeon"} Completion
                                     </h3>
                                     <p className="text-slate-400">
                                        {new Date(pgcr.period).toLocaleString()}
                                     </p>
                                </div>
                            </div>

                            {/* Teams / Players */}
                            <div className="grid gap-2">
                                {pgcr.entries.map((entry: PGCRPlayer, idx: number) => {
                                    const isCompleted = entry.values.completed.basic.value === 1;
                                    const emblem = getBungieImage(entry.player.destinyUserInfo.iconPath);
                                    
                                    return (
                                        <div key={idx} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-white/5">
                                            {/* Emblem */}
                                            <div className="w-10 h-10 rounded overflow-hidden bg-slate-700">
                                                <img src={emblem} alt="" className="w-full h-full object-cover" />
                                            </div>

                                            {/* Name & Class */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white truncate">
                                                        {entry.player.destinyUserInfo.displayName}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {entry.player.characterClass}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {entry.player.lightLevel} Power
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="flex items-center gap-6 text-right text-sm">
                                                <div>
                                                    <div className="text-slate-400 text-xs uppercase">Kills</div>
                                                    <div className="font-mono text-white">{entry.values.kills.basic.displayValue}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-400 text-xs uppercase">Deaths</div>
                                                    <div className="font-mono text-white">{entry.values.deaths.basic.displayValue}</div>
                                                </div>
                                                <div>
                                                    <div className="text-slate-400 text-xs uppercase">Assists</div>
                                                    <div className="font-mono text-white">{entry.values.assists.basic.displayValue}</div>
                                                </div>
                                                <div className="w-24 flex justify-end">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded text-xs font-bold uppercase",
                                                        isCompleted ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                    )}>
                                                        {isCompleted ? "Completed" : "DNF"}
                                                    </span>
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
        </div>
    );
}

