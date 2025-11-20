import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { getBungieImage, bungieApi, endpoints, insertSocketPlug } from '@/lib/bungie';
import { BUCKETS } from '@/lib/destinyUtils';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

export function ItemDetailsOverlay() {
  const { detailsItem, setDetailsItem } = useUIStore();
  const { profile, membershipInfo } = useDestinyProfile();

  // Fetch definition for the item
  const { definitions } = useItemDefinitions(detailsItem ? [detailsItem.itemHash] : []);
  const itemDef = definitions[detailsItem?.itemHash || 0];

  if (!detailsItem) return null;

  const instance = profile?.itemComponents?.instances?.data?.[detailsItem.itemInstanceId];
  const sockets = profile?.itemComponents?.sockets?.data?.[detailsItem.itemInstanceId]?.sockets;
  const stats = profile?.itemComponents?.stats?.data?.[detailsItem.itemInstanceId]?.stats;

  const isSubclass = itemDef?.inventory?.bucketTypeHash === BUCKETS.SUBCLASS;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] animate-in fade-in duration-200 flex justify-center items-center p-4 md:p-12">
        <button 
            onClick={() => setDetailsItem(null)}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full z-50 transition-colors"
        >
            <X className="w-8 h-8" />
        </button>

        <div className="w-full max-w-7xl h-full max-h-[90vh] bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl flex flex-col md:flex-row overflow-hidden relative group">
             {/* Background Image (Blurred/Faded) */}
             <div className="absolute inset-0 z-0 opacity-40 pointer-events-none select-none">
                 {itemDef?.screenshot && (
                     <Image 
                        src={getBungieImage(itemDef.screenshot)} 
                        fill 
                        sizes="(max-width: 768px) 100vw, 100vw"
                        className="object-cover" 
                        alt="" 
                     />
                 )}
                 <div className="absolute inset-0 bg-gradient-to-r from-[#1e1e1e] via-[#1e1e1e]/90 to-transparent md:via-[#1e1e1e]/80" />
                 <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-transparent" />
             </div>

             {/* Left Panel: Info & Stats */}
             <div className="relative z-10 w-full md:w-[400px] lg:w-[450px] p-8 flex flex-col gap-6 border-r border-white/5 bg-[#1e1e1e]/80 md:bg-transparent overflow-y-auto md:overflow-visible shrink-0">
                  
                  {/* Header */}
                  <div className="flex gap-5">
                      <div className="w-24 h-24 border-2 border-white/10 rounded-sm overflow-hidden shadow-lg shrink-0 bg-[#2a2a2a] relative">
                          {itemDef?.displayProperties?.icon && (
                              <Image 
                                src={getBungieImage(itemDef.displayProperties.icon)} 
                                fill 
                                sizes="96px"
                                className="object-cover" 
                                alt="" 
                              />
                          )}
                      </div>
                      <div>
                          <h2 className="text-3xl font-bold text-white leading-tight">{itemDef?.displayProperties?.name}</h2>
                          <div className="text-sm text-destiny-gold font-bold uppercase tracking-wider mt-1 flex items-center gap-2">
                              {itemDef?.itemTypeDisplayName}
                              {instance?.primaryStat && (
                                  <span className="bg-white/10 px-2 py-0.5 rounded text-white text-xs">
                                    ♦ {instance.primaryStat.value}
                                  </span>
                              )}
                          </div>
                      </div>
                  </div>
                  
                  {/* Flavor Text */}
                  <div className="text-slate-300 italic text-sm border-l-2 border-white/20 pl-4 py-1 opacity-90">
                      "{itemDef?.flavorText}"
                  </div>

                  {/* Stats Section */}
                  <div className="mt-auto md:mt-8">
                      {isSubclass ? (
                          <SubclassStats stats={stats} itemDef={itemDef} />
                      ) : (
                          <ItemStats stats={stats} itemDef={itemDef} instance={instance} />
                      )}
                  </div>
             </div>

             {/* Right Panel: Sockets / Details */}
             <div className="relative z-10 flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {sockets && (
                      <SocketViewer 
                          sockets={sockets} 
                          itemDef={itemDef} 
                          item={detailsItem}
                          profile={profile}
                          membershipInfo={membershipInfo}
                          isSubclass={isSubclass}
                      />
                  )}
             </div>
        </div>
    </div>
  );
}

// --- Sub-components ---

function ItemStats({ stats, itemDef, instance }: any) {
    // We need to map stat hashes to display info. 
    // Ideally fetch definitions, but for common ones we can try to display raw first.
    // The API returns stats in `stats` object: { [hash]: { value: number } }
    
    // Filter relevant stats based on itemDef.stats.stats
    const relevantStats = useMemo(() => {
        if (!itemDef?.stats?.stats) return [];
        return Object.entries(itemDef.stats.stats).map(([hash, def]: [string, any]) => {
            const liveValue = stats?.[hash]?.value ?? def.value;
            return {
                hash,
                value: liveValue,
                ...def
            };
        }).sort((a, b) => a.index - b.index); // Sort by index if available, or definition order
    }, [itemDef, stats]);

    return (
        <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-lg border border-white/5">
             {/* Masterwork / Tier Info could go here */}
             
             {relevantStats.map((stat: any) => (
                 <StatRow key={stat.hash} statHash={stat.hash} value={stat.value} />
             ))}
             
             {/* Enemies Defeated - tracked in objectives usually or kill tracker plug */}
        </div>
    );
}

function StatRow({ statHash, value }: { statHash: string, value: number }) {
    const { data } = useSWR(endpoints.getStatDefinition(statHash), fetcher);
    const def = data?.Response;

    if (!def) return null;
    // Filter out "Attack" / "Defense" usually shown in header
    if (def.displayProperties.name === "Attack" || def.displayProperties.name === "Defense" || def.displayProperties.name === "Power") return null;

    const isBar = def.displayAsNumeric; // Actually displayAsNumeric usually means NO bar, but let's check aggregationType
    // Most weapon stats are bars.

    return (
        <div className="flex items-center gap-4 text-sm">
            <div className="w-32 text-slate-400 font-medium truncate text-right">{def.displayProperties.name}</div>
            <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-white" 
                        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} 
                    />
                </div>
                <div className="w-8 text-right font-bold text-white">{value}</div>
            </div>
        </div>
    );
}

function SubclassStats({ stats, itemDef }: any) {
    // Subclasses show different stats (Mobility, etc) derived from plugs usually.
    // Or they show nothing in stats block and just rely on the plugs.
    // Placeholder for now.
    return null; 
}

function SocketViewer({ sockets, itemDef, item, profile, membershipInfo, isSubclass }: any) {
    const { definitions: categoryDefs } = useSocketCategoryDefinitions(itemDef?.sockets?.socketCategories?.map((c: any) => c.socketCategoryHash) || []);
    
    // Reusable Plugs (Options)
    const reusablePlugsData = profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs;

    // Gather all plug hashes to fetch definitions
    const allPlugHashes = useMemo(() => {
        const hashes: number[] = [];
        sockets?.forEach((s: any) => {
            if (s.plugHash) hashes.push(s.plugHash);
        });
        return hashes;
    }, [sockets]);

    const { definitions: plugDefs } = useItemDefinitions(allPlugHashes);

    if (!itemDef?.sockets?.socketCategories) return null;

    return (
        <div className="flex flex-col gap-10 pb-20">
            {itemDef.sockets.socketCategories.map((category: any) => {
                const categoryDef = categoryDefs[category.socketCategoryHash];
                // Sort sockets by index provided in category
                const categorySockets = category.socketIndexes.map((idx: number) => ({
                    ...sockets[idx],
                    socketIndex: idx,
                    def: itemDef.sockets.socketEntries[idx],
                    reusablePlugs: reusablePlugsData?.[idx] || [] 
                }));

                if (!categorySockets.length) return null;
                
                return (
                    <div key={category.socketCategoryHash} className="flex flex-col gap-4">
                        <h3 className="text-xl font-bold text-white/90 border-b border-white/10 pb-2 flex items-center gap-2">
                            {categoryDef?.displayProperties?.name || "Other"}
                        </h3>
                        
                        <div className="flex flex-wrap gap-3">
                            {categorySockets.map((socket: any, i: number) => {
                                const plug = plugDefs[socket.plugHash];
                                if (!plug) return null; 

                                if (!socket.isVisible && !plug.itemTypeDisplayName) return null; 

                                return (
                                    <Socket 
                                        key={socket.socketIndex} 
                                        socket={socket} 
                                        plug={plug} 
                                        item={item}
                                        membershipInfo={membershipInfo}
                                        profile={profile}
                                        isSubclass={isSubclass}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Socket({ socket, plug, item, membershipInfo, profile, isSubclass }: any) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Calculate available options hashes
    const optionHashes = useMemo(() => {
        const hashes: number[] = [];
        // 1. Live reusable plugs
        if (socket.reusablePlugs && socket.reusablePlugs.length > 0) {
            socket.reusablePlugs.forEach((p: any) => hashes.push(p.plugItemHash));
        } 
        // 2. Plug Set (Main source for subclasses/crafting)
        else if (socket.def?.reusablePlugSetHash) {
             // We need to fetch the PlugSet definition to get the items.
             // We can't return hashes synchronously here if we don't have the definition yet.
             // We need a side effect or data fetching hook for PlugSets.
             // Since we can't easily do async inside useMemo return, we'll return a special flag or handle it in effect.
             // Actually, better to handle PlugSet logic in a hook or component state.
        }
        // 3. Static definition reusable plugs (fallback or complement)
        else if (socket.def?.reusablePlugItems) {
            socket.def.reusablePlugItems.forEach((p: any) => hashes.push(p.plugItemHash));
        }
        
        // 4. Ensure equipped plug is in the list
        if (socket.plugHash && !hashes.includes(socket.plugHash)) {
            hashes.unshift(socket.plugHash);
        }

        return Array.from(new Set(hashes));
    }, [socket]);

    // We need a way to get PlugSet items if optionHashes is empty but we have a PlugSetHash
    const plugSetHash = socket.def?.reusablePlugSetHash || socket.def?.randomizedPlugSetHash;
    const { plugItems: plugSetItems } = usePlugSetItems(plugSetHash);

    const finalOptionHashes = useMemo(() => {
        let hashes = [...optionHashes];
        if (plugSetItems.length > 0) {
            // Merge plug set items
            hashes = [...hashes, ...plugSetItems];
        }
        // Ensure unique and equipped is present
        if (socket.plugHash && !hashes.includes(socket.plugHash)) {
            hashes.unshift(socket.plugHash);
        }
        return Array.from(new Set(hashes));
    }, [optionHashes, plugSetItems, socket.plugHash]);

    // Always fetch definitions for these options so we can display them inline
    // For subclasses, only fetch if isOpen or if !isSubclass (weapons)
    const shouldFetchOptions = !isSubclass || isOpen;
    const { definitions: optionDefs } = useItemDefinitions(shouldFetchOptions ? finalOptionHashes : []);

    const handleSelectPlug = async (plugItemHash: number, plugName: string) => {
        // ... same as before ...
        if (plugItemHash === socket.plugHash) {
             setIsOpen(false);
             return; 
        }

        if (!membershipInfo) {
            toast.error("You must be logged in to modify items.");
            return;
        }
        
        // Helper to find owner
        let ownerId = item.characterId; 
        if (!ownerId && profile) {
             const charIds = Object.keys(profile.characters?.data || {});
             ownerId = charIds[0]; 
        }

        const promise = insertSocketPlug(
            item.itemInstanceId, 
            plugItemHash, 
            socket.socketIndex, 
            ownerId, 
            membershipInfo.membershipType
        );

        toast.promise(promise, {
            loading: `Applying ${plugName}...`,
            success: `Applied ${plugName}!`,
            error: `Failed to apply ${plugName}`
        });
        
        setIsOpen(false);
    };

    // --- Subclass View: Single Clickable Icon -> Menu ---
    if (isSubclass) {
        return (
            <>
                <button 
                    onClick={() => setIsOpen(true)}
                    className="w-16 h-16 md:w-20 md:h-20 border border-white/20 bg-black/40 hover:bg-white/10 hover:border-white/50 rounded-sm overflow-hidden transition-all flex items-center justify-center relative group/socket z-20"
                    title={plug.displayProperties?.name}
                >
                    {plug.displayProperties?.icon && (
                        <Image 
                            src={getBungieImage(plug.displayProperties.icon)} 
                            fill 
                            sizes="80px"
                            className="object-cover" 
                            alt="" 
                        />
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/socket:opacity-100 transition-opacity flex items-center justify-center text-center p-1 pointer-events-none">
                        <span className="text-[10px] font-bold text-white line-clamp-2">{plug.displayProperties?.name}</span>
                    </div>
                </button>

                {/* Full Screen / Modal Selection Menu for Subclass Options */}
                {isOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-100 p-4">
                         <div className="w-full max-w-4xl max-h-[80vh] bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl flex flex-col overflow-hidden">
                             {/* Header */}
                             <div className="flex justify-between items-center p-6 border-b border-white/10 bg-[#1a1a1a]">
                                 <div>
                                     <h3 className="text-xl font-bold text-white">Select {plug.itemTypeDisplayName || "Option"}</h3>
                                     <p className="text-sm text-slate-400">Choose an option to equip</p>
                                 </div>
                                 <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white">
                                     <X className="w-6 h-6" />
                                 </button>
                             </div>

                             {/* Grid of Options */}
                             <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 scrollbar-thin scrollbar-thumb-white/20">
                                 {finalOptionHashes.map((hash) => {
                                     const def = optionDefs[hash];
                                     if (!def) return <div key={hash} className="aspect-square bg-white/5 animate-pulse rounded-sm" />;
                                     
                                     const isEquipped = hash === socket.plugHash;

                                     return (
                                         <button
                                             key={hash}
                                             onClick={() => handleSelectPlug(hash, def.displayProperties?.name)}
                                             className={cn(
                                                 "aspect-square border rounded-sm overflow-hidden relative group/option flex flex-col items-center justify-center bg-black/40 hover:bg-white/5 transition-all",
                                                 isEquipped ? "border-destiny-gold ring-2 ring-destiny-gold/20" : "border-white/10 hover:border-white/40"
                                             )}
                                         >
                                             <div className="w-16 h-16 mb-2 relative">
                                                {def.displayProperties?.icon && (
                                                    <Image 
                                                        src={getBungieImage(def.displayProperties.icon)} 
                                                        fill 
                                                        sizes="64px"
                                                        className="object-cover" 
                                                        alt="" 
                                                    />
                                                )}
                                             </div>
                                             <div className="text-xs text-center px-2 font-medium text-slate-300 group-hover/option:text-white line-clamp-2">
                                                 {def.displayProperties?.name}
                                             </div>
                                             
                                             {isEquipped && (
                                                 <div className="absolute top-2 right-2 w-2 h-2 bg-destiny-gold rounded-full" />
                                             )}
                                         </button>
                                     );
                                 })}
                             </div>
                         </div>
                    </div>
                )}
            </>
        );
    }

    // --- Weapon/Armor View: Column or Single ---
    // If no options (or just 1 which is equipped), show single icon
        if (finalOptionHashes.length <= 1) {
         return (
            <div className="w-16 h-16 md:w-20 md:h-20 border border-white/10 bg-black/40 rounded-sm overflow-hidden flex items-center justify-center relative group/socket" title={plug.displayProperties?.name}>
                {plug.displayProperties?.icon && (
                    <Image 
                        src={getBungieImage(plug.displayProperties.icon)} 
                        fill 
                        sizes="80px"
                        className="object-cover opacity-80 group-hover/socket:opacity-100 transition-opacity" 
                        alt="" 
                    />
                )}
                 {/* Hover Info */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/socket:opacity-100 transition-opacity flex items-center justify-center text-center p-1 pointer-events-none">
                    <span className="text-[10px] font-bold text-white line-clamp-2">{plug.displayProperties?.name}</span>
                </div>
            </div>
         );
    }

    // Show Column of Options
    return (
        <div className="flex flex-col gap-2">
            {finalOptionHashes.map((hash) => {
                const def = optionDefs[hash];
                if (!def) return <div key={hash} className="w-16 h-16 md:w-20 md:h-20 bg-white/5 animate-pulse rounded-sm" />;
                
                const isEquipped = hash === socket.plugHash;

                return (
                    <button
                        key={hash}
                        onClick={() => handleSelectPlug(hash, def.displayProperties?.name)}
                        className={cn(
                            "w-16 h-16 md:w-20 md:h-20 border rounded-sm overflow-hidden relative group/socket transition-all",
                            isEquipped 
                                ? "border-destiny-gold bg-black/40 opacity-100 ring-2 ring-destiny-gold/20" 
                                : "border-white/10 bg-black/60 opacity-60 hover:opacity-100 hover:border-white/50"
                        )}
                        title={def.displayProperties?.name}
                    >
                        {def.displayProperties?.icon && (
                            <Image 
                                src={getBungieImage(def.displayProperties.icon)} 
                                fill 
                                sizes="80px"
                                className="object-cover" 
                                alt="" 
                            />
                        )}
                        
                        {isEquipped && (
                             <div className="absolute top-0 right-0 w-3 h-3 bg-destiny-gold rounded-bl-sm" />
                        )}

                        {/* Hover Info */}
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover/socket:opacity-100 transition-opacity flex items-center justify-center text-center p-1 pointer-events-none">
                             <span className="text-[10px] font-bold text-white line-clamp-3">{def.displayProperties?.name}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// Hook for Plug Sets
function usePlugSetItems(plugSetHash?: number) {
    const [plugItems, setPlugItems] = useState<number[]>([]);

    useEffect(() => {
        if (!plugSetHash) {
            setPlugItems([]);
            return;
        }

        const load = async () => {
            try {
                // Try local storage first
                const cacheKey = `destiny_plugset_${plugSetHash}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    setPlugItems(JSON.parse(cached));
                    return;
                }

                const res = await bungieApi.get(endpoints.getPlugSetDefinition(plugSetHash));
                const def = res.data.Response;
                if (def && def.reusablePlugItems) {
                    const items = def.reusablePlugItems.map((i: any) => i.plugItemHash);
                    setPlugItems(items);
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(items));
                    } catch (e) {}
                }
            } catch (e) {
                console.error("Failed to load plug set", e);
            }
        };
        load();
    }, [plugSetHash]);

    return { plugItems };
}


// Hook for socket categories
function useSocketCategoryDefinitions(hashes: number[]) {
    const [definitions, setDefinitions] = useState<Record<number, any>>({});
    
    const uniqueHashes = useMemo(() => Array.from(new Set(hashes)), [hashes]);
    const hashesKey = JSON.stringify(uniqueHashes.sort());

    useEffect(() => {
        if (!uniqueHashes.length) return;

        const load = async () => {
            const newDefs: Record<number, any> = {};
            await Promise.all(uniqueHashes.map(async (h) => {
                try {
                    const res = await bungieApi.get(endpoints.getSocketCategoryDefinition(h));
                    newDefs[h] = res.data.Response;
                } catch (e) {
                    console.error(e);
                }
            }));
            setDefinitions(newDefs);
        };
        load();
    }, [hashesKey]);

    return { definitions };
}

export default ItemDetailsOverlay;
