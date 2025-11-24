import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronRight, Star, Shield, Crosshair, Zap, Activity } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { getBungieImage, bungieApi, endpoints, insertSocketPlug, insertSocketPlugFree } from '@/lib/bungie';
import { BUCKETS, getItemTier } from '@/lib/destinyUtils';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

// Stat order matching the screenshot/game
const WEAPON_STAT_ORDER = [
    4284895488, // Impact
    3614673599, // Blast Radius
    4043523819, // Guard Resistance
    2961396640, // Range
    3897883278, // Defense / Shield Duration
    2523465841, // Velocity
    155624089,  // Stability
    943549884,  // Handling
    4188031367, // Reload Speed
    1345609583, // Aim Assistance
    3555269338, // Zoom
    2715839340, // Recoil Direction
    1931675084, // Inventory Size
    2715839340, // Recoil
    1591432999, // Accuracy
    447667954,  // Draw Time
    2591150011, // Charge Time
    2837207746, // Swing Speed
    3022301683, // Charge Rate
    3736853112, // Guard Efficiency
    2762071195, // Guard Endurance
];

export function ItemDetailsOverlay() {
  const { detailsItem, setDetailsItem } = useUIStore();
  const { profile, membershipInfo } = useDestinyProfile();
  
  // Always declare hooks at the top level
  const [showAllPerks, setShowAllPerks] = useState(false);

  // Fetch definition for the item
  const { definitions } = useItemDefinitions(detailsItem ? [detailsItem.itemHash] : []);
  const itemDef = definitions[detailsItem?.itemHash || 0];

  const instance = detailsItem?.itemInstanceId ? profile?.itemComponents?.instances?.data?.[detailsItem.itemInstanceId] : undefined;
  const sockets = detailsItem?.itemInstanceId ? profile?.itemComponents?.sockets?.data?.[detailsItem.itemInstanceId]?.sockets : undefined;
  const stats = detailsItem?.itemInstanceId ? profile?.itemComponents?.stats?.data?.[detailsItem.itemInstanceId]?.stats : undefined;
  const objectives = detailsItem?.itemInstanceId ? profile?.itemComponents?.objectives?.data?.[detailsItem.itemInstanceId]?.objectives : undefined;

  // Fetch plug definitions for Tier calculation
  const activePlugHashes = useMemo(() => {
      if (!sockets) return [];
      return sockets.map((s: any) => s.plugHash).filter((h: any) => h);
  }, [sockets]);
  
  const { definitions: plugDefs } = useItemDefinitions(activePlugHashes);
  
  const tierNumber = useMemo(() => {
      return getItemTier(itemDef, { sockets }, plugDefs, instance);
  }, [itemDef, sockets, plugDefs, instance]);

  // Reset showAllPerks when item changes
  useEffect(() => {
      setShowAllPerks(false);
  }, [detailsItem]);

  if (!detailsItem) return null;

    const isSubclass = itemDef?.inventory?.bucketTypeHash === BUCKETS.SUBCLASS;
    const isWeapon = itemDef?.itemType === 3;
    const isArmor = itemDef?.itemType === 2;

    return (
    <div 
        className="fixed inset-0 z-100 flex justify-center items-center p-4 md:p-8 bg-black/90 backdrop-blur-sm"
        onClick={() => setDetailsItem(null)}
    >
        <div 
            className="w-full max-w-[1400px] aspect-video max-h-[90vh] bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl overflow-hidden relative group flex flex-col md:flex-row isolate"
            onClick={(e) => e.stopPropagation()}
        >
             {/* Background Image (Blurred/Faded) */}
             <div className="absolute inset-0 z-[-1] bg-[#0f0f0f]">
                 {itemDef?.screenshot && (
                     <>
                        <Image 
                            src={getBungieImage(itemDef.screenshot)} 
                            fill 
                            className="object-cover opacity-60" 
                            alt="" 
                        />
                        {/* Gradients to make text readable */}
                        <div className="absolute inset-0 bg-linear-to-r from-[#121212] via-[#121212]/80 to-transparent w-2/3" />
                        <div className="absolute inset-0 bg-linear-to-t from-[#121212] via-transparent to-transparent h-1/2 bottom-0 top-auto" />
                        <div className="absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-[#121212]/90 to-transparent" />
                     </>
                 )}
             </div>

             {/* Controls */}
             <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
                {isWeapon && (
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <span className="text-xs font-bold uppercase text-slate-300">All Perks</span>
                        <button 
                            onClick={() => setShowAllPerks(!showAllPerks)}
                            className={cn(
                                "w-10 h-5 rounded-full relative transition-colors duration-200",
                                showAllPerks ? "bg-destiny-gold" : "bg-slate-600"
                            )}
                        >
                            <div className={cn(
                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-200",
                                showAllPerks ? "left-6" : "left-1"
                            )} />
                        </button>
                    </div>
                )}

                <button 
                    onClick={() => setDetailsItem(null)}
                    className="p-2 text-slate-400 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-8 h-8" />
                </button>
             </div>

             {/* Left Panel: Header & Sockets */}
             <div className="relative z-10 w-full md:w-[500px] h-full p-8 flex flex-col gap-8 overflow-y-auto scrollbar-hide">
                  
                  {/* Header */}
                  <div className="flex gap-5 items-start">
                      <div className="w-20 h-20 border border-white/20 rounded-sm overflow-hidden shadow-lg shrink-0 bg-[#2a2a2a] relative">
                          {itemDef?.displayProperties?.icon && (
                              <Image 
                                src={getBungieImage(itemDef.displayProperties.icon)} 
                                fill 
                                sizes="80px"
                                className="object-cover" 
                                alt="" 
                              />
                          )}
                          {/* Season Watermark Overlay if available */}
                          {itemDef?.iconWatermark && (
                              <Image 
                                src={getBungieImage(itemDef.iconWatermark)} 
                                fill
                                sizes="80px"
                                className="object-cover opacity-80"
                                alt=""
                              />
                          )}
                      </div>
                      <div>
                          <h2 className="text-3xl md:text-4xl font-bold text-white leading-none uppercase tracking-wide">{itemDef?.displayProperties?.name}</h2>
                          <div className="text-sm text-slate-300 font-medium uppercase tracking-widest mt-2 flex items-center gap-3 flex-wrap">
                              <span>{itemDef?.itemTypeDisplayName}</span>
                              {tierNumber > 1 && (
                                  <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border",
                                      tierNumber === 5 
                                        ? "bg-destiny-gold/20 text-destiny-gold border-destiny-gold" 
                                        : "bg-white/10 text-white border-white/10"
                                  )}>
                                    TIER {tierNumber} <span className="text-[8px]">✦</span>
                                  </span>
                              )}
                          </div>
                          
                          <div className="text-slate-400 italic text-xs mt-2 opacity-80 leading-relaxed border-l-2 border-white/20 pl-3">
                              "{itemDef?.flavorText}"
                          </div>
                      </div>
                  </div>

                 {/* Sockets Section (Perks & Mods) */}
                 <div className="flex-1 mt-4">
                     {isSubclass ? (
                        <SubclassStats 
                            sockets={sockets}
                            itemDef={itemDef}
                            profile={profile}
                            item={detailsItem}
                        />
                     ) : (
                         sockets && (
                             <SocketViewer 
                                 sockets={sockets} 
                                 itemDef={itemDef} 
                                 item={detailsItem}
                                 profile={profile}
                                 membershipInfo={membershipInfo}
                                 isSubclass={isSubclass}
                             />
                         )
                     )}
                 </div>
             </div>

             {/* Middle Spacer (Allows background to show) */}
             <div className="hidden md:block flex-1 relative overflow-hidden">
                {showAllPerks ? (
                    <div className="absolute inset-0 overflow-y-auto p-8 scrollbar-hide">
                         <PerkExplorer itemDef={itemDef} />
                    </div>
                ) : (
                    /* Info Overlay (Watermark style) */
                    <div className="absolute bottom-12 left-12 text-white/20 text-sm font-bold uppercase tracking-[0.2em] space-y-1 select-none pointer-events-none">
                        <p>Item Hash: {detailsItem.itemHash}</p>
                        {instance?.itemInstanceId && <p>ID: {instance.itemInstanceId}</p>}
                    </div>
                )}
             </div>

            {/* Right Panel: Stats & History */}
            <div className="relative z-10 w-full md:w-[350px] lg:w-[400px] h-full bg-[#121212]/60 md:bg-transparent p-8 flex flex-col gap-8 overflow-y-auto border-l border-white/5">
               {/* Stats */}
               <div className="mt-auto">
                   {!isSubclass && (
                       <ItemStats 
                           stats={stats} 
                           itemDef={itemDef} 
                           instance={instance} 
                           objectives={objectives}
                           isWeapon={isWeapon}
                       />
                   )}
               </div>
            </div>
        </div>
    </div>
  );
}

// --- Sub-components ---

function ItemStats({ stats, itemDef, instance, objectives, isWeapon }: any) {
    const relevantStats = useMemo(() => {
        if (!itemDef?.stats?.stats) return [];
        
        // Get raw stats from definition
        const defStats = itemDef.stats.stats;
        
        // Create array and merge with live stats
        let merged = Object.entries(defStats).map(([hash, def]: [string, any]) => {
            const statHash = Number(hash);
            const liveValue = stats?.[hash]?.value ?? def.value;
            return {
                hash: statHash,
                value: liveValue,
                ...def
            };
        });

        // Filter and Sort
        if (isWeapon) {
            merged = merged
                .filter(s => WEAPON_STAT_ORDER.includes(s.hash))
                .sort((a, b) => WEAPON_STAT_ORDER.indexOf(a.hash) - WEAPON_STAT_ORDER.indexOf(b.hash));
        } else {
            // Armor or other: Sort by index
            merged.sort((a, b) => a.index - b.index);
        }
        
        return merged;
    }, [itemDef, stats, isWeapon]);

    // Calculate Enemies Defeated from Objectives or Kill Tracker
    const killCount = useMemo(() => {
        if (!objectives) return null;
        // Look for kill tracker objectives (common hash patterns or just display)
        // This is simplified; real kill trackers are complex plugs.
        // But often the instance stats have a "Kills" record if it's a masterwork.
        // Let's check objectives for now.
        const killObj = objectives.find((o: any) => o.objectiveHash === 2302094943 || o.objectiveHash === 74070459); // Examples
        if (killObj) return killObj.progress;
        return null;
    }, [objectives]);

    return (
        <div className="flex flex-col gap-6">
             {/* Weapon Tier / Primary Stat */}
             <div className="flex items-center justify-between border-b border-white/20 pb-4">
                 <div>
                     <div className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-1">Power</div>
                     <div className="text-4xl font-bold text-destiny-gold flex items-start gap-1">
                         {instance?.primaryStat?.value || itemDef?.primaryStat?.value || 0}
                         <span className="text-2xl mt-1">✧</span>
                     </div>
                 </div>
                 {killCount !== null && (
                     <div className="text-right">
                         <div className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-1">Enemies Defeated</div>
                         <div className="text-2xl font-bold text-white">{killCount.toLocaleString()}</div>
                     </div>
                 )}
             </div>

             <div className="flex flex-col gap-2">
                 {relevantStats.map((stat: any) => (
                     <StatRow key={stat.hash} statHash={stat.hash} value={stat.value} isWeapon={isWeapon} />
                 ))}
             </div>
        </div>
    );
}

function StatRow({ statHash, value, isWeapon }: { statHash: number, value: number, isWeapon: boolean }) {
    const { data } = useSWR(endpoints.getStatDefinition(statHash), fetcher);
    const def = data?.Response;

    if (!def) return null;
    // Filter out "Attack" / "Defense" usually shown in header
    if (["Attack", "Defense", "Power"].includes(def.displayProperties.name)) return null;

    // Bar Logic
    const maxValue = isWeapon ? 100 : 42; // Armor stats max ~42 visible usually
    const showBar = isWeapon && !["Recoil Direction", "RPM", "Magazine", "Draw Time", "Charge Time", "Swing Speed"].includes(def.displayProperties.name);

    return (
        <div className="flex items-center gap-4 text-sm group">
            <div className="w-32 text-slate-400 font-bold uppercase text-[11px] tracking-wider text-right group-hover:text-white transition-colors truncate">
                {def.displayProperties.name}
            </div>
            <div className="flex-1 flex items-center gap-3">
                {showBar ? (
                    <div className="flex-1 h-3 bg-white/10 overflow-hidden">
                        <div 
                            className={cn(
                                "h-full transition-all duration-500",
                                "bg-white"
                            )}
                            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} 
                        />
                    </div>
                ) : (
                    <div className="flex-1" />
                )}
                <div className="w-8 text-right font-bold text-white">{value}</div>
            </div>
        </div>
    );
}

// Hook for plug sets
function usePlugSets(hashes: number[]) {
    const [definitions, setDefinitions] = useState<Record<number, any>>({});
    const uniqueHashes = useMemo(() => Array.from(new Set(hashes)).filter(h => h), [hashes]);
    const hashesKey = JSON.stringify(uniqueHashes.sort());

    useEffect(() => {
        if (!uniqueHashes.length) return;
        const load = async () => {
            const newDefs: Record<number, any> = {};
            await Promise.all(uniqueHashes.map(async (h) => {
                try {
                    const res = await bungieApi.get(endpoints.getPlugSetDefinition(h));
                    newDefs[h] = res.data.Response;
                } catch (e) {
                    // console.error(`Failed to fetch plugset ${h}`, e);
                }
            }));
            setDefinitions(newDefs);
        };
        load();
    }, [hashesKey]);
    return { definitions };
}

function SubclassStats({ sockets, itemDef, profile, item }: any) {
    const { membershipInfo } = useDestinyProfile();
    const [selectedSocket, setSelectedSocket] = useState<{ socketIndex: number, category: string } | null>(null);
    const [hoveredPlug, setHoveredPlug] = useState<any>(null);
    
    // reusablePlugs uses string keys like "0", "1", etc.
    const reusablePlugsData = profile?.itemComponents?.reusablePlugs?.data?.[item?.itemInstanceId]?.plugs;
    
    // 1. Identify PlugSet Hashes from itemDef
    const plugSetHashes = useMemo(() => {
        if (!itemDef?.sockets?.socketEntries) return [];
        return itemDef.sockets.socketEntries
            .map((s: any) => s.reusablePlugSetHash || s.randomizedPlugSetHash)
            .filter((h: number) => h);
    }, [itemDef]);

    // 2. Fetch PlugSets
    const { definitions: plugSets } = usePlugSets(plugSetHashes);

    // 3. Gather all plug hashes including available options from all sources
    const allPlugHashes = useMemo(() => {
        const hashes = new Set<number>();
        
        // Current equipped plugs
        sockets?.forEach((s: any) => {
            if (s.plugHash) hashes.add(s.plugHash);
        });
        
        // Reusable plugs from profile (uses string keys)
        if (reusablePlugsData) {
            Object.values(reusablePlugsData).forEach((plugs: any) => {
                if (Array.isArray(plugs)) {
                    plugs.forEach((p: any) => {
                        if (p.plugItemHash) hashes.add(p.plugItemHash);
                    });
                }
            });
        }
        
        // Static socket definitions
        if (itemDef?.sockets?.socketEntries) {
            itemDef.sockets.socketEntries.forEach((entry: any) => {
                if (entry.reusablePlugItems) {
                    entry.reusablePlugItems.forEach((p: any) => {
                        if (p.plugItemHash) hashes.add(p.plugItemHash);
                    });
                }
                // Add from PlugSets if available
                const setHash = entry.reusablePlugSetHash || entry.randomizedPlugSetHash;
                if (setHash && plugSets[setHash]) {
                    plugSets[setHash].reusablePlugItems?.forEach((p: any) => {
                        if (p.plugItemHash) hashes.add(p.plugItemHash);
                    });
                }
            });
        }
        
        return Array.from(hashes);
    }, [sockets, reusablePlugsData, itemDef, plugSets]);

    const { definitions: plugDefs } = useItemDefinitions(allPlugHashes);

    // Categorize sockets by type with available options
    const categorized = useMemo(() => {
        if (!sockets || !plugDefs) return { 
            super: null, classAbility: null, melee: null, grenade: null, 
            aspects: [], fragments: [], movement: null 
        };
        
        const result: Record<string, any> = {
            super: null,
            classAbility: null,
            melee: null,
            grenade: null,
            movement: null,
            aspects: [],
            fragments: []
        };

        sockets.forEach((socket: any, idx: number) => {
            const currentPlug = plugDefs[socket.plugHash];
            if (!currentPlug) return;

            const typeName = currentPlug.itemTypeDisplayName?.toLowerCase() || "";
            const category = currentPlug.plug?.plugCategoryIdentifier?.toLowerCase() || "";

            // Get available options for this socket - use STRING key for reusablePlugsData
            const socketKey = String(idx);
            let availablePlugs: any[] = [];
            const seenHashes = new Set<number>();
            
            // Helper to add plug without duplicates
            const addPlug = (hash: number, def: any) => {
                if (!seenHashes.has(hash) && def) {
                    // Filter out classified/redacted/dummies if needed
                    if (def.redacted || def.displayProperties?.name === "Classified") return;
                    
                    seenHashes.add(hash);
                    availablePlugs.push({ hash, def });
                }
            };
            
            // 1. Profile Reusable Plugs (Unlocked)
            if (reusablePlugsData?.[socketKey] && Array.isArray(reusablePlugsData[socketKey])) {
                reusablePlugsData[socketKey].forEach((p: any) => {
                    addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                });
            }
            
            // 2. Socket-specific reusable plugs (Static)
            if (socket.reusablePlugs && Array.isArray(socket.reusablePlugs)) {
                socket.reusablePlugs.forEach((p: any) => {
                    addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                });
            }
            
            // 3. Definition fallback + PlugSets
            if (itemDef?.sockets?.socketEntries?.[idx]) {
                const entry = itemDef.sockets.socketEntries[idx];
                
                // Static Items
                if (entry.reusablePlugItems) {
                    entry.reusablePlugItems.forEach((p: any) => {
                        addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                    });
                }
                
                // Initial Item
                if (entry.singleInitialItemHash && plugDefs[entry.singleInitialItemHash]) {
                    addPlug(entry.singleInitialItemHash, plugDefs[entry.singleInitialItemHash]);
                }

                // PlugSets (Expanded)
                const setHash = entry.reusablePlugSetHash || entry.randomizedPlugSetHash;
                if (setHash && plugSets[setHash]) {
                     plugSets[setHash].reusablePlugItems?.forEach((p: any) => {
                        addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                     });
                }
            }
            
            // Always ensure current plug is in the list
            if (currentPlug && !seenHashes.has(socket.plugHash)) {
                availablePlugs.unshift({ hash: socket.plugHash, def: currentPlug });
            }

            const socketData = {
                currentPlug,
                socketIndex: idx,
                activeHash: socket.plugHash,
                options: availablePlugs,
            };

            // Super abilities
            if (typeName.includes("super") || category.includes("super")) {
                result.super = socketData;
            }
            // Class abilities
            else if (typeName.includes("class ability") || category.includes("class_abilities")) {
                result.classAbility = socketData;
            }
            // Movement abilities (Blink, Glide, etc)
            else if (category.includes("movement") || typeName.includes("jump") || typeName.includes("glide") || typeName.includes("lift") || typeName.includes("blink")) {
                result.movement = socketData;
            }
            // Melee
            else if (typeName.includes("melee") || category.includes("melee")) {
                result.melee = socketData;
            }
            // Grenade
            else if (typeName.includes("grenade") || category.includes("grenade")) {
                result.grenade = socketData;
            }
            // Aspects
            else if (typeName.includes("aspect") || category.includes("aspects")) {
                result.aspects.push(socketData);
            }
            // Fragments
            else if (typeName.includes("fragment") || category.includes("fragments")) {
                result.fragments.push(socketData);
            }
        });

        return result;
    }, [sockets, plugDefs, reusablePlugsData, itemDef, plugSets]);

    const handleEquipPlug = async (socketIndex: number, plugHash: number, plugName: string) => {
        if (!membershipInfo || !item?.itemInstanceId) {
            toast.error("Unable to equip - missing data");
            return;
        }

        // Find character ID
        let characterId = item.characterId;
        if (!characterId && profile) {
            characterId = Object.keys(profile.characters?.data || {})[0];
        }

        try {
            toast.loading(`Equipping ${plugName}...`, { id: 'equip-plug' });
            
            // Subclass abilities are FREE to swap - use insertSocketPlugFree
            // This doesn't require the AdvancedWriteActions scope
            // Reference: https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/advanced-write-actions.ts
            await insertSocketPlugFree(
                item.itemInstanceId,
                plugHash,
                socketIndex,
                characterId,
                membershipInfo.membershipType
            );
            
            toast.success(`Equipped ${plugName}`, { id: 'equip-plug' });
        } catch (error: any) {
            const bungieError = error.response?.data;
            const message = bungieError?.Message || error.message || "Failed to equip";
            toast.error(message, { id: 'equip-plug' });
        }

        setSelectedSocket(null);
    };

    // Ability Selector Component
    const AbilitySelector = ({ 
        socketData, 
        label, 
        size = 'medium',
        category
    }: { 
        socketData: any, 
        label: string, 
        size?: 'small' | 'medium' | 'large',
        category: string
    }) => {
        if (!socketData) return null;
        
        const plug = socketData.currentPlug;
        const isSelected = selectedSocket?.socketIndex === socketData.socketIndex;
        const hasOptions = socketData.options.length >= 1; // Always clickable if any options
        
        const sizeClasses = {
            small: 'w-12 h-12',
            medium: 'w-16 h-16',
            large: 'w-20 h-20'
        };

        return (
            <div className="flex flex-col items-center gap-2">
                <button
                    onClick={() => hasOptions && setSelectedSocket(isSelected ? null : { socketIndex: socketData.socketIndex, category })}
                    onMouseEnter={() => setHoveredPlug(plug)}
                    onMouseLeave={() => setHoveredPlug(null)}
                    className={cn(
                        "relative rounded-lg overflow-hidden border-2 transition-all group",
                        sizeClasses[size],
                        hasOptions ? "cursor-pointer hover:scale-105 hover:border-destiny-gold/60" : "cursor-default",
                        isSelected 
                            ? "border-destiny-gold ring-2 ring-destiny-gold/50 scale-105" 
                            : "border-white/20"
                    )}
                >
                    {plug?.displayProperties?.icon && (
                        <Image 
                            src={getBungieImage(plug.displayProperties.icon)} 
                            fill
                            className="object-cover" 
                            alt="" 
                        />
                    )}
                    {/* Click indicator overlay */}
                    {hasOptions && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <ChevronRight className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                    {/* Options count badge */}
                    {socketData.options.length > 1 && (
                        <div className="absolute bottom-0 right-0 bg-black/80 px-1 py-0.5 text-[8px] font-bold text-destiny-gold">
                            {socketData.options.length}
                        </div>
                    )}
                </button>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</span>
            </div>
        );
    };

    // Options Popup
    const OptionsPopup = () => {
        if (!selectedSocket) return null;

        let socketData: any = null;
        let title = "";

        switch (selectedSocket.category) {
            case 'super': socketData = categorized.super; title = "Super Abilities"; break;
            case 'classAbility': socketData = categorized.classAbility; title = "Class Abilities"; break;
            case 'movement': socketData = categorized.movement; title = "Movement"; break;
            case 'melee': socketData = categorized.melee; title = "Melee Abilities"; break;
            case 'grenade': socketData = categorized.grenade; title = "Grenades"; break;
            case 'aspect':
                socketData = categorized.aspects.find((a: any) => a.socketIndex === selectedSocket.socketIndex);
                title = "Aspects";
                break;
            case 'fragment':
                socketData = categorized.fragments.find((f: any) => f.socketIndex === selectedSocket.socketIndex);
                title = "Fragments";
                break;
        }

        if (!socketData) return null;

        return (
            <div className="fixed inset-0 z-200 flex items-center justify-center p-4" onClick={() => setSelectedSocket(null)}>
                <div 
                    className="bg-[#0a0a0a] border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">{title}</h3>
                        <button 
                            onClick={() => setSelectedSocket(null)}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
                        {/* Debug info */}
                        <div className="text-[10px] text-slate-600 mb-2 p-2 bg-white/5 rounded">
                            Socket {socketData.socketIndex} • {socketData.options.length} option(s) available
                        </div>
                        
                        {socketData.options.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <p className="text-sm">No options found</p>
                                <p className="text-xs mt-2 text-slate-500">
                                    The API may not have returned available abilities for this socket.
                                    Check the browser console for debug info.
                                </p>
                            </div>
                        ) : socketData.options.map((opt: any) => {
                            const isActive = opt.hash === socketData.activeHash;
                            return (
                                <button
                                    key={opt.hash}
                                    onClick={() => !isActive && handleEquipPlug(socketData.socketIndex, opt.hash, opt.def.displayProperties?.name)}
                                    className={cn(
                                        "w-full flex items-start gap-4 p-3 rounded-lg border transition-all text-left",
                                        isActive 
                                            ? "bg-destiny-gold/10 border-destiny-gold cursor-default" 
                                            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer"
                                    )}
                                >
                                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-black/40">
                                        {opt.def.displayProperties?.icon && (
                                            <Image 
                                                src={getBungieImage(opt.def.displayProperties.icon)} 
                                                width={56} 
                                                height={56} 
                                                className="object-cover" 
                                                alt="" 
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={cn(
                                                "font-bold",
                                                isActive ? "text-destiny-gold" : "text-white"
                                            )}>
                                                {opt.def.displayProperties?.name}
                                            </p>
                                            {isActive && (
                                                <span className="text-[9px] bg-destiny-gold text-black px-1.5 py-0.5 rounded font-bold uppercase">
                                                    Equipped
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                            {opt.def.displayProperties?.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // Hover Tooltip
    const HoverTooltip = () => {
        if (!hoveredPlug || selectedSocket) return null;
        
        return (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-150 w-80 bg-[#0a0a0a]/95 border border-white/20 rounded-lg p-4 shadow-2xl backdrop-blur-md pointer-events-none">
                <p className="text-sm font-bold text-destiny-gold mb-1">{hoveredPlug.displayProperties?.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{hoveredPlug.itemTypeDisplayName}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{hoveredPlug.displayProperties?.description}</p>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Super - Featured */}
            {categorized.super && (
                <div className="mb-6">
                    <button 
                        onClick={() => setSelectedSocket({ socketIndex: categorized.super.socketIndex, category: 'super' })}
                        className="w-full flex items-center gap-4 p-4 bg-linear-to-r from-destiny-gold/10 to-transparent rounded-lg border border-destiny-gold/20 hover:border-destiny-gold/40 hover:from-destiny-gold/20 transition-all text-left group"
                    >
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-destiny-gold/40 shrink-0 group-hover:border-destiny-gold transition-colors">
                            {categorized.super.currentPlug?.displayProperties?.icon && (
                                <Image 
                                    src={getBungieImage(categorized.super.currentPlug.displayProperties.icon)} 
                                    fill
                                    className="object-cover" 
                                    alt="" 
                                />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <ChevronRight className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-destiny-gold uppercase tracking-wider font-bold mb-1">Super Ability</p>
                            <p className="text-xl font-bold text-white">{categorized.super.currentPlug?.displayProperties?.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1 group-hover:text-slate-300 transition-colors">
                                Click to change {categorized.super.options.length > 1 && `• ${categorized.super.options.length} available`}
                            </p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-500 group-hover:text-destiny-gold transition-colors" />
                    </button>
                </div>
            )}

            {/* Core Abilities Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <AbilitySelector socketData={categorized.classAbility} label="Class" size="medium" category="classAbility" />
                <AbilitySelector socketData={categorized.movement} label="Jump" size="medium" category="movement" />
                <AbilitySelector socketData={categorized.melee} label="Melee" size="medium" category="melee" />
                <AbilitySelector socketData={categorized.grenade} label="Grenade" size="medium" category="grenade" />
            </div>

            {/* Aspects */}
            {categorized.aspects.length > 0 && (
                <div className="mb-6">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Aspects <span className="text-slate-600">• Click to change</span>
                    </p>
                    <div className="flex gap-4">
                        {categorized.aspects.map((aspect: any, i: number) => (
                            <button
                                key={i}
                                onClick={() => setSelectedSocket({ socketIndex: aspect.socketIndex, category: 'aspect' })}
                                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-destiny-gold/40 hover:bg-white/10 transition-all group"
                            >
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-white/20 group-hover:border-destiny-gold/60 transition-colors">
                                    {aspect.currentPlug?.displayProperties?.icon && (
                                        <Image 
                                            src={getBungieImage(aspect.currentPlug.displayProperties.icon)} 
                                            fill
                                            className="object-cover" 
                                            alt="" 
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <ChevronRight className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {aspect.options.length > 1 && (
                                        <div className="absolute bottom-0 right-0 bg-black/80 px-1 py-0.5 text-[8px] font-bold text-destiny-gold">
                                            {aspect.options.length}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider max-w-[80px] truncate group-hover:text-white transition-colors">
                                    {aspect.currentPlug?.displayProperties?.name?.split(' ').slice(0, 2).join(' ') || `Aspect ${i + 1}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Fragments */}
            {categorized.fragments.length > 0 && (
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Fragments <span className="text-slate-600">• Click to change</span>
                    </p>
                    <div className="grid grid-cols-5 gap-3">
                        {categorized.fragments.map((fragment: any, i: number) => (
                            <button
                                key={i}
                                onClick={() => setSelectedSocket({ socketIndex: fragment.socketIndex, category: 'fragment' })}
                                className="flex flex-col items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:border-destiny-gold/40 hover:bg-white/10 transition-all group"
                            >
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20 group-hover:border-destiny-gold/60 transition-colors">
                                    {fragment.currentPlug?.displayProperties?.icon && (
                                        <Image 
                                            src={getBungieImage(fragment.currentPlug.displayProperties.icon)} 
                                            fill
                                            className="object-cover" 
                                            alt="" 
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <ChevronRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {fragment.options.length > 1 && (
                                        <div className="absolute bottom-0 right-0 bg-black/80 px-0.5 text-[7px] font-bold text-destiny-gold">
                                            {fragment.options.length}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider max-w-[60px] truncate text-center leading-tight group-hover:text-slate-300 transition-colors">
                                    {fragment.currentPlug?.displayProperties?.name?.replace(/^(Echo|Thread|Facet|Whisper) of /i, '') || `${i + 1}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Popups */}
            <OptionsPopup />
            <HoverTooltip />
        </div>
    );
}

function SocketViewer({ sockets, itemDef, item, profile, membershipInfo, isSubclass }: any) {
    const { definitions: categoryDefs } = useSocketCategoryDefinitions(itemDef?.sockets?.socketCategories?.map((c: any) => c.socketCategoryHash) || []);
    
    const reusablePlugsData = profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs;

    // Gather all plug hashes to fetch definitions
    const allPlugHashes = useMemo(() => {
        const hashes: number[] = [];
        sockets?.forEach((s: any) => {
            if (s.plugHash) hashes.push(s.plugHash);
            if (s.reusablePlugs) s.reusablePlugs.forEach((rp: any) => hashes.push(rp.plugItemHash));
        });

        // Also check profile reusablePlugs component
        if (reusablePlugsData) {
            Object.values(reusablePlugsData).forEach((plugs: any) => {
                 plugs.forEach((p: any) => hashes.push(p.plugItemHash));
            });
        }

        // And static definitions as fallback
        if (itemDef?.sockets?.socketEntries) {
             itemDef.sockets.socketEntries.forEach((s: any) => {
                 if (s.reusablePlugItems) {
                     s.reusablePlugItems.forEach((p: any) => hashes.push(p.plugItemHash));
                 }
             });
        }

        return hashes;
    }, [sockets, reusablePlugsData, itemDef]);

    const { definitions: plugDefs } = useItemDefinitions(allPlugHashes);

    // Filter out cosmetics completely
    const nonCosmeticCategories = useMemo(() => {
        if (!itemDef?.sockets?.socketCategories) return [];
        return itemDef.sockets.socketCategories.filter((c: any) => {
             const def = categoryDefs[c.socketCategoryHash];
             if (!def) return false;
             const name = def.displayProperties?.name || "";
             return !name.toLowerCase().includes("cosmetic");
        });
    }, [itemDef, categoryDefs]);

    const { intrinsic, mods, perks } = useMemo(() => {
        const intrinsic: any[] = [];
        const mods: any[] = [];
        const perks: any[] = [];

        nonCosmeticCategories.forEach((c: any) => {
            const def = categoryDefs[c.socketCategoryHash];
            const name = def?.displayProperties?.name || "";
            const nameLower = name.toLowerCase();
            
            if (nameLower.includes("intrinsic") || nameLower.includes("archetype")) {
                intrinsic.push(c);
            } else if (nameLower.includes("mod")) {
                mods.push(c);
            } else {
                perks.push(c);
            }
        });

        return { intrinsic, mods, perks };
    }, [nonCosmeticCategories, categoryDefs]);

    const renderCategory = (category: any) => {
        const categoryDef = categoryDefs[category.socketCategoryHash];
        if (!categoryDef) return null;

        const categorySockets = category.socketIndexes.map((idx: number) => ({
            ...sockets[idx],
            socketIndex: idx,
            def: itemDef.sockets.socketEntries[idx],
            reusablePlugs: reusablePlugsData?.[idx] || sockets[idx].reusablePlugs || [] 
        }));

        if (!categorySockets.length) return null;
        
        // Filter empty sockets
        const validSockets = categorySockets.filter((socket: any) => {
                const plug = plugDefs[socket.plugHash];
                // Keep empty sockets if they are meant to be visible (like empty mod slots)
                if (!plug && socket.isVisible) return true; 
                if (!plug) return false;

                // Filter Kill Trackers
                if (plug.displayProperties?.name?.includes("Kill Tracker") || plug.itemTypeDisplayName?.includes("Tracker")) {
                return false;
                }

                // Filter Cosmetics (Shaders, Ornaments)
                const type = plug.itemTypeDisplayName?.toLowerCase() || "";
                const category = plug.plug?.plugCategoryIdentifier?.toLowerCase() || "";
                
                if (type.includes("shader") || type.includes("ornament")) return false;
                if (category.includes("shader") || category.includes("skins")) return false;

                // Filter Transmat & Flair
                if (type.includes("transmat") || category.includes("transmat")) return false;
                if (type.includes("flair") || category.includes("flair")) return false;

                return true;
        });

        if (validSockets.length === 0) return null;

        return (
            <div key={category.socketCategoryHash} className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-white/10 pb-1">
                    {categoryDef.displayProperties?.name}
                </h3>
                
                <div className="flex flex-wrap gap-3">
                    {validSockets.map((socket: any) => (
                        <Socket 
                            key={socket.socketIndex} 
                            socket={socket} 
                            activePlug={plugDefs[socket.plugHash]} 
                            plugDefs={plugDefs}
                            item={item}
                            itemDef={itemDef}
                            categoryDef={categoryDef}
                            membershipInfo={membershipInfo}
                            profile={profile}
                            isSubclass={isSubclass}
                        />
                    ))}
                </div>
            </div>
        );
    };

    if (!itemDef?.sockets?.socketCategories) return null;

    return (
        <div className="flex flex-col gap-8 pb-20">
            {/* Intrinsic & Mods Row */}
            <div className="flex flex-wrap gap-8">
                {intrinsic.map(renderCategory)}
                {mods.map(renderCategory)}
            </div>

            {/* Perks (The rest) */}
            {perks.map(renderCategory)}
        </div>
    );
}

import { createPortal } from 'react-dom';

function PortalTooltip({ content, targetRect, position = 'top' }: any) {
    if (!targetRect || !content) return null;
    if (typeof document === 'undefined') return null;

    // Calculate position
    let top = 0;
    let left = 0;
    const tooltipWidth = 240; // Approx width
    const gap = 8;

    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;

    if (position === 'top') {
        top = targetRect.top + scrollY - gap;
        left = targetRect.left + scrollX + (targetRect.width / 2);
    }

    return createPortal(
        <div 
            className="fixed z-200 pointer-events-none"
            style={{ 
                top: top, 
                left: left,
                transform: 'translate(-50%, -100%)' 
            }}
        >
            <div className="w-60 bg-[#1a1a1a] border border-white/20 p-3 rounded shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                {content}
            </div>
        </div>,
        document.body
    );
}

function Socket({ socket, activePlug, plugDefs, item, itemDef, categoryDef, membershipInfo, profile, isSubclass }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredPlug, setHoveredPlug] = useState<any>(null);
    const [hoverTarget, setHoverTarget] = useState<HTMLElement | null>(null);
    
    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, plug: any) => {
        setHoveredPlug(plug);
        setHoverTarget(e.currentTarget);
    };

    const handleMouseLeave = () => {
        setHoveredPlug(null);
        setHoverTarget(null);
    };
    
    // Determine if this is a weapon perk column (Circle + Vertical List)
    // Logic: Item is Weapon (Type 3) AND Category is NOT Cosmetic/Masterwork/Mod
    // Safe check: Check if category name contains "Trait", "Magazine", "Barrel", "Sight"
    const categoryName = categoryDef?.displayProperties?.name || "";
    const categoryNameLower = categoryName.toLowerCase();
    
    // More precise check for what should be a vertical column
    // - Traits, Magazines, Barrels, Sights, Scopes
    // - NOT Intrinsic (those are single usually)
    // - NOT Mods
    const isWeaponPerk = 
        itemDef?.itemType === 3 && 
        (categoryNameLower.includes("trait") || 
         categoryNameLower.includes("magazine") || 
         categoryNameLower.includes("barrel") || 
         categoryNameLower.includes("sight") || 
         categoryNameLower.includes("scope") || 
         categoryNameLower.includes("perk")) &&
        !categoryNameLower.includes("intrinsic") && // Intrinsics should be single
        !categoryNameLower.includes("mod") &&
        !categoryNameLower.includes("masterwork");
        
    const isWeaponMod = itemDef?.itemType === 3 && categoryNameLower.includes("mod");
    
    // Determine Shape
    const isCircle = itemDef?.itemType === 3 && !categoryNameLower.includes("mod") && !categoryNameLower.includes("intrinsic"); // Weapon perks are circles, except intrinsics usually

    // Resolve Options
    // 1. Reusable Plugs (Profile)
    // 2. Static Definition
    const options = useMemo(() => {
        let hashes: number[] = [];
        
        // Profile Data
        if (socket.reusablePlugs && socket.reusablePlugs.length > 0) {
            hashes = socket.reusablePlugs.map((p: any) => p.plugItemHash);
        } 
        // Fallback to Definition (if not instanced or static)
        else if (socket.def?.reusablePlugItems) {
             hashes = socket.def.reusablePlugItems.map((p: any) => p.plugItemHash);
        }
        
        // Ensure active plug is included
        if (socket.plugHash && !hashes.includes(socket.plugHash)) {
            hashes.unshift(socket.plugHash);
        }

        // Remove duplicates
        hashes = Array.from(new Set(hashes));

        // Map to definitions (passed from parent)
        // Note: Parent might not have fetched ALL static definition plugs if we fell back to socket.def
        // But for live items, profile data usually covers it.
        return hashes.map(h => ({ hash: h, def: plugDefs[h] })).filter(o => o.def);
    }, [socket, plugDefs]);

    const handleSelectPlug = async (plugItemHash: number, plugName: string) => {
        if (plugItemHash === socket.plugHash) {
             setIsOpen(false);
             return; 
        }
        if (!membershipInfo) {
            toast.error("Login required");
            return;
        }

        let ownerId = item.characterId; 
        if (!ownerId && profile) ownerId = Object.keys(profile.characters?.data || {})[0];

        try {
            toast.loading(`Equipping ${plugName}...`, { id: 'equip-plug' });
            
            // Try the free endpoint first - works for:
            // - Weapon perk toggles (switching between rolled perks)
            // - Subclass abilities
            // - Free armor mods
            // Reference: https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/advanced-write-actions.ts
            try {
                await insertSocketPlugFree(
                    item.itemInstanceId, 
                    plugItemHash, 
                    socket.socketIndex, 
                    ownerId, 
                    membershipInfo.membershipType
                );
                toast.success(`Equipped ${plugName}`, { id: 'equip-plug' });
            } catch (freeError: any) {
                // If free endpoint fails, it might need the paid endpoint (AdvancedWriteActions scope)
                // This will likely fail without the scope, but try anyway for completeness
                const freeErrorCode = freeError.response?.data?.ErrorCode;
                
                // ErrorCode 1641 = DestinySocketActionNotAllowed (can't use free endpoint)
                // In this case, we'd need the paid endpoint which requires AWA scope
                if (freeErrorCode === 1641) {
                    toast.error("This action requires materials or special permissions.", { id: 'equip-plug' });
                } else {
                    const message = freeError.response?.data?.Message || freeError.message || "Failed to equip";
                    toast.error(message, { id: 'equip-plug' });
                }
            }
        } catch (error: any) {
            const message = error.response?.data?.Message || error.message || "Failed to equip";
            toast.error(message, { id: 'equip-plug' });
        }
        
        setIsOpen(false);
    };

    if (!activePlug && options.length === 0) return <div className={cn("w-12 h-12 bg-white/5 border border-dashed border-white/20", isCircle ? "rounded-full" : "rounded-sm")} />;

    const displayPlug = activePlug || options[0]?.def;
    if (!displayPlug) return null;

    // Single View (Armor Mods, Cosmetics, Single Perks)
    const isEnhanced = displayPlug.displayProperties?.name?.includes("Enhanced");
    const hasOptions = options.length > 1;

    // Weapon Perks: Render as Vertical Column (Reusable Plugs System)
    if (isWeaponPerk) {
        return (
            <div className="flex flex-col gap-2 pt-2">
                 {options.map((opt: any) => {
                     const isSelected = opt.hash === socket.plugHash;
                     const isOptEnhanced = opt.def.displayProperties?.name?.includes("Enhanced");
                     
                     return (
                        <div 
                            key={opt.hash}
                            className="relative group/plug"
                            onMouseEnter={(e) => handleMouseEnter(e, opt.def)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSelectPlug(opt.hash, opt.def.displayProperties.name); }}
                                className={cn(
                                    "w-13 h-13 rounded-full overflow-hidden border relative transition-all",
                                    isSelected 
                                        ? "border-destiny-gold bg-[#5b94be] opacity-100 ring-1 ring-destiny-gold" 
                                        : "border-gray-600 bg-black/40 opacity-50 hover:opacity-100 hover:border-gray-400"
                                )}
                            >
                                {opt.def.displayProperties?.icon && (
                                    <Image 
                                        src={getBungieImage(opt.def.displayProperties.icon)} 
                                        fill 
                                        className="object-cover" 
                                        alt={opt.def.displayProperties.name} 
                                    />
                                )}
                                {isOptEnhanced && (
                                     <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-destiny-gold" />
                                )}
                            </button>
                        </div>
                     );
                 })}

                 {/* Shared Tooltip for this column */}
                 {hoveredPlug && hoverTarget && (
                    <PortalTooltip 
                        targetRect={hoverTarget.getBoundingClientRect()} 
                        content={
                            <>
                                <p className="text-sm font-bold text-destiny-gold mb-1">{hoveredPlug.displayProperties?.name}</p>
                                <p className="text-[10px] text-slate-400 uppercase mb-2">{hoveredPlug.itemTypeDisplayName}</p>
                                <p className="text-xs text-slate-300 leading-relaxed">{hoveredPlug.displayProperties?.description}</p>
                            </>
                        } 
                    />
                )}
            </div>
        );
    }

    // Standard Single View (Armor Mods, Cosmetics, etc)
    return (
        <div className="relative group/socket">
            <button 
                onClick={() => hasOptions && setIsOpen(true)}
                onMouseEnter={(e) => handleMouseEnter(e, displayPlug)}
                onMouseLeave={handleMouseLeave}
                className={cn(
                    "w-12 h-12 md:w-14 md:h-14 overflow-hidden border-2 relative transition-all",
                    isCircle ? "rounded-full" : "rounded-sm",
                    hasOptions ? "cursor-pointer hover:border-white" : "cursor-default",
                    isEnhanced ? "border-destiny-gold" : "border-slate-500 bg-[#0f0f0f]",
                    isOpen ? "ring-2 ring-white scale-110 z-50" : ""
                )}
            >
                {displayPlug.displayProperties?.icon && (
                    <Image 
                        src={getBungieImage(displayPlug.displayProperties.icon)} 
                        fill 
                        className="object-cover" 
                        alt={displayPlug.displayProperties.name} 
                    />
                )}
                
                {/* Enhanced Triangle */}
                {isEnhanced && (
                     <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-8 border-b-destiny-gold" />
                )}
            </button>

            {/* Portal Tooltip for Single View */}
            {hoveredPlug && hoverTarget && (
                <PortalTooltip 
                    targetRect={hoverTarget.getBoundingClientRect()} 
                    content={
                        <>
                            <p className="text-sm font-bold text-destiny-gold mb-1">{hoveredPlug.displayProperties?.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase mb-2">{hoveredPlug.itemTypeDisplayName}</p>
                            <p className="text-xs text-slate-300 leading-relaxed">{hoveredPlug.displayProperties?.description}</p>
                            {hasOptions && !isWeaponMod && (
                                <div className="mt-3 border-t border-white/10 pt-2">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Available Options</p>
                                    <div className="flex flex-wrap gap-1">
                                        {options.map(opt => (
                                            <div 
                                                key={opt.hash} 
                                                className={cn(
                                                    "relative w-6 h-6 rounded-full overflow-hidden border",
                                                    opt.hash === socket.plugHash ? "border-destiny-gold" : "border-white/20 opacity-50"
                                                )} 
                                                title={opt.def.displayProperties?.name}
                                            >
                                                <Image src={getBungieImage(opt.def.displayProperties?.icon)} fill className="object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-blue-400 mt-2 font-bold uppercase tracking-wide">Click to Select</p>
                                </div>
                            )}
                        </>
                    } 
                />
            )}

            {/* Options Popup (For Single View Types with Options - e.g. Mods) */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-60 bg-transparent" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
                    <div className="absolute top-full left-0 mt-2 z-70 flex flex-col gap-2 bg-[#1a1a1a] border border-white/20 p-2 rounded shadow-2xl min-w-[220px] animate-in fade-in zoom-in-95 duration-100">
                        <div className="text-xs uppercase font-bold text-slate-500 px-2 pb-1 border-b border-white/10 mb-1">Select Option</div>
                         <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                             {options.map((opt: any) => {
                                 const isOptSelected = opt.hash === socket.plugHash;
                                 return (
                                     <button
                                         key={opt.hash}
                                         onClick={(e) => { e.stopPropagation(); handleSelectPlug(opt.hash, opt.def.displayProperties.name); }}
                                         className={cn(
                                             "w-10 h-10 overflow-hidden border relative hover:scale-110 transition-transform",
                                             isCircle ? "rounded-full" : "rounded-sm",
                                             isOptSelected ? "border-destiny-gold ring-1 ring-destiny-gold" : "border-slate-600 hover:border-white"
                                         )}
                                         title={opt.def.displayProperties.name}
                                     >
                                         <Image 
                                             src={getBungieImage(opt.def.displayProperties.icon)} 
                                             fill 
                                             className="object-cover" 
                                             alt="" 
                                         />
                                     </button>
                                 );
                             })}
                         </div>
                    </div>
                </>
            )}
        </div>
    );
}

// Hook for socket categories
function useSocketCategoryDefinitions(hashes: number[]) {
    const [definitions, setDefinitions] = useState<Record<number, any>>({});
    
    const uniqueHashes = useMemo(() => Array.from(new Set(hashes)), [hashes]);
    const hashesKey = JSON.stringify(uniqueHashes.sort());

    useEffect(() => {
        if (!uniqueHashes.length) return;

        const load = async () => {
            // Check local cache or bulk fetch if possible to avoid N requests
            // Using simple promise.all for now
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

function PerkExplorer({ itemDef }: { itemDef: any }) {
    const perkSockets = useMemo(() => {
        if (!itemDef?.sockets?.socketEntries) return [];
        
        // Filter for sockets that look like perks (have randomized plugs or multiple options)
        return itemDef.sockets.socketEntries
            .map((s: any, index: number) => ({ ...s, index }))
            .filter((s: any) => {
                // Exclude cosmetics/stats/etc by simple heuristics if category not available
                // Or just show everything that has options.
                // Check randomizedPlugSetHash AND reusablePlugSetHash
                return (s.randomizedPlugSetHash || s.reusablePlugSetHash || (s.reusablePlugItems && s.reusablePlugItems.length > 1)) 
                    && s.socketTypeHash !== 0; 
            });
    }, [itemDef]);

    return (
        <div className="flex gap-3 h-full justify-center items-start pt-4">
             {perkSockets.map((socket: any) => (
                 <PerkColumn key={socket.index} socket={socket} />
             ))}
        </div>
    );
}

function PerkColumn({ socket }: { socket: any }) {
    const plugSetHash = socket.randomizedPlugSetHash || socket.reusablePlugSetHash;
    const { data } = useSWR(plugSetHash ? endpoints.getPlugSetDefinition(plugSetHash) : null, fetcher);
    const plugSet = data?.Response;
    
    const plugHashes = useMemo(() => {
        let hashes: number[] = [];
        
        // Start with socket-level reusable plugs (static definitions)
        if (socket.reusablePlugItems) {
            hashes.push(...socket.reusablePlugItems.map((p: any) => p.plugItemHash));
        }
        
        // Add plug set items (randomized/pool)
        if (plugSet?.reusablePlugItems) {
            hashes.push(...plugSet.reusablePlugItems.map((p: any) => p.plugItemHash));
        }
        
        return Array.from(new Set(hashes));
    }, [plugSet, socket]);
    
    const { definitions: plugs } = useItemDefinitions(plugHashes);
    
    const [hoveredPlug, setHoveredPlug] = useState<any>(null);
    const [hoverTarget, setHoverTarget] = useState<HTMLElement | null>(null);

    if (plugHashes.length === 0) return null;

    // Filter out undesirable plugs (Kill Trackers, empty, etc)
    const validPlugs = plugHashes
        .map(h => plugs[h])
        .filter(p => {
            if (!p) return false;
            const name = p.displayProperties?.name;
            const type = p.itemTypeDisplayName?.toLowerCase() || "";
            const category = p.plug?.plugCategoryIdentifier?.toLowerCase() || "";

            if (!name) return false;

            // Kill Trackers
            if (name.includes("Kill Tracker") || name.includes("Tracker")) return false;
            if (type.includes("tracker")) return false;
            
            // Cosmetics / Shaders / Ornaments
            if (type.includes("shader") || type.includes("ornament")) return false;
            if (category.includes("shader") || category.includes("skins")) return false;

            // Filter Transmat & Flair
            if (type.includes("transmat") || category.includes("transmat")) return false;
            if (type.includes("flair") || category.includes("flair")) return false;

            // Masterworks
            if (type.includes("masterwork") || name.includes("Masterwork")) return false;
            if (category.includes("masterwork")) return false;

            // Intrinsic & Origin Traits (Filtered from All Perks View)
            if (type.includes("intrinsic") || category.includes("intrinsic")) return false;
            if (type.includes("origin trait") || category.includes("origin")) return false;
            
            // Classified
            if (name.includes("Classified") || p.redacted) return false;

            // Mods
            if (type.includes("mod")) return false;
            if (category.includes("mod")) return false;

            return true;
        });

    if (validPlugs.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            {validPlugs.map((plug: any) => (
                 <div 
                    key={plug.hash} 
                    className="relative"
                    onMouseEnter={(e) => {
                        setHoveredPlug(plug);
                        setHoverTarget(e.currentTarget);
                    }}
                    onMouseLeave={() => {
                        setHoveredPlug(null);
                        setHoverTarget(null);
                    }}
                 >
                    <div className="w-16 h-16 rounded-full border border-white/10 bg-[#1a1a1a] overflow-hidden hover:border-white hover:scale-110 transition-all cursor-default relative">
                         <Image 
                            src={getBungieImage(plug.displayProperties.icon)}
                            fill
                            className="object-cover"
                            alt={plug.displayProperties.name}
                         />
                    </div>
                 </div>
            ))}
            
             {hoveredPlug && hoverTarget && (
                <PortalTooltip 
                    targetRect={hoverTarget.getBoundingClientRect()} 
                    content={
                        <>
                            <p className="text-sm font-bold text-destiny-gold mb-1">{hoveredPlug.displayProperties?.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase mb-2">{hoveredPlug.itemTypeDisplayName}</p>
                            <p className="text-xs text-slate-300 leading-relaxed">{hoveredPlug.displayProperties?.description}</p>
                        </>
                    } 
                />
            )}
        </div>
    );
}

export default ItemDetailsOverlay;
