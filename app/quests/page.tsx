'use client';

import dynamic from 'next/dynamic';
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { loginWithBungie } from "@/lib/bungie";
import { Loader2, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { cn } from "@/lib/utils";

// Lazy load heavy components
const DestinyItemCard = dynamic(
  () => import("@/components/DestinyItemCard").then((mod) => mod.DestinyItemCard),
  { ssr: false }
);

const QuestItemCard = dynamic(
  () => import("@/components/QuestItemCard").then((mod) => mod.QuestItemCard),
  { ssr: false, loading: () => <div className="h-24 animate-pulse bg-white/5 rounded" /> }
);

type FilterType = 'All' | 'Exotic' | 'New Light' | 'Seasonal';

export default function QuestsPage() {
  const { profile, stats, isLoading, isLoggedIn } = useDestinyProfile();
  const characterId = stats?.characterId;
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  // 1. Gather all items
  const allInventoryItems = useMemo(() => {
      if (!profile || !characterId) return [];
      return profile.characterInventories?.data?.[characterId]?.items || [];
  }, [profile, characterId]);

  // 2. Get hashes
  const itemHashes = useMemo(() => allInventoryItems.map((i: any) => i.itemHash), [allInventoryItems]);
  const { definitions, isLoading: defsLoading } = useItemDefinitions(itemHashes);

  // 3. Filter and Group
  const { quests, bounties, trackedQuests, trackedBounties } = useMemo(() => {
    if (!profile || !characterId || defsLoading) return { quests: [], bounties: [], trackedQuests: [], trackedBounties: [] };

    const questsList: any[] = [];
    const bountiesList: any[] = [];
    const trackedQuestsList: any[] = [];
    const trackedBountiesList: any[] = [];

    for (const item of allInventoryItems) {
        const def = definitions[item.itemHash];
        if (!def) continue;

        // Skip Finishers
        const typeName = def.itemTypeDisplayName?.toLowerCase() || "";
        if (typeName.includes("finisher")) continue;

        const isTracked = (item.state & 2) === 2;
        
        // Categorize
        const isQuest = def.itemType === 12 || def.itemType === 29;
        const isBounty = def.itemType === 26;

        const data = { item, def };

        if (isBounty) {
            if (isTracked) trackedBountiesList.push(data);
            else bountiesList.push(data);
        } else if (isQuest) {
            // Apply Filter to Quests ONLY
            let matchesFilter = true;
            if (activeFilter === 'Exotic') {
                matchesFilter = def.inventory?.tierTypeName === 'Exotic';
            } else if (activeFilter === 'New Light') {
                // Heuristic for New Light / Main Quest
                matchesFilter = typeName.includes("main quest") || def.displayProperties?.name?.includes("New Light");
            } else if (activeFilter === 'Seasonal') {
                 // Heuristic: Seasonal quests often have expiration or specific watermarks
                 matchesFilter = !!(def.iconWatermark || def.iconWatermarkShelved);
            }

            if (matchesFilter) {
                if (isTracked) trackedQuestsList.push(data);
                else questsList.push(data);
            }
        }
    }

    return { 
        quests: questsList, 
        bounties: bountiesList, 
        trackedQuests: trackedQuestsList,
        trackedBounties: trackedBountiesList
    };
  }, [allInventoryItems, definitions, defsLoading, profile, characterId, activeFilter]);

  // Helper
  const getObjectives = (itemInstanceId: string) => {
      return profile?.itemComponents?.objectives?.data?.[itemInstanceId]?.objectives || [];
  };

  if (isLoading || (isLoggedIn && defsLoading && itemHashes.length > 0)) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
      );
  }

  if (!isLoggedIn) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4">
              <h2 className="text-xl font-bold">Sign in to view your Quests</h2>
              <button 
                  onClick={loginWithBungie}
                  className="bg-destiny-gold text-black px-6 py-2 rounded font-bold hover:bg-yellow-500 transition-colors"
              >
                  Login with Bungie
              </button>
          </div>
      );
  }

  const FilterButton = ({ type, label }: { type: FilterType, label: string }) => (
      <button
          onClick={() => setActiveFilter(type)}
          className={cn(
              "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm border transition-all w-full text-left",
              activeFilter === type 
                  ? "bg-destiny-gold text-black border-destiny-gold" 
                  : "bg-slate-900/50 text-slate-400 border-white/10 hover:border-white/30 hover:text-white"
          )}
      >
          {label}
      </button>
  );

  return (
    <div className="pb-20 animate-in fade-in duration-500">
      <div className="mb-8 border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 p-6">
         <div>
             <h1 className="text-xl font-bold uppercase tracking-wide text-white">Quests</h1>
         </div>
      </div>

      <div className="p-6 max-w-[1800px] mx-auto">
        <div className="flex flex-col xl:flex-row gap-8 items-start">
            
            {/* LEFT COLUMN: QUESTS (Grow) */}
            <div className="flex-1 w-full space-y-8">
                
                {/* Tracked Quests */}
                {trackedQuests.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold mb-4 text-destiny-gold uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-destiny-gold rounded-full animate-pulse"/> Tracked Quests
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {trackedQuests.map(({ item, def }: any, idx: number) => (
                                <QuestItemCard 
                                    key={item.itemInstanceId || `${item.itemHash}-${idx}`}
                                    itemHash={item.itemHash}
                                    instanceData={item}
                                    definition={def}
                                    objectives={getObjectives(item.itemInstanceId)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* All Quests */}
                <section>
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest">
                            {activeFilter === 'All' ? 'Active Quests' : `${activeFilter} Quests`}
                        </h2>
                        <span className="text-sm text-gray-400">{quests.length + trackedQuests.length} Total</span>
                    </div>

                    {quests.length === 0 && trackedQuests.length === 0 ? (
                        <div className="text-gray-500 italic p-8 border border-dashed border-gray-800 rounded text-center">
                            {activeFilter === 'All' 
                                ? "No active quests. Time to visit the Tower?" 
                                : `No ${activeFilter} quests found.`}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {quests.map(({ item, def }: any, idx: number) => (
                                <QuestItemCard 
                                    key={item.itemInstanceId || `${item.itemHash}-${idx}`}
                                    itemHash={item.itemHash}
                                    instanceData={item}
                                    definition={def}
                                    objectives={getObjectives(item.itemInstanceId)}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>


            {/* RIGHT COLUMN: BOUNTIES & FILTERS (Fixed Width - Smaller) */}
            <div className="w-full xl:w-[300px] shrink-0 space-y-8 sticky top-6">
                
                {/* Tracked Bounties */}
                {trackedBounties.length > 0 && (
                    <section>
                         <h2 className="text-xl font-bold mb-4 text-destiny-gold uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-destiny-gold rounded-full animate-pulse"/> Tracked
                        </h2>
                        <div className="grid grid-cols-3 gap-1.5">
                            {trackedBounties.map(({ item, def }: any, idx: number) => (
                                <DestinyItemCard 
                                    key={item.itemInstanceId || `${item.itemHash}-${idx}`}
                                    itemHash={item.itemHash}
                                    itemInstanceId={item.itemInstanceId}
                                    instanceData={item}
                                    ownerId={characterId}
                                    quantity={item.quantity > 1 ? item.quantity : undefined}
                                    objectives={getObjectives(item.itemInstanceId)}
                                    definition={def}
                                    className="h-auto aspect-square text-[10px]" 
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* All Bounties */}
                <section>
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest">
                            Bounties
                        </h2>
                        <span className="text-sm text-gray-400">{bounties.length + trackedBounties.length}</span>
                    </div>
                    
                    {bounties.length === 0 && trackedBounties.length === 0 ? (
                        <div className="text-gray-500 italic p-4 border border-dashed border-gray-800 rounded text-center">
                            No bounties.
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                            {bounties.map(({ item, def }: any, idx: number) => (
                                <DestinyItemCard 
                                    key={item.itemInstanceId || `${item.itemHash}-${idx}`}
                                    itemHash={item.itemHash}
                                    itemInstanceId={item.itemInstanceId}
                                    instanceData={item}
                                    ownerId={characterId}
                                    quantity={item.quantity > 1 ? item.quantity : undefined}
                                    objectives={getObjectives(item.itemInstanceId)}
                                    definition={def}
                                    className="h-auto aspect-square"
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* FILTERS SECTION (Below Bounties) */}
                <section>
                    <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2 text-slate-400">
                        <Filter className="w-4 h-4" />
                        <h2 className="text-sm font-bold uppercase tracking-widest">
                            Quest Filters
                        </h2>
                    </div>
                    <div className="space-y-2">
                        <FilterButton type="All" label="All Quests" />
                        <FilterButton type="Exotic" label="Exotic" />
                        <FilterButton type="Seasonal" label="Seasonal" />
                        <FilterButton type="New Light" label="New Light / Main" />
                    </div>
                </section>

            </div>

        </div>
      </div>
    </div>
  );
}
