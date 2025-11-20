'use client';

import { PageHeader } from "@/components/PageHeader";
import { DestinyItemCard } from "@/components/DestinyItemCard";
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { useItemDefinitions, ItemDefinition } from "@/hooks/useItemDefinitions";
import { Loader2, Search, X, Eye, EyeOff, Settings } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { getBungieImage, moveItem } from "@/lib/bungie";
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

const getClassName = (classType: number) => {
    switch(classType) {
        case 0: return 'Titan';
        case 1: return 'Hunter';
        case 2: return 'Warlock';
        default: return 'Unknown';
    }
};

import { loginWithBungie } from "@/lib/bungie";
import { useTransferStore } from "@/store/transferStore";
import { useSettingsStore } from "@/store/settingsStore";

export default function VaultPage() {
  const { profile, isLoading: profileLoading, isLoggedIn, membershipInfo } = useDestinyProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenCharacters, setHiddenCharacters] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // --- Settings State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { iconSize, sortMethod, setIconSize, setSortMethod } = useSettingsStore();
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
      'small': 'w-10 h-10',
      'medium': 'w-12 h-12',
      'large': 'w-16 h-16'
  }[iconSize];

  // Equipped is usually larger, but maybe we scale it too?
  // Let's keep Equipped distinguishable (slightly larger than chosen size or fixed large)
  // For now, let's make equipped 1 step larger than inventory if possible, or fixed 'w-16 h-16' / 'w-20 h-20'
  const equippedSizeClass = {
      'small': 'w-14 h-14',
      'medium': 'w-20 h-20', // Original default
      'large': 'w-24 h-24'
  }[iconSize];

  const columnWidthClass = {
      'small': 'w-56',
      'medium': 'w-72',
      'large': 'w-80'
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
        <div className="flex items-center justify-between gap-4 p-4 border-b border-white/5 backdrop-blur-md shrink-0 sticky top-16 z-20">
             <div className="flex items-center gap-6">
                 <h1 className="text-xl font-bold text-white uppercase tracking-wide">Gear Manager</h1>
                 
                 {/* Character Toggles */}
                 <div className="flex items-center gap-2">
                     {characters.map((char: any) => (
                         <button 
                            key={char.characterId}
                            onClick={() => {
                                setHiddenCharacters(prev => 
                                    prev.includes(char.characterId) 
                                        ? prev.filter(id => id !== char.characterId)
                                        : [...prev, char.characterId]
                                );
                            }}
                            className={cn(
                                "w-8 h-8 border overflow-hidden transition-all hover:scale-110",
                                hiddenCharacters.includes(char.characterId) ? "opacity-30 grayscale border-white/10" : "border-destiny-gold"
                            )}
                            title={`Toggle ${getClassName(char.classType)}`}
                         >
                             <div className="relative w-full h-full">
                                <Image 
                                    src={getBungieImage(char.emblemPath)} 
                                    fill 
                                    sizes="32px"
                                    className="object-cover" 
                                    alt="" 
                                />
                             </div>
                         </button>
                     ))}
                 </div>
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
             {/* Sections by Slot Category (Weapons, Armor) */}
             {ORDERED_SLOTS.map(category => (
                 <div key={category.id} className="mb-8">
                     <h2 className="text-lg font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 sticky top-0 z-10 py-2 backdrop-blur-sm">
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

                         const sortedVItems = sortItems(vItems);

                         return (
                             <div key={bucketHash} className="flex gap-4 mb-6 min-h-[120px]">
                                 {/* Character Columns */}
                                 {characters.map((char: any) => {
                                     if (hiddenCharacters.includes(char.characterId)) return null;
                                     
                                     const charId = char.characterId;
                                     const equipped = (profile?.characterEquipment?.data?.[charId]?.items || [])
                                        .find((i: any) => i.bucketHash === bucketHash);
                                     
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

                                     const sortedInventory = sortItems(inventory);

                                     return (
                                         <div 
                                             key={charId} 
                                             className={cn(
                                                 "shrink-0 flex gap-2 p-2 transition-all border border-transparent rounded-sm", 
                                                 "hover:border-white/5 hover:bg-white/5", // Drop zone hint on hover
                                                 columnWidthClass
                                             )}
                                             onDragOver={handleDragOver}
                                             onDrop={(e) => handleDrop(e, charId, bucketHash)}
                                         >
                                             {/* Equipped (Large) */}
                                            <div className={cn("shrink-0 flex flex-col gap-1", equippedSizeClass.replace('h-', 'w-'))}> 
                                                {/* Hack: equippedSizeClass has w-20 h-20, we just want container width to match */}
                                                {equipped ? (
                                                    <DestinyItemCard 
                                                       itemHash={equipped.itemHash}
                                                       instanceData={profile?.itemComponents?.instances?.data?.[equipped.itemInstanceId]}
                                                       socketsData={profile?.itemComponents?.sockets?.data?.[equipped.itemInstanceId]}
                                                       className={equippedSizeClass}
                                                       isHighlighted={filterItem(equipped)}
                                                       itemInstanceId={equipped.itemInstanceId}
                                                       ownerId={char.characterId}
                                                    />
                                                ) : (
                                                    <div className={cn("bg-black/20 border border-white/5", equippedSizeClass)} />
                                                )}
                                                <div className="text-[10px] text-center text-slate-500 uppercase font-bold">{getClassName(char.classType)}</div>
                                            </div>
                                            
                                            {/* Inventory (Grid) */}
                                            <div className="grid grid-cols-3 gap-1 content-start flex-1 min-h-[60px]">
                                                {sortedInventory.map((item: any, idx: number) => (
                                                    <DestinyItemCard 
                                                       key={`${item.itemHash}-${idx}`}
                                                       itemHash={item.itemHash}
                                                       instanceData={profile?.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                                       socketsData={profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                                       className={iconSizeClass}
                                                       isHighlighted={filterItem(item)}
                                                       itemInstanceId={item.itemInstanceId}
                                                       ownerId={char.characterId}
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
                                    className="flex-1 p-2 border border-transparent rounded-sm hover:border-white/5 hover:bg-white/5 transition-colors"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, "VAULT", bucketHash)}
                                 >
                                    <div className="text-xs text-slate-500 uppercase mb-2 font-bold">{bucketName} (Vault)</div>
                                     <div className="flex flex-wrap gap-1 min-h-[60px]">
                                         {sortedVItems.map((item: any, idx: number) => (
                                            <DestinyItemCard 
                                               key={`${item.itemHash}-${idx}`}
                                               itemHash={item.itemHash}
                                               instanceData={profile?.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                               socketsData={profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                                className={iconSizeClass}
                                               isHighlighted={filterItem(item)}
                                               itemInstanceId={item.itemInstanceId}
                                               ownerId="VAULT"
                                            />
                                        ))}
                                    </div>
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
