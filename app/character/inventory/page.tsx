'use client';

import { DestinyItemCard } from "@/components/DestinyItemCard";
import { VaultGrid } from "@/components/VaultGrid";
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { Loader2, Search, Settings } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { loginWithBungie } from "@/lib/bungie";
import { useSettingsStore } from "@/store/settingsStore";

export default function InventoryPage() {
  const { profile, isLoggedIn, isLoading: profileLoading } = useDestinyProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  // --- Settings State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { iconSize, sortMethod, setIconSize, setSortMethod } = useSettingsStore();
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      setMounted(true);
      const handleClickOutside = (event: MouseEvent) => {
          if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
              setIsSettingsOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Gather Items
  const allProfileItems = useMemo(() => {
      return profile?.profileInventory?.data?.items || [];
  }, [profile]);

  const itemHashes = useMemo(() => allProfileItems.map((i: any) => i.itemHash), [allProfileItems]);

  // 2. Fetch Definitions
  const { definitions, isLoading: defsLoading } = useItemDefinitions(itemHashes);

  // 3. Filter Logic
  const filterItem = (item: any) => {
      if (!searchQuery) return true;
      const def = definitions[item.itemHash];
      if (!def) return false;
      
      const term = searchQuery.toLowerCase();
      const name = def.displayProperties?.name?.toLowerCase() || "";
      const type = def.itemTypeDisplayName?.toLowerCase() || "";
      
      return name.includes(term) || type.includes(term);
  };

  // 4. Sort Logic
  const sortItems = (items: any[]) => {
      return [...items].sort((a, b) => {
          const defA = definitions[a.itemHash];
          const defB = definitions[b.itemHash];
          
          if (!defA || !defB) return 0;

          switch (sortMethod) {
              case 'power': // Map Power to Quantity for Consumables
                  return (b.quantity || 0) - (a.quantity || 0);
              case 'name':
                  return (defA.displayProperties?.name || "").localeCompare(defB.displayProperties?.name || "");
              case 'rarity':
                  const tierA = defA.inventory?.tierType || 0;
                  const tierB = defB.inventory?.tierType || 0;
                  return tierB - tierA;
              case 'newest':
                  return 0;
              default:
                  return 0;
          }
      });
  };

  // CSS Classes
  const iconSizeClass = {
      'small': 'w-16 h-16',
      'medium': 'w-20 h-20',
      'large': 'w-24 h-24'
  }[iconSize];

  // Data accessors for VaultGrid
  const getInstanceData = useCallback((itemInstanceId: string) => {
      const instance = profile?.itemComponents?.instances?.data?.[itemInstanceId];
      const itemStats = profile?.itemComponents?.stats?.data?.[itemInstanceId]?.stats;
      if (!instance) return undefined;
      return { ...instance, stats: itemStats };
  }, [profile]);

  const getSocketsData = useCallback((itemInstanceId: string) => {
      return profile?.itemComponents?.sockets?.data?.[itemInstanceId];
  }, [profile]);

  const getReusablePlugs = useCallback((itemInstanceId: string) => {
      return profile?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs;
  }, [profile]);

  // Check match callback for search (always true since we pre-filter)
  const checkMatchCallback = useCallback(() => true, []);

  if (!mounted) return null;

  if (!isLoggedIn) return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <div className="text-slate-400">Please login to view inventory.</div>
          <button onClick={() => loginWithBungie()} className="px-6 py-2 bg-destiny-gold text-slate-900 font-bold uppercase tracking-widest hover:bg-white transition-colors rounded-sm">Login</button>
      </div>
  );
  if (profileLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;

  // Group items
  const consumables = allProfileItems.filter((item: any) => item.bucketHash === 1469714392);
  const mods = allProfileItems.filter((item: any) => item.bucketHash === 3313201758);

  const visibleConsumables = sortItems(consumables).filter(filterItem);
  const visibleMods = sortItems(mods).filter(filterItem);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
        {/* Header / Controls */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-white/5 backdrop-blur-md shrink-0 sticky top-16 z-50">
             <div className="flex items-center gap-6">
                 {/* Title matched to Gear Manager size/style */}
                 <h1 className="text-xl font-bold text-white uppercase tracking-wide">Inventory</h1>
             </div>
             
             <div className="flex items-center gap-2">
                 {/* Settings Dropdown */}
                 <div className="relative" ref={settingsRef}>
                     <button 
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={cn(
                            "p-2 rounded-sm border transition-all hover:bg-white/10",
                            isSettingsOpen ? "bg-white/10 border-destiny-gold text-destiny-gold" : "border-white/10 text-slate-400"
                        )}
                     >
                         <Settings className="w-5 h-5" />
                     </button>

                     {isSettingsOpen && (
                         <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 shadow-2xl rounded-sm p-4 z-50 backdrop-blur-xl flex flex-col gap-4">
                             {/* Icon Size */}
                             <div>
                                 <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-2">Icon Size</h3>
                                 <div className="grid grid-cols-3 gap-1">
                                     {['small', 'medium', 'large'].map((size) => (
                                         <button
                                             key={size}
                                             onClick={() => setIconSize(size as any)}
                                             className={cn(
                                                 "px-2 py-1.5 text-xs uppercase font-bold border transition-colors",
                                                 iconSize === size 
                                                    ? "bg-destiny-gold text-black border-destiny-gold" 
                                                    : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30"
                                             )}
                                         >
                                             {size}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                             {/* Sort Method */}
                             <div>
                                 <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-2">Sort By</h3>
                                 <div className="grid grid-cols-2 gap-1">
                                     {['power', 'name', 'rarity', 'newest'].map((method) => (
                                         <button
                                             key={method}
                                             onClick={() => setSortMethod(method as any)}
                                             className={cn(
                                                 "px-2 py-1.5 text-xs uppercase font-bold border transition-colors",
                                                 sortMethod === method 
                                                    ? "bg-destiny-gold text-black border-destiny-gold" 
                                                    : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30"
                                             )}
                                         >
                                             {/* Rename Power to Quantity for context? Or keep generic? Keeping generic 'Power' label but logic uses Quantity is slightly confusing visually but consistent with UI. Let's conditionally render text if easy, else keep consistent. */}
                                             {method === 'power' ? 'Quantity' : method}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         </div>
                     )}
                 </div>

                 <div className="relative w-96">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                     <input 
                        type="text" 
                        placeholder="Search inventory..." 
                        className="w-full bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-destiny-gold/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                     />
                 </div>
             </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20 px-4">
            <div className="space-y-8">
                {/* Consumables - Virtualized Grid */}
                {visibleConsumables.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 sticky top-0 z-10 py-2 backdrop-blur-sm">
                            Consumables ({visibleConsumables.length})
                        </h3>
                        <VaultGrid
                            items={visibleConsumables.map((item: any) => ({
                                itemHash: item.itemHash,
                                itemInstanceId: item.itemInstanceId,
                                quantity: item.quantity
                            }))}
                            iconSize={iconSize}
                            ownerId="PROFILE"
                            checkMatch={checkMatchCallback}
                            getInstanceData={getInstanceData}
                            getSocketsData={getSocketsData}
                            getReusablePlugs={getReusablePlugs}
                            gap={8}
                            maxHeight={400}
                        />
                    </div>
                )}

                {/* Modifications - Virtualized Grid */}
                {visibleMods.length > 0 && (
                    <div>
                        <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 sticky top-0 z-10 py-2 backdrop-blur-sm">
                            Modifications ({visibleMods.length})
                        </h3>
                        <VaultGrid
                            items={visibleMods.map((item: any) => ({
                                itemHash: item.itemHash,
                                itemInstanceId: item.itemInstanceId,
                                quantity: item.quantity
                            }))}
                            iconSize={iconSize}
                            ownerId="PROFILE"
                            checkMatch={checkMatchCallback}
                            getInstanceData={getInstanceData}
                            getSocketsData={getSocketsData}
                            getReusablePlugs={getReusablePlugs}
                            gap={8}
                            maxHeight={400}
                        />
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
