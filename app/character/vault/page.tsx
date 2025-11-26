'use client';

import { DestinyItemCard } from "@/components/DestinyItemCard";
import { VaultGrid, GroupedVaultGrid } from "@/components/VaultGrid";
import { CharacterHeader } from "@/components/CharacterHeader";
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { useItemDefinitions, ItemDefinition } from "@/hooks/useItemDefinitions";
import { Loader2, Search, Settings, Archive } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { moveItem } from "@/lib/bungie";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

// --- Constants & Helpers ---

const BUCKETS = {
    KINETIC: 1498876634,
    ENERGY: 2465295065,
    POWER: 953998645,
    HELMET: 3448274439,
    GAUNTLETS: 3551918588,
    CHEST: 14239492,
    LEGS: 20886954,
    CLASS: 1585787867,
    GHOST: 4023194814,
    VEHICLE: 2025709351,
    SHIP: 284967655,
};

const ORDERED_SLOTS = [
    { id: 'weapons', label: 'Weapons', buckets: [BUCKETS.KINETIC, BUCKETS.ENERGY, BUCKETS.POWER] },
    { id: 'armor', label: 'Armor', buckets: [BUCKETS.HELMET, BUCKETS.GAUNTLETS, BUCKETS.CHEST, BUCKETS.LEGS, BUCKETS.CLASS] },
    // { id: 'inventory', label: 'Inventory', buckets: [BUCKETS.GHOST] }
];


import { loginWithBungie } from "@/lib/bungie";
import { useTransferStore } from "@/store/transferStore";
import { useSettingsStore } from "@/store/settingsStore";
import { parseSearchQuery, checkItemMatch } from "@/lib/searchUtils";

// Helper to merge instance data with item stats for tooltip display
function getInstanceDataWithStats(profile: any, itemInstanceId: string) {
    const instance = profile?.itemComponents?.instances?.data?.[itemInstanceId];
    const itemStats = profile?.itemComponents?.stats?.data?.[itemInstanceId]?.stats;
    if (!instance) return undefined;
    return {
        ...instance,
        stats: itemStats
    };
}

export default function VaultPage() {
  const { profile, isLoading: profileLoading, isLoggedIn, membershipInfo } = useDestinyProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenCharacters, setHiddenCharacters] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // --- Settings State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { iconSize, sortMethod, vaultGrouping, setIconSize, setSortMethod, setVaultGrouping } = useSettingsStore();
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      setMounted(true);
      
      // Close settings on click outside
      const handleClickOutside = (event: MouseEvent) => {
          if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
              setIsSettingsOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Gather all Item Hashes
  const allItems = useMemo(() => {
      if (!profile) return [];
      const charItems = Object.values(profile.characterInventories?.data || {}).flatMap((c: any) => c.items);
      const equipItems = Object.values(profile.characterEquipment?.data || {}).flatMap((c: any) => c.items);
      const vaultItems = profile.profileInventory?.data?.items || [];
      return [...charItems, ...equipItems, ...vaultItems].map((i: any) => i.itemHash);
  }, [profile]);

  // 2. Fetch Definitions
  const { definitions, isLoading: defsLoading } = useItemDefinitions(allItems);

  // 3. Search Logic
  const parsedQuery = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);
  
  // Full Inventory List for Dupe Check
  const fullInventoryList = useMemo(() => {
      if (!profile) return [];
      return [
          ...Object.values(profile.characterInventories?.data || {}).flatMap((c: any) => c.items),
          ...Object.values(profile.characterEquipment?.data || {}).flatMap((c: any) => c.items),
          ...(profile.profileInventory?.data?.items || [])
      ];
  }, [profile]);

  const checkMatch = useCallback((item: any) => {
      if (!searchQuery) return true;
      const def = definitions[item.itemHash];
      const instance = profile?.itemComponents?.instances?.data?.[item.itemInstanceId];
      return checkItemMatch(item, def, parsedQuery, instance, fullInventoryList);
  }, [searchQuery, definitions, profile, parsedQuery, fullInventoryList]);

  // Data accessor callbacks for VaultGrid
  const getInstanceData = useCallback((itemInstanceId: string) => {
      return getInstanceDataWithStats(profile, itemInstanceId);
  }, [profile]);

  const getSocketsData = useCallback((itemInstanceId: string) => {
      return profile?.itemComponents?.sockets?.data?.[itemInstanceId];
  }, [profile]);

  const getReusablePlugs = useCallback((itemInstanceId: string) => {
      return profile?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs;
  }, [profile]);

  // 4. Sort Logic
  const sortItems = (items: any[]) => {
      return [...items].sort((a, b) => {
          const defA = definitions[a.itemHash];
          const defB = definitions[b.itemHash];
          const instanceA = profile?.itemComponents?.instances?.data?.[a.itemInstanceId];
          const instanceB = profile?.itemComponents?.instances?.data?.[b.itemInstanceId];

          if (!defA || !defB) return 0;

          switch (sortMethod) {
              case 'power':
                  const powerA = instanceA?.primaryStat?.value || 0;
                  const powerB = instanceB?.primaryStat?.value || 0;
                  return powerB - powerA; // Descending
              case 'name':
                  return (defA.displayProperties?.name || "").localeCompare(defB.displayProperties?.name || "");
              case 'rarity':
                  // Tier type: Exotic (6) > Legendary (5) ...
                  const tierA = defA.inventory?.tierType || 0;
                  const tierB = defB.inventory?.tierType || 0;
                  return tierB - tierA; // Descending
              // Newest requires instance data state index? Or just keep API order which is roughly age?
              // Bungie API order isn't strictly age. Without itemInstanceId creation date (not available), 
              // we can't sort strictly by age easily without tracking it.
              // Let's treat 'newest' as just preserving API order (which is often join order) or fallback to Power.
              case 'newest':
                  return 0; // Keep original order
              default:
                  return 0;
          }
      });
  };

  // Determine CSS class for Icon Size
  const iconSizeClass = {
      'small': 'w-16 h-16',
      'medium': 'w-20 h-20',
      'large': 'w-24 h-24'
  }[iconSize];

  // Equipped is usually larger, but maybe we scale it too?
  // Let's keep Equipped distinguishable (slightly larger than chosen size or fixed large)
  // For now, let's make equipped 1 step larger than inventory if possible, or fixed 'w-16 h-16' / 'w-20 h-20'
  const equippedSizeClass = {
      'small': 'w-20 h-20',
      'medium': 'w-24 h-24', // Original default
      'large': 'w-32 h-32'
  }[iconSize];

  const columnWidthClass = {
      'small': 'w-72',
      'medium': 'w-[360px]',
      'large': 'w-[440px]'
  }[iconSize];

  // Size-based styles for grid gaps
  const gapClass = {
      'small': 'gap-1',
      'medium': 'gap-1',
      'large': 'gap-1'
  }[iconSize];

  // --- Drag and Drop Handlers ---
  const { addOperation, removeOperation, pendingOperations } = useTransferStore();

  const handleDrop = async (e: React.DragEvent, targetOwnerId: string, bucketHash?: number) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      
      try {
          const { itemHash, itemInstanceId, ownerId: fromOwnerId } = JSON.parse(data);
          
          if (!itemInstanceId || !membershipInfo) return;
          if (fromOwnerId === targetOwnerId) return;

          const character = Object.values(profile?.characters?.data || {}).find((c: any) => c.characterId === targetOwnerId);
          const classNames = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
          // @ts-ignore
          const targetName = targetOwnerId === 'VAULT' ? 'Vault' : (character ? classNames[character.classType] : 'Character');

          // Optimistic UI: Add to store
          // We add the minimal data needed for the UI to render the ghost item
          // Note: We don't have the full item structure here from the drag data easily unless we passed it all.
          // But we can try to find it in the current rendered lists if needed, or just pass what we have.
          // Actually, the drag data included `def` maybe? No, we limited it.
          // Let's find the item in our existing lists to pass it to the store for optimistic rendering.
          // We can scan allItems list or just use the hook's knowledge if we had it.
          // Since we don't have easy access to the full item object here without scanning, 
          // we'll rely on the fact that we can find it in the profile data.
          
          let fullItem: any = null;
          // Quick scan to find the item object
          const allItemsList = [
              ...Object.values(profile?.characterInventories?.data || {}).flatMap((c: any) => c.items),
              ...Object.values(profile?.characterEquipment?.data || {}).flatMap((c: any) => c.items),
              ...(profile?.profileInventory?.data?.items || [])
          ];
          fullItem = allItemsList.find((i: any) => i.itemInstanceId === itemInstanceId);

          addOperation({
              itemHash,
              itemInstanceId,
              fromOwnerId,
              toOwnerId: targetOwnerId,
              item: fullItem || {}, 
              type: 'transfer',
              bucketHash // Pass the bucket hash so we know where to render it optimistically
          });

          const promise = (async () => {
              try {
                 await moveItem(itemInstanceId, itemHash, fromOwnerId, targetOwnerId, membershipInfo.membershipType);
                 // Wait a bit for SWR or manual refresh (not implemented yet)
                 // In a real app, we'd mutate SWR here.
                 setTimeout(() => removeOperation(itemInstanceId), 2000); 
              } catch (err) {
                 // If failed, remove operation immediately so it "bounces back"
                 removeOperation(itemInstanceId);
                 throw err;
              }
          })();

          toast.promise(promise, {
              loading: `Transferring to ${targetName}...`,
              success: `Moved to ${targetName}`,
              error: 'Transfer failed'
          });

      } catch (e) {
          console.error("Drop parsing error", e);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };


  // Prevent hydration mismatch
  if (!mounted) return null;

  if (!isLoggedIn) return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <div className="text-slate-400">Please login to view gear.</div>
          <button
              onClick={() => loginWithBungie()}
              className="px-6 py-2 bg-destiny-gold text-slate-900 font-bold uppercase tracking-widest hover:bg-white transition-colors rounded-sm"
          >
              Login
          </button>
      </div>
  );
  if (profileLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;

  const characters = profile?.characters?.data ? Object.values(profile.characters.data) : [];
  const vaultItems = (profile?.profileInventory?.data?.items || []).filter((item: any) => item.bucketHash === 138197802);

  // Group Vault Items by Type
  const groupedVault: Record<number, any[]> = {};
  vaultItems.forEach((item: any) => {
      const def = definitions[item.itemHash];
      if (def?.inventory?.bucketTypeHash) {
          const bucket = def.inventory.bucketTypeHash;
          if (!groupedVault[bucket]) groupedVault[bucket] = [];
          groupedVault[bucket].push(item);
      }
  });

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-white/5 backdrop-blur-md shrink-0 sticky top-16 z-50">
             <div className="flex items-center gap-6">
                 <h1 className="text-xl font-bold text-white uppercase tracking-wide">Gear Manager</h1>
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
                                             {method}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             {/* Vault Grouping */}
                             <div>
                                 <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-2">Group Vault By</h3>
                                 <div className="flex gap-2">
                                     <button
                                         onClick={() => setVaultGrouping({ byRarity: !vaultGrouping.byRarity })}
                                         className={cn(
                                             "px-3 py-1.5 text-xs uppercase font-bold border transition-colors flex-1",
                                             vaultGrouping.byRarity 
                                                ? "bg-destiny-gold text-black border-destiny-gold" 
                                                : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30"
                                         )}
                                     >
                                         Rarity
                                     </button>
                                     <button
                                         onClick={() => setVaultGrouping({ byClass: !vaultGrouping.byClass })}
                                         className={cn(
                                             "px-3 py-1.5 text-xs uppercase font-bold border transition-colors flex-1",
                                             vaultGrouping.byClass
                                                ? "bg-destiny-gold text-black border-destiny-gold" 
                                                : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30"
                                         )}
                                     >
                                         Class
                                     </button>
                                 </div>
                             </div>

                         </div>
                     )}
             </div>
             
             <div className="relative w-96">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                 <input 
                    type="text" 
                    placeholder="Search items..." 
                    className="w-full bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-destiny-gold/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
                 </div>
             </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
             {/* Character Headers Row - Sticky */}
             <div className="sticky top-0 z-20 backdrop-blur-lg pb-2 mb-4">
                 <div className="flex gap-2">
                     {/* Character Headers */}
                     {characters.map((char: any) => {
                         const charId = char.characterId;
                         const isHidden = hiddenCharacters.includes(charId);
                         
                         return (
                             <div 
                                 key={charId} 
                                 className={cn(
                                     "shrink-0 transition-all",
                                     columnWidthClass,
                                     isHidden && "opacity-50"
                                 )}
                             >
                                 <CharacterHeader
                                     character={{
                                         characterId: charId,
                                         classType: char.classType,
                                         light: char.light,
                                         emblemBackgroundPath: char.emblemBackgroundPath,
                                         titleRecordHash: char.titleRecordHash,
                                     }}
                                     isHidden={isHidden}
                                     onToggleVisibility={() => {
                                         setHiddenCharacters(prev => 
                                             prev.includes(charId) 
                                                 ? prev.filter(id => id !== charId)
                                                 : [...prev, charId]
                                         );
                                     }}
                                 />
                             </div>
                         );
                     })}
                     
                     {/* Vault Header */}
                     <div className="flex-1 min-w-[200px]">
                         <div className="relative h-[72px] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-white/5 overflow-hidden">
                             <div className="absolute inset-0 bg-[url('/vault-pattern.svg')] opacity-5" />
                             <div className="relative z-10 flex flex-col justify-center p-3 h-full">
                                 <div className="flex items-center justify-between gap-4">
                                     <div className="flex items-center gap-2">
                                         <Archive className="w-7 h-7 text-slate-400" />
                                         <span className="font-bold text-white text-base tracking-wide uppercase">
                                             Vault
                                         </span>
                                     </div>
                                     <div className="flex items-center gap-1">
                                         <span className="text-slate-300 text-xl font-bold tabular-nums">
                                             {vaultItems.length}
                                         </span>
                                         <span className="text-slate-500 text-sm">/500</span>
                                     </div>
                                 </div>
                                 <div className="mt-1">
                                     <span className="text-xs text-slate-500 uppercase tracking-wider">
                                         General Storage
                                     </span>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
             
             {/* Sections by Slot Category (Weapons, Armor) */}
             {ORDERED_SLOTS.map(category => (
                 <div key={category.id} className="mb-8">
                     <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
                         {category.label}
                     </h2>
                     
                     {/* Bucket Rows */}
                     {category.buckets.map(bucketHash => {
                         let bucketName = "Unknown";
                         if (bucketHash === BUCKETS.KINETIC) bucketName = "Kinetic Weapons";
                         if (bucketHash === BUCKETS.ENERGY) bucketName = "Energy Weapons";
                         if (bucketHash === BUCKETS.POWER) bucketName = "Power Weapons";
                         if (bucketHash === BUCKETS.HELMET) bucketName = "Helmet";
                         if (bucketHash === BUCKETS.GAUNTLETS) bucketName = "Gauntlets";
                         if (bucketHash === BUCKETS.CHEST) bucketName = "Chest Armor";
                         if (bucketHash === BUCKETS.LEGS) bucketName = "Leg Armor";
                         if (bucketHash === BUCKETS.CLASS) bucketName = "Class Item";

                         // Vault items for this bucket
                         let vItems = groupedVault[bucketHash] || [];
                         
                         // OPTIMISTIC UI: Add pending items TO vault
                         const pendingToVault = pendingOperations.filter(op => 
                            op.toOwnerId === 'VAULT' && 
                            op.bucketHash === bucketHash &&
                            !vItems.some(i => i.itemInstanceId === op.itemInstanceId)
                         ).map(op => ({ ...op.item, itemInstanceId: op.itemInstanceId, itemHash: op.itemHash })); // Ensure structure

                         vItems = [...vItems, ...pendingToVault];

                         // OPTIMISTIC UI: Remove pending items FROM vault
                         vItems = vItems.filter(i => !pendingOperations.some(op => op.itemInstanceId === i.itemInstanceId && op.fromOwnerId === 'VAULT'));

                         // Filter Vault Items if Hiding
                         if (parsedQuery.hideNonMatches) {
                             vItems = vItems.filter((item: any) => checkMatch(item));
                         }

                         const sortedVItems = sortItems(vItems);

                         return (
                             <div key={bucketHash} className="flex gap-2 mb-2 min-h-[120px]">
                                 {/* Character Columns */}
                                 {characters.map((char: any) => {
                                     if (hiddenCharacters.includes(char.characterId)) return null;
                                     
                                     const charId = char.characterId;
                                     let equipped = (profile?.characterEquipment?.data?.[charId]?.items || [])
                                        .find((i: any) => i.bucketHash === bucketHash);
                                     
                                     // Filter Equipped if Hiding
                                     if (equipped && parsedQuery.hideNonMatches && !checkMatch(equipped)) {
                                         equipped = null;
                                     }

                                     // Inventory for this bucket
                                     let inventory = (profile?.characterInventories?.data?.[charId]?.items || [])
                                        .filter((i: any) => i.bucketHash === bucketHash);
                                     
                                     // OPTIMISTIC UI: Add pending items TO this character
                                     const pendingToChar = pendingOperations.filter(op => 
                                        op.toOwnerId === charId && 
                                        op.bucketHash === bucketHash && 
                                        !inventory.some((i: any) => i.itemInstanceId === op.itemInstanceId)
                                     ).map(op => ({ ...op.item, itemInstanceId: op.itemInstanceId, itemHash: op.itemHash }));
                                     
                                     inventory = [...inventory, ...pendingToChar];

                                     // OPTIMISTIC UI: Remove pending items FROM this character
                                     inventory = inventory.filter((i: any) => !pendingOperations.some(op => op.itemInstanceId === i.itemInstanceId && op.fromOwnerId === charId));

                                     // Filter Inventory if Hiding
                                     if (parsedQuery.hideNonMatches) {
                                         inventory = inventory.filter((item: any) => checkMatch(item));
                                     }

                                     const sortedInventory = sortItems(inventory);

                                    return (
                                        <div 
                                            key={charId} 
                                            className={cn(
                                                "shrink-0 flex gap-1 p-1 transition-all border border-transparent rounded-sm", 
                                                "hover:border-white/5 hover:bg-white/5", // Drop zone hint on hover
                                                columnWidthClass // Match header width
                                            )}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, charId, bucketHash)}
                                        >
                                             {/* Equipped (Large) */}
                                           <div className={cn("shrink-0 flex flex-col gap-1", equippedSizeClass.replace('h-', 'w-'))}> 
                                               {/* Equipped Item */}
                                               {equipped ? (
                                                   <DestinyItemCard 
                                                      itemHash={equipped.itemHash}
                                                      instanceData={getInstanceDataWithStats(profile, equipped.itemInstanceId)}
                                                      socketsData={profile?.itemComponents?.sockets?.data?.[equipped.itemInstanceId]}
                                                      reusablePlugs={profile?.itemComponents?.reusablePlugs?.data?.[equipped.itemInstanceId]?.plugs}
                                                      className={equippedSizeClass}
                                                      isHighlighted={checkMatch(equipped)}
                                                      itemInstanceId={equipped.itemInstanceId}
                                                      ownerId={char.characterId}
                                                      size={iconSize}
                                                   />
                                               ) : (
                                                   <div className={cn("bg-black/20 border border-white/5", equippedSizeClass)} />
                                               )}
                                           </div>
                                            
                                            {/* Inventory (Grid) */}
                                            <div className={cn("grid grid-cols-3 gap-1 content-start w-auto", gapClass)}>
                                                {sortedInventory.map((item: any, idx: number) => (
                                                    <DestinyItemCard 
                                                       key={`${item.itemHash}-${idx}`}
                                                       itemHash={item.itemHash}
                                                       instanceData={getInstanceDataWithStats(profile, item.itemInstanceId)}
                                                       socketsData={profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                                       reusablePlugs={profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs}
                                                       className={iconSizeClass}
                                                       isHighlighted={checkMatch(item)}
                                                       itemInstanceId={item.itemInstanceId}
                                                       ownerId={char.characterId}
                                                       size={iconSize}
                                                    />
                                                ))}
                                                {/* Fill empty slots visual (optional) */}
                                                {Array.from({ length: Math.max(0, 9 - inventory.length) }).map((_, i) => (
                                                    <div key={i} className={cn("bg-black/10 border border-white/5", iconSizeClass)} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {/* Vault Column for this bucket */}
                                 <div 
                                    className="flex-1 p-1 border border-transparent rounded-sm hover:border-white/5 hover:bg-white/5 transition-colors ml-4"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, "VAULT", bucketHash)}
                                 >
                                    <div className="text-xs text-slate-500 uppercase mb-1 font-bold">{bucketName} (Vault)</div>
                                     
                                     {/* Virtualized Vault Grid with grouping support */}
                                     {(() => {
                                         const tierNames: Record<number, string> = { 6: 'Exotic', 5: 'Legendary', 4: 'Rare', 3: 'Common', 2: 'Basic' };
                                         const tierColors: Record<number, string> = { 
                                             6: 'text-yellow-400', 
                                             5: 'text-purple-400', 
                                             4: 'text-blue-400',
                                             3: 'text-slate-500',
                                             2: 'text-slate-500'
                                         };
                                         const classNames: Record<number, string> = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock', 3: 'General' };

                                         // 1. No grouping - use VaultGrid directly
                                         if (!vaultGrouping.byRarity && !vaultGrouping.byClass) {
                                            return (
                                                <VaultGrid
                                                    items={sortedVItems}
                                                    iconSize={iconSize}
                                                    ownerId="VAULT"
                                                    checkMatch={checkMatch}
                                                    getInstanceData={getInstanceData}
                                                    getSocketsData={getSocketsData}
                                                    getReusablePlugs={getReusablePlugs}
                                                    gap={1}
                                                />
                                            );
                                         }

                                         // 2. Group by Rarity ONLY
                                         if (vaultGrouping.byRarity && !vaultGrouping.byClass) {
                                             const groups = [6, 5, 4, 3, 2].map(tier => ({
                                                 key: tier,
                                                 label: tierNames[tier],
                                                 labelClassName: tierColors[tier],
                                                 items: sortedVItems.filter((item: any) => 
                                                     (definitions[item.itemHash]?.inventory?.tierType || 0) === tier
                                                 )
                                             })).filter(g => g.items.length > 0);

                                             return (
                                                 <GroupedVaultGrid
                                                     groups={groups}
                                                     iconSize={iconSize}
                                                     ownerId="VAULT"
                                                     checkMatch={checkMatch}
                                                     getInstanceData={getInstanceData}
                                                     getSocketsData={getSocketsData}
                                                     getReusablePlugs={getReusablePlugs}
                                                     gap={1}
                                                 />
                                             );
                                         }

                                         // 3. Group by Class ONLY
                                         if (!vaultGrouping.byRarity && vaultGrouping.byClass) {
                                             const groups = [0, 1, 2, 3].map(cls => ({
                                                 key: cls,
                                                 label: classNames[cls],
                                                 labelClassName: 'text-slate-500',
                                                 items: sortedVItems.filter((item: any) => {
                                                     const def = definitions[item.itemHash];
                                                     return (def?.classType ?? 3) === cls;
                                                 })
                                             })).filter(g => g.items.length > 0);

                                             return (
                                                 <GroupedVaultGrid
                                                     groups={groups}
                                                     iconSize={iconSize}
                                                     ownerId="VAULT"
                                                     checkMatch={checkMatch}
                                                     getInstanceData={getInstanceData}
                                                     getSocketsData={getSocketsData}
                                                     getReusablePlugs={getReusablePlugs}
                                                     gap={1}
                                                 />
                                             );
                                         }

                                         // 4. Group by BOTH (Class -> Rarity) - nested structure
                                         if (vaultGrouping.byRarity && vaultGrouping.byClass) {
                                             return (
                                                 <div className="flex flex-col gap-8 min-h-[60px]">
                                                     {[0, 1, 2, 3].map(cls => {
                                                         const clsItems = sortedVItems.filter((item: any) => {
                                                             const def = definitions[item.itemHash];
                                                             return (def?.classType ?? 3) === cls;
                                                         });
                                                         
                                                         if (clsItems.length === 0) return null;

                                                         const tierGroups = [6, 5, 4, 3, 2].map(tier => ({
                                                             key: `${cls}-${tier}`,
                                                             label: tierNames[tier],
                                                             labelClassName: tierColors[tier],
                                                             items: clsItems.filter((item: any) => 
                                                                 (definitions[item.itemHash]?.inventory?.tierType || 0) === tier
                                                             )
                                                         })).filter(g => g.items.length > 0);

                                                         return (
                                                             <div key={cls} className="pl-2 border-l border-white/5">
                                                                 <h4 className="text-[10px] uppercase font-bold text-slate-300 mb-2">
                                                                     {classNames[cls]}
                                                                 </h4>
                                                                 <GroupedVaultGrid
                                                                     groups={tierGroups}
                                                                     iconSize={iconSize}
                                                                     ownerId="VAULT"
                                                                     checkMatch={checkMatch}
                                                                     getInstanceData={getInstanceData}
                                                                     getSocketsData={getSocketsData}
                                                                     getReusablePlugs={getReusablePlugs}
                                                                     gap={1}
                                                                 />
                                                             </div>
                                                         );
                                                     })}
                                                 </div>
                                             );
                                         }

                                         return null;
                                     })()}
                                </div>
                             </div>
                         );
                     })}
                 </div>
             ))}
        </div>
    </div>
  );
}
