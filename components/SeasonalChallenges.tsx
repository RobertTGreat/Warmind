import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FrostedCard } from './FrostedCard';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface SeasonalChallengesProps {
    seasonHash?: number;
    profile?: any; // Full profile response to check record states
}

export function SeasonalChallenges({ seasonHash, profile }: SeasonalChallengesProps) {
    // 1. Get Season Definition
    const { data: seasonDefData } = useSWR(
        seasonHash ? endpoints.getSeasonDefinition(seasonHash) : null,
        fetcher
    );
    const seasonDef = seasonDefData?.Response;
    const challengesHash = seasonDef?.seasonalChallengesPresentationNodeHash;

    // 2. Get Challenges Presentation Node
    const { data: nodeData } = useSWR(
        challengesHash ? endpoints.getPresentationNodeDefinition(challengesHash) : null,
        fetcher
    );
    const challengesNode = nodeData?.Response;

    // 3. Get Child Nodes (Weeks) - Just get the first one or "current" one for now
    // Usually the last unlocked one is current week.
    // For now, let's just take the first 3 children (Week 1, 2, 3) or just the first one.
    const activeWeekHash = challengesNode?.children?.presentationNodes?.[0]?.presentationNodeHash;

    // 4. Get Week Node Definition
    const { data: weekNodeData } = useSWR(
        activeWeekHash ? endpoints.getPresentationNodeDefinition(activeWeekHash) : null,
        fetcher
    );
    const weekNode = weekNodeData?.Response;

    if (!weekNode) return <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;

    // 5. Render Challenges from this week
    // Limit to first 3 for dashboard
    const recordsToShow = weekNode.children.records.slice(0, 3);

    return (
        <div className="space-y-3">
             <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                    {weekNode.displayProperties.name}
                </h4>
                <span className="text-xs text-destiny-gold">Active Week</span>
             </div>
             <div className="space-y-2">
                 {recordsToShow.map((child: any) => (
                     <ChallengeRecord 
                        key={child.recordHash} 
                        recordHash={child.recordHash} 
                        profile={profile}
                     />
                 ))}
             </div>
        </div>
    );
}

function ChallengeRecord({ recordHash, profile }: { recordHash: number, profile: any }) {
    const { data: recordDefData } = useSWR(
        recordHash ? endpoints.getRecordDefinition(recordHash) : null,
        fetcher
    );
    const recordDef = recordDefData?.Response;

    if (!recordDef) return <div className="h-10 bg-white/5 animate-pulse rounded-sm" />;

    // Check completion status
    // Records can be in profileRecords or characterRecords. Seasonal challenges are usually profile-wide.
    const recordState = profile?.profileRecords?.data?.records?.[recordHash] || 
                        profile?.characterRecords?.data?.[Object.keys(profile?.characterRecords?.data || {})[0]]?.records?.[recordHash];
    
    // State 1 = Completed (RecordState.RecordRedeemed is 4)
    // Actually bitmask. 1 = CanEquipTitle, 2 = ObjectiveNotCompleted, 4 = Redeemed, etc.
    // We care if objectives are completed.
    // If ! (state & 4) and ! (state & 1) ...
    // Simplest check: Check objectives progress.

    const isCompleted = recordState ? !recordState.objectives?.some((obj: any) => !obj.complete) : false;

    return (
        <div className="flex items-center gap-3 p-2 bg-white/5 rounded-sm border border-white/5 relative overflow-hidden group hover:bg-white/10 transition-colors">
            <div className="w-8 h-8 bg-slate-800 rounded flex-shrink-0 border border-white/10 overflow-hidden">
                <img src={getBungieImage(recordDef.displayProperties.icon)} alt="" className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="space-y-1 min-w-0 flex-1 z-10">
                <div className="flex justify-between">
                    <span className={cn("text-sm font-medium truncate", isCompleted ? "text-green-400" : "text-slate-200")}>
                        {recordDef.displayProperties.name}
                    </span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                    {recordDef.displayProperties.description}
                </div>
            </div>
            {isCompleted && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Star className="w-4 h-4 text-destiny-gold fill-current" />
                </div>
            )}
        </div>
    );
}

