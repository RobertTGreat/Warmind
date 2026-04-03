'use client';

import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { Loader2, Star, Swords, Crosshair, Shield } from 'lucide-react';
import { RewardItem } from './RewardItem';
import { ScrollingText } from '@/components/ScrollingText';
import { PretextLineClamp } from '@/components/PretextLineClamp';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

export function WeeklyMilestones() {
    const { data: milestonesData } = useSWR(
        endpoints.getPublicMilestones(),
        fetcher
    );
    const milestones = milestonesData?.Response;

    if (!milestones) return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;

    // Filter for "Weekly" rituals which are usually:
    // 1. Core Playlists (Vanguard, Crucible, Gambit)
    // 2. Seasonal Activity Weekly
    // 3. Featured Raid/Dungeon
    
    // To make it look like a "Reward Track", we'll display them horizontally or in a focused grid.
    // Since true linear track doesn't exist, we present it as "Weekly Challenges" with Edge of Fate rewards.

    const activeMilestones = Object.values(milestones).filter((m: any) => {
        return (m.activities && m.activities.length > 0) || (m.availableQuests && m.availableQuests.length > 0);
    }).slice(0, 4); // Limit to 4 for "Track" feel

    return (
        <div className="space-y-4">
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
                {activeMilestones.map((m: any) => (
                    <div key={m.milestoneHash} className="snap-start shrink-0 w-full md:w-[calc(50%-8px)] xl:w-[calc(33%-8px)]">
                        <MilestoneCard milestone={m} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function MilestoneCard({ milestone }: { milestone: any }) {
    const { data: defData } = useSWR(
        endpoints.getMilestoneDefinition(milestone.milestoneHash),
        fetcher
    );
    const def = defData?.Response;

    if (!def) return <div className="h-32 bg-white/5 animate-pulse rounded-sm" />;
    if (!def.displayProperties?.name) return null;

    const icon = def.displayProperties.icon || def.quests?.[Object.keys(def.quests)[0]]?.displayProperties?.icon;

    // Attempt to find rewards
    // Milestones have rewards in `rewards` (if activity based) or `quests` (if quest based)
    let rewardItems: any[] = [];
    
    if (milestone.rewards) {
        milestone.rewards.forEach((cat: any) => {
             const catDef = def.rewards?.[cat.rewardCategoryHash];
             if (catDef) {
                 Object.keys(catDef.rewardEntries).forEach(entryHash => {
                     const entry = catDef.rewardEntries[entryHash];
                     // Reward entries usually link to items, but API structure here is complex.
                     // Often they just list "Powerful Gear".
                     // However, we can try to map known hashes or just show a generic "Engram" if we can't find specific items.
                     if (entry.items && entry.items.length > 0) {
                         rewardItems.push(...entry.items);
                     }
                 });
             }
        });
    }
    
    // If no specific items found, check for "Pinnacle/Powerful" text and show generic engram
    if (rewardItems.length === 0) {
        // Generic Pinnacle Hash: 73143230 (Pinnacle Gear) - checking common hashes
        // We'll just show a placeholder if we detect the text
        const description = def.displayProperties.description || "";
        if (description.includes("Pinnacle")) {
             rewardItems.push({ itemHash: 73143230 }); // Pinnacle Engram (Example hash)
        } else if (description.includes("Powerful")) {
             rewardItems.push({ itemHash: 4039143015 }); // Powerful Engram
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-900/40 border border-white/5 rounded-sm hover:bg-gray-800/60 transition-all group relative overflow-hidden">
             <div className="p-4 flex gap-4 items-start z-10">
                 <div className="w-12 h-12 bg-black rounded-sm border border-white/10 overflow-hidden flex-shrink-0 shadow-lg">
                     {icon ? (
                         <img src={getBungieImage(icon)} alt="" className="w-full h-full object-cover" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center bg-white/5">
                             <Star className="w-5 h-5 text-white/20" />
                         </div>
                     )}
                 </div>
                 <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                     <ScrollingText className="text-sm font-bold text-white group-hover:text-destiny-gold transition-colors">
                         {def.displayProperties.name}
                     </ScrollingText>
                     <PretextLineClamp
                         className="text-xs text-slate-400 line-clamp-2"
                         maxLines={2}
                         text={def.displayProperties.description ?? ''}
                     />
                 </div>
             </div>
             
             {/* "Edge of Fate" Reward Footer */}
             <div className="mt-auto border-t border-white/5 bg-black/20 p-3 flex items-center justify-between">
                 <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Rewards</span>
                 <div className="flex -space-x-2">
                     {rewardItems.length > 0 ? (
                         rewardItems.map((reward: any, i: number) => (
                            <div key={i} className="scale-75 origin-right">
                                <RewardItem itemHash={reward.itemHash} showLabel={false} />
                            </div>
                         ))
                     ) : (
                         <span className="text-[10px] text-slate-600 italic">XP Only</span>
                     )}
                 </div>
             </div>
        </div>
    );
}
