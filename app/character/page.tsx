"use client";

import { useDestinyProfile, DestinyStats } from "@/hooks/useDestinyProfile";
import { BUCKETS, CURRENCIES, MATERIALS, calculateBasePowerLevel, getBestItemsPerSlot } from "@/lib/destinyUtils";
import { DestinyItemCard } from "@/components/DestinyItemCard";
import { VaultGrid, GroupedVaultGrid } from "@/components/VaultGrid";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { getBungieImage, moveItem, equipItem, equipLoadout } from "@/lib/bungie";
import { PageHeader } from "@/components/PageHeader";
import { useTransferStore } from "@/store/transferStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { Search, Settings } from "lucide-react";
import { ItemDetailsOverlay } from "@/components/ItemDetailsOverlay";
import { LoadoutButton } from "@/components/LoadoutButton";

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

import { parseSearchQuery, checkItemMatch } from "@/lib/searchUtils";

const findCurrency = (profile: any, hash: number) => {
    let quantity = 0;
    // Profile
    quantity += profile?.profileCurrencies?.data?.items?.find((i: any) => i.itemHash === hash)?.quantity || 0;
    // Characters (rare for Glimmer/Dust but safe)
    if (profile?.characterCurrencies?.data) {
        Object.values(profile.characterCurrencies.data).forEach((charCurr: any) => {
             const item = charCurr.items?.find((i: any) => i.itemHash === hash);
             if (item) quantity += item.quantity;
        });
    }
    return quantity;
};

const findMaterialQuantity = (profile: any, hash: number | number[]) => {
    let quantity = 0;
    const hashes = Array.isArray(hash) ? hash : [hash];
    
    // 1. Profile Inventory (Vault/Shared)
    profile?.profileInventory?.data?.items?.forEach((item: any) => {
        if (hashes.includes(item.itemHash)) quantity += item.quantity;
    });

    // 2. Character Inventories
    if (profile?.characterInventories?.data) {
        Object.values(profile.characterInventories.data).forEach((charInv: any) => {
             charInv.items?.forEach((item: any) => {
                 if (hashes.includes(item.itemHash)) quantity += item.quantity;
             });
        });
    }

    // 3. Profile Currencies
    profile?.profileCurrencies?.data?.items?.forEach((item: any) => {
         if (hashes.includes(item.itemHash)) quantity += item.quantity;
    });

    // 4. Character Currencies (New Check)
    if (profile?.characterCurrencies?.data) {
        Object.values(profile.characterCurrencies.data).forEach((charCurr: any) => {
             charCurr.items?.forEach((item: any) => {
                 if (hashes.includes(item.itemHash)) quantity += item.quantity;
             });
        });
    }

    return quantity;
};
const CLASS_ICONS: Record<number, string> = {
    0: '/class-titan.svg',
    1: '/class-hunter.svg',
    2: '/class-warlock.svg',
};

function PowerListItemInternal({ itemHash, power, diff, isMax }: { itemHash: number, power: number, diff: number, isMax: boolean }) {
    const { data } = useSWR(endpoints.getItemDefinition(itemHash), fetcher, { revalidateOnFocus: false });
    const name = data?.Response?.displayProperties?.name || "Loading...";
    const icon = data?.Response?.displayProperties?.icon;

    return (
        <div className="flex justify-between items-center text-xs py-1 border-b border-white/5">
            <div className="flex items-center gap-2 overflow-hidden">
                {icon && (
                    <Image 
                        src={getBungieImage(icon)} 
                        width={16} 
                        height={16} 
                        className="object-contain" 
                        alt="" 
                    />
                )}
                <span className="truncate text-slate-300">{name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                 <span className="text-destiny-gold font-bold">♦{power}</span>
                 <span className={diff >= 0 ? "text-green-400" : "text-red-400"}>
                    {diff > 0 ? '+' : ''}{diff}
                 </span>
            </div>
        </div>
    );
}

function PowerListItem({ itemHash, power, diff, isMax }: { itemHash: number, power: number, diff: number, isMax: boolean }) {
     return (
         <PowerListItemInternal itemHash={itemHash} power={power} diff={diff} isMax={isMax} />
     );
}

// Wrapper to handle common item props - Moved outside component
function ItemCardWrapper({ item, profile, basePower, classFilter, characterId, ownerId, isHighlighted }: any) {
    const instance = profile.itemComponents?.instances?.data?.[item.itemInstanceId];
    const itemStats = profile.itemComponents?.stats?.data?.[item.itemInstanceId]?.stats;
    const { iconSize } = useSettingsStore();
    
    const diff = undefined; 

    // Merge instance data with stats for tooltip display
    const instanceDataWithStats = instance ? {
        ...instance,
        stats: itemStats
    } : undefined;

    return (
        <DestinyItemCard
            itemHash={item.itemHash}
            itemInstanceId={item.itemInstanceId}
            instanceData={instanceDataWithStats}
            socketsData={profile.itemComponents?.sockets?.data?.[item.itemInstanceId]}
            reusablePlugs={profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs}
            className="w-full h-full"
            powerDiff={diff}
            classFilter={classFilter}
            ownerId={ownerId || characterId}
            showClassSymbolOnMismatch
            size={iconSize}
            isHighlighted={isHighlighted}
        />
    );
}

function CurrencyRow({ name, value, icon }: { name: string, value: number, icon?: string }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-slate-400">
                {icon ? (
                    <Image 
                        src={getBungieImage(icon)} 
                        width={20} 
                        height={20} 
                        className="object-contain opacity-90" 
                        alt={name} 
                    />
                ) : (
                    <div className="w-5 h-5 bg-slate-800 rounded-full animate-pulse" />
                )}
                <span>{name}</span>
            </div>
            <span className="font-medium text-slate-200">{value.toLocaleString()}</span>
        </div>
    );
}

export default function CharacterPage() {
    const { profile, stats, isLoading, isLoggedIn, membershipInfo } = useDestinyProfile();
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const { addOperation, removeOperation, pendingOperations } = useTransferStore();
    const { setDetailsItem } = useUIStore();
    const [mounted, setMounted] = useState(false);
    
    // Settings & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { iconSize, sortMethod, vaultGrouping, setIconSize, setSortMethod, setVaultGrouping } = useSettingsStore();
    const settingsRef = useRef<HTMLDivElement>(null);

    const sizeConfig = useMemo(() => ({
        small: { class: 'w-16 h-16', containerWidth: 'w-[208px]' },
        medium: { class: 'w-20 h-20', containerWidth: 'w-[256px]' },
        large: { class: 'w-24 h-24', containerWidth: 'w-[304px]' }
    }[iconSize] || { class: 'w-20 h-20', containerWidth: 'w-[256px]' }), [iconSize]);

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

    // 1. Gather all Item Hashes for Definitions & Dupe Check
    const { allItemHashes, fullInventoryList } = useMemo(() => {
        if (!profile) return { allItemHashes: [], fullInventoryList: [] };
        
        const charItems = Object.values(profile.characterInventories?.data || {}).flatMap((c: any) => c.items);
        const equipItems = Object.values(profile.characterEquipment?.data || {}).flatMap((c: any) => c.items);
        const vaultItems = profile.profileInventory?.data?.items || [];
        
        const allItems = [...charItems, ...equipItems, ...vaultItems];
        const hashes = allItems.map((i: any) => i.itemHash);
        
        return { allItemHashes: hashes, fullInventoryList: allItems };
    }, [profile]);

    const { definitions: allDefs } = useItemDefinitions(allItemHashes);
    // Alias vaultDefs to allDefs for compatibility (or just use allDefs)
    const vaultDefs = allDefs; 

    // Search Logic
    const parsedQuery = useMemo(() => parseSearchQuery(searchQuery), [searchQuery]);

    const checkMatch = useCallback((item: any) => {
        if (!searchQuery) return true;
        const def = allDefs[item.itemHash];
        const instance = profile?.itemComponents?.instances?.data?.[item.itemInstanceId];
        return checkItemMatch(item, def, parsedQuery, instance, fullInventoryList);
    }, [searchQuery, allDefs, profile, parsedQuery, fullInventoryList]);

    // Data accessor callbacks for VaultGrid
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

    // Default to active character from stats
    const activeCharacterId = selectedCharacterId || stats?.characterId;
    const characters = profile?.characters?.data ? Object.values(profile.characters.data) : [];
    // const activeCharacter = characters.find((c: any) => c.characterId === activeCharacterId);
    // Active class type calculation moved inside useMemo to prevent hook conditional changes if needed, 
    // but here it's just value derivation.
    const activeClassType = useMemo(() => {
        const char = characters.find((c: any) => c.characterId === activeCharacterId);
        return (char as any)?.classType ?? stats?.classType;
    }, [characters, activeCharacterId, stats]);

    // Calculate Base Power Level & Best Items
    const { basePowerLevel, bestItems } = useMemo(() => {
        if (!activeCharacterId || !profile) return { basePowerLevel: 0, bestItems: null };
        
        const bpl = calculateBasePowerLevel(
            activeCharacterId,
            profile.characterEquipment?.data,
            profile.characterInventories?.data,
            profile.itemComponents?.instances?.data
        );

        const best = getBestItemsPerSlot(
            activeCharacterId,
            profile.characterEquipment?.data,
            profile.characterInventories?.data,
            profile.itemComponents?.instances?.data
        );

        return { basePowerLevel: bpl, bestItems: best };
    }, [activeCharacterId, profile]);

    const handleDrop = async (e: React.DragEvent, targetOwnerId: string, bucketHash?: number) => {
        e.preventDefault();
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        
        try {
            const { itemHash, itemInstanceId, ownerId: fromOwnerId } = JSON.parse(dataStr);
            
            if (!itemInstanceId || !membershipInfo) return;
            if (fromOwnerId === targetOwnerId) return;
  
            const character = Object.values(profile?.characters?.data || {}).find((c: any) => c.characterId === targetOwnerId);
            const classNames: Record<number, string> = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
            const targetName = targetOwnerId === 'VAULT' ? 'Vault' : (character ? classNames[(character as any).classType] : 'Character');
  
            // Find full item for optimistic UI
            const allItemsList = [
                ...Object.values(profile?.characterInventories?.data || {}).flatMap((c: any) => c.items),
                ...Object.values(profile?.characterEquipment?.data || {}).flatMap((c: any) => c.items),
                ...(profile?.profileInventory?.data?.items || [])
            ];
            const fullItem = allItemsList.find((i: any) => i.itemInstanceId === itemInstanceId);
  
            addOperation({
                itemHash,
                itemInstanceId,
                fromOwnerId,
                toOwnerId: targetOwnerId,
                item: fullItem || {}, 
                type: 'transfer',
                bucketHash 
            });
  
            const promise = (async () => {
                try {
                   await moveItem(itemInstanceId, itemHash, fromOwnerId, targetOwnerId, membershipInfo.membershipType);
                   setTimeout(() => removeOperation(itemInstanceId), 2000); 
                } catch (err) {
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

    // Currencies & Materials Calculation
    const glimmer = findCurrency(profile, CURRENCIES.GLIMMER);
    const brightDust = findCurrency(profile, CURRENCIES.BRIGHT_DUST);
    const cores = findMaterialQuantity(profile, MATERIALS.ENHANCEMENT_CORE);
    const prisms = findMaterialQuantity(profile, MATERIALS.ENHANCEMENT_PRISM);
    const shards = findMaterialQuantity(profile, MATERIALS.ASCENDANT_SHARD);
    const alloys = findMaterialQuantity(profile, MATERIALS.ASCENDANT_ALLOY);
    const strangeCoins = findMaterialQuantity(profile, [MATERIALS.STRANGE_COIN, MATERIALS.STRANGE_COIN_XUR]);

    // Fetch Currency Definitions for Icons
    const currencyHashes = useMemo(() => [
        CURRENCIES.GLIMMER,
        CURRENCIES.BRIGHT_DUST,
        MATERIALS.ENHANCEMENT_CORE,
        MATERIALS.ENHANCEMENT_PRISM,
        MATERIALS.ASCENDANT_SHARD,
        MATERIALS.ASCENDANT_ALLOY,
        MATERIALS.STRANGE_COIN,
        MATERIALS.STRANGE_COIN_XUR
    ], []);
    
    const { definitions: currencyDefs } = useItemDefinitions(currencyHashes);
    
    // Resolve Strange Coin Icon (Try both, prefer primary)
    const strangeCoinIcon = currencyDefs[MATERIALS.STRANGE_COIN]?.displayProperties?.icon || currencyDefs[MATERIALS.STRANGE_COIN_XUR]?.displayProperties?.icon;

    // Helper to get items for a specific bucket with optimistic updates
    // We memoize this or just define it. Since it depends on many changing props, careful with memo.
    // But defining it as a function inside render is fine as long as we don't use it in hooks deps unwisely.
    const getSectionItems = (bucketHash: number) => {
        if (!activeCharacterId || !profile) return { equipped: undefined, inventory: [], vault: [] };

        const characterInventory = profile.characterInventories?.data?.[activeCharacterId]?.items || [];
        const characterEquipment = profile.characterEquipment?.data?.[activeCharacterId]?.items || [];
        const profileInventory = profile.profileInventory?.data?.items || []; // Vault

        const equipped = characterEquipment.find((i: any) => i.bucketHash === bucketHash);
        let inventory = characterInventory.filter((i: any) => i.bucketHash === bucketHash);
        
        // Filter Vault Items using Definitions
        let vault = profileInventory.filter((i: any) => {
            const def = vaultDefs[i.itemHash];
            return def?.inventory?.bucketTypeHash === bucketHash;
        });
        
        // Apply Pending Operations
        const pendingToChar = pendingOperations.filter(op => 
            op.toOwnerId === activeCharacterId && 
            op.bucketHash === bucketHash && 
            !inventory.some((i: any) => i.itemInstanceId === op.itemInstanceId)
        ).map(op => ({ ...op.item, itemInstanceId: op.itemInstanceId, itemHash: op.itemHash }));
        
        inventory = [...inventory, ...pendingToChar];
        inventory = inventory.filter((i: any) => !pendingOperations.some(op => op.itemInstanceId === i.itemInstanceId && op.fromOwnerId === activeCharacterId));

        const pendingToVault = pendingOperations.filter(op => 
            op.toOwnerId === 'VAULT' && 
            op.bucketHash === bucketHash &&
            !vault.some((i: any) => i.itemInstanceId === op.itemInstanceId)
        ).map(op => ({ ...op.item, itemInstanceId: op.itemInstanceId, itemHash: op.itemHash }));

        vault = [...vault, ...pendingToVault];
        vault = vault.filter((i: any) => !pendingOperations.some(op => op.itemInstanceId === i.itemInstanceId && op.fromOwnerId === 'VAULT'));

        // Filter Vault Items based on Search (AND HIDE IF 'h:' is used)
        if (searchQuery && parsedQuery.hideNonMatches) {
            vault = vault.filter((item: any) => checkMatch(item));
        }

        // Sort Vault Items
        vault = vault.sort((a: any, b: any) => {
            const defA = vaultDefs[a.itemHash];
            const defB = vaultDefs[b.itemHash];
            const instanceA = profile?.itemComponents?.instances?.data?.[a.itemInstanceId];
            const instanceB = profile?.itemComponents?.instances?.data?.[b.itemInstanceId];

            switch (sortMethod) {
                case 'power':
                    return (instanceB?.primaryStat?.value || 0) - (instanceA?.primaryStat?.value || 0);
                case 'name':
                    return (defA?.displayProperties?.name || "").localeCompare(defB?.displayProperties?.name || "");
                case 'rarity':
                    return (defB?.inventory?.tierType || 0) - (defA?.inventory?.tierType || 0);
                default:
                    return 0;
            }
        });

        return { equipped, inventory, vault };
    };

    if (!mounted) return null; 
    if (isLoading) return <div className="p-8 text-center">Loading Character Data...</div>;
    if (!isLoggedIn) return <div className="p-8 text-center">Please log in to view character data.</div>;
    if (!profile || !activeCharacterId) return <div className="p-8 text-center">No character data found.</div>;

    const sections = [
        { name: "Kinetic Weapons", bucket: BUCKETS.KINETIC_WEAPON },
        { name: "Energy Weapons", bucket: BUCKETS.ENERGY_WEAPON },
        { name: "Power Weapons", bucket: BUCKETS.POWER_WEAPON },
        { name: "Helmet", bucket: BUCKETS.HELMET },
        { name: "Gauntlets", bucket: BUCKETS.GAUNTLETS },
        { name: "Chest Armor", bucket: BUCKETS.CHEST_ARMOR }, 
        { name: "Leg Armor", bucket: BUCKETS.LEG_ARMOR },
        { name: "Class Item", bucket: BUCKETS.CLASS_ARMOR },
    ];

    const characterInventory = profile.characterInventories?.data?.[activeCharacterId]?.items || [];
    const profileInventory = profile.profileInventory?.data?.items || []; // Vault
    
    const engrams = [...characterInventory, ...profileInventory].filter((i: any) => i.bucketHash === BUCKETS.ENGRAMS);
    
    // Subclasses
    const characterEquipment = profile.characterEquipment?.data?.[activeCharacterId]?.items || [];
    const subclassEquipped = characterEquipment.filter((i: any) => i.bucketHash === BUCKETS.SUBCLASS); 
    const subclassInv = characterInventory.filter((i: any) => i.bucketHash === BUCKETS.SUBCLASS);
    const allSubclasses = [...subclassEquipped, ...subclassInv];
    
    const loadouts = profile.characterLoadouts?.data?.[activeCharacterId]?.loadouts || [];
    const postmasterItems = profile.characterInventories?.data?.[activeCharacterId]?.items?.filter((i: any) => i.bucketHash === BUCKETS.LOST_ITEMS) || [];

    return (
        <div className="min-h-screen text-white font-sans flex overflow-hidden">
            {/* Main Content Area (Left) */}
            <div className="flex-1 p-4 overflow-y-auto h-screen scrollbar-thin scrollbar-thumb-slate-800">
                
                {/* Top Section: Subclass, Search & Settings */}
                <div className="flex gap-6 mb-8 items-end justify-between relative z-20 py-4 -mx-4 px-4">
                    
                    <div className="flex items-center gap-6">
                         {/* Character Selector */}
                         <div className="flex items-center gap-2">
                             {characters.map((char: any) => (
                                 <button 
                                    key={char.characterId}
                                    onClick={() => setSelectedCharacterId(char.characterId)}
                                    className={cn(
                                        "w-10 h-10 border-2 overflow-hidden transition-all hover:scale-105",
                                        activeCharacterId === char.characterId 
                                            ? "border-destiny-gold shadow-[0_0_10px_rgba(227,206,98,0.4)] scale-110 z-10" 
                                            : "border-white/20 opacity-50 hover:opacity-100 grayscale hover:grayscale-0"
                                    )}
                                    title={`Switch to ${char.classType === 0 ? 'Titan' : char.classType === 1 ? 'Hunter' : 'Warlock'}`}
                                >
                                    <div className="relative w-full h-full">
                                        {/* Background */}
                                        <Image 
                                            src={getBungieImage(char.emblemBackgroundPath)} 
                                            alt="Character"
                                            fill
                                            sizes="40px"
                                            className="object-cover opacity-80 hover:opacity-100 transition-opacity" 
                                        />
                                        {/* Class Icon */}
                                        <div className="absolute inset-0 flex items-center justify-center z-10">
                                            <Image 
                                                src={CLASS_ICONS[char.classType]} 
                                                width={24} 
                                                height={24} 
                                                className="object-contain drop-shadow-md" 
                                                alt="" 
                                            />
                                        </div>
                                    </div>
                                </button>
                             ))}
                         </div>

                        {/* Subclass List */}
                        <div className="flex items-center gap-2 shrink-0 border-l border-white/10 pl-6">
                            {allSubclasses.map((item: any) => (
                                 <div 
                                    key={item.itemInstanceId} 
                                    className={cn(sizeConfig.class, "cursor-pointer transition-transform hover:scale-105 hover:brightness-110")}
                                    onClick={() => setDetailsItem(item)}
                                    title="Click to Inspect"
                                 >
                                    <DestinyItemCard
                                        itemHash={item.itemHash}
                                        itemInstanceId={item.itemInstanceId}
                                        instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                        socketsData={profile.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                        reusablePlugs={profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs}
                                        className="w-full h-full"
                                        hideBorder={true}
                                        hidePower={true}
                                        hideTooltipPower={true}
                                        ownerId={activeCharacterId}
                                        size={iconSize}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 max-w-md relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                           type="text" 
                           placeholder="Filter Vault Items..." 
                           className="w-full bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-destiny-gold/50 rounded-sm"
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Settings Gear */}
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
                                         <button
                                             onClick={() => setVaultGrouping({ byTier: !vaultGrouping.byTier })}
                                             className={cn(
                                                 "px-3 py-1.5 text-xs uppercase font-bold border transition-colors flex-1",
                                                 vaultGrouping.byTier
                                                    ? "bg-destiny-gold text-black border-destiny-gold" 
                                                    : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30"
                                             )}
                                         >
                                             Tier
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         )}
                     </div>

                </div>

                {/* Equipment Sections */}
                <div className="flex flex-col gap-8">
                    {sections.map((section, idx) => {
                        const { equipped, inventory, vault } = getSectionItems(section.bucket);
                        
                        const inventorySlots = Array.from({ length: 9 });
                        
                        return (
                            <div key={section.name} className="flex relative min-h-[64px]">
                                {/* Section Label (Moved to Vault Area sort of) */}
                                {/* We keep empty left column for alignment but move text to Vault area */}
                                <div className="w-12 shrink-0 pt-1 pr-2 text-right">
                                    {idx === 0 && (
                                         <span className="absolute -left-8 top-24 text-xs text-slate-500 uppercase tracking-widest font-bold -rotate-90 origin-bottom-left whitespace-nowrap">
                                             Equipment
                                         </span>
                                     )}
                                </div>

                                {/* Content Container */}
                                <div className="flex flex-1 gap-8">
                                    
                                    {/* Equipped & Inventory Block */}
                                    <div className="flex gap-2 shrink-0">
                                        {/* Equipped Item */}
                                        <div className={cn(sizeConfig.class, "border border-slate-800")}>
                                            {equipped && (
                                                <ItemCardWrapper 
                                                    item={equipped} 
                                                    profile={profile} 
                                                    basePower={basePowerLevel} 
                                                    classFilter={activeClassType}
                                                    characterId={activeCharacterId}
                                                    isHighlighted={checkMatch(equipped)}
                                                />
                                            )}
                                        </div>

                                        {/* Inventory Grid (3x3) Drop Zone */}
                                        <div 
                                            className={cn(
                                                "grid grid-cols-3 gap-2 gap-y-7 p-1 -m-1 border border-transparent rounded-sm transition-colors content-start",
                                                sizeConfig.containerWidth,
                                                "hover:bg-white/5 hover:border-white/5"
                                            )}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, activeCharacterId!, section.bucket)}
                                        >
                                            {inventorySlots.map((_, i) => {
                                                const item = inventory[i];
                                                return (
                                                    <div key={i} className={cn(sizeConfig.class, "border border-slate-800/50 bg-slate-900/20 shrink-0")}>
                                                        {item && (
                                                            <ItemCardWrapper 
                                                                item={item} 
                                                                profile={profile} 
                                                                basePower={basePowerLevel} 
                                                                classFilter={activeClassType}
                                                                characterId={activeCharacterId}
                                                                isHighlighted={checkMatch(item)}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Spacer / Vault Divider */}
                                    <div className="w-px bg-slate-800 mx-2" />

                                    {/* Vault Grid Drop Zone (Expanded View) */}
                                    <div 
                                        className={cn(
                                            "flex-1 p-2 -m-1 border border-transparent rounded-sm transition-colors",
                                            "hover:bg-white/5 hover:border-white/5"
                                        )}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, "VAULT", section.bucket)}
                                    >
                                         <h3 className="text-xs text-slate-500 uppercase font-bold mb-2">{section.name}</h3>
                                         
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
                                             if (!vaultGrouping.byRarity && !vaultGrouping.byClass && !vaultGrouping.byTier) {
                                                 return (
                                                     <VaultGrid
                                                         items={vault}
                                                         iconSize={iconSize}
                                                         ownerId="VAULT"
                                                         checkMatch={checkMatch}
                                                         getInstanceData={getInstanceData}
                                                         getSocketsData={getSocketsData}
                                                         getReusablePlugs={getReusablePlugs}
                                                         gap={8}
                                                         maxHeight={350}
                                                     />
                                                 );
                                             }

                                             // 2. Group by Rarity ONLY
                                             if (vaultGrouping.byRarity && !vaultGrouping.byClass) {
                                                 const groups = [6, 5, 4, 3, 2].map(tier => ({
                                                     key: tier,
                                                     label: tierNames[tier],
                                                     labelClassName: tierColors[tier],
                                                     items: vault.filter((item: any) => 
                                                         (vaultDefs[item.itemHash]?.inventory?.tierType || 0) === tier
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
                                                         gap={8}
                                                     />
                                                 );
                                             }

                                             // 3. Group by Class ONLY
                                             if (!vaultGrouping.byRarity && vaultGrouping.byClass) {
                                                 const groups = [0, 1, 2, 3].map(cls => ({
                                                     key: cls,
                                                     label: classNames[cls],
                                                     labelClassName: 'text-slate-500',
                                                     items: vault.filter((item: any) => {
                                                         const def = vaultDefs[item.itemHash];
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
                                                         gap={8}
                                                     />
                                                 );
                                             }

                                             // 4. Group by BOTH (Class -> Rarity) - nested structure
                                             if (vaultGrouping.byRarity && vaultGrouping.byClass) {
                                                 return (
                                                     <div className="flex flex-col gap-8 min-h-[60px]">
                                                         {[0, 1, 2, 3].map(cls => {
                                                             const clsItems = vault.filter((item: any) => {
                                                                 const def = vaultDefs[item.itemHash];
                                                                 return (def?.classType ?? 3) === cls;
                                                             });
                                                             
                                                             if (clsItems.length === 0) return null;

                                                             const tierGroups = [6, 5, 4, 3, 2].map(tier => ({
                                                                 key: `${cls}-${tier}`,
                                                                 label: tierNames[tier],
                                                                 labelClassName: tierColors[tier],
                                                                 items: clsItems.filter((item: any) => 
                                                                     (vaultDefs[item.itemHash]?.inventory?.tierType || 0) === tier
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
                                                                         gap={8}
                                                                     />
                                                                 </div>
                                                             );
                                                         })}
                                                     </div>
                                                 );
                                             }

                                             // Fallback for byTier (not fully implemented)
                                             return (
                                                 <VaultGrid
                                                     items={vault}
                                                     iconSize={iconSize}
                                                     ownerId="VAULT"
                                                     checkMatch={checkMatch}
                                                     getInstanceData={getInstanceData}
                                                     getSocketsData={getSocketsData}
                                                     getReusablePlugs={getReusablePlugs}
                                                     gap={8}
                                                     maxHeight={350}
                                                 />
                                             );
                                         })()}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar (Right) */}
            <div className="w-80 border-l border-slate-800 p-6 flex flex-col gap-8 overflow-y-auto h-screen scrollbar-thin scrollbar-thumb-slate-800">
                
                {/* Engrams */}
                <div className="flex gap-4">
                    <div className="w-6 relative">
                         <span className="absolute top-0 left-0 text-[10px] text-slate-500 uppercase tracking-widest font-bold -rotate-90 origin-bottom-left translate-y-12 whitespace-nowrap">
                             Engrams
                         </span>
                    </div>
                    <div className="flex-1">
                        <div className="grid grid-cols-5 gap-1">
                            {Array.from({ length: 10 }).map((_, i) => {
                                const item = engrams[i];
                                return (
                                    <div key={i} className="aspect-square rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                                        {item && (
                                            <DestinyItemCard
                                                itemHash={item.itemHash}
                                                itemInstanceId={item.itemInstanceId}
                                                instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                                reusablePlugs={profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs}
                                                className="w-full h-full"
                                                size={iconSize}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-right text-xs text-slate-500 mt-1">
                            {engrams.length} / 10
                        </div>
                    </div>
                </div>

                {/* Power Level */}
                <div className="flex gap-4">
                    <div className="w-6 relative">
                         <span className="absolute top-0 left-0 text-[10px] text-slate-500 uppercase tracking-widest font-bold -rotate-90 origin-bottom-left translate-y-12 whitespace-nowrap">
                             Power
                         </span>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        {bestItems && Object.entries(bestItems).map(([bucket, data]) => {
                            // @ts-ignore
                            const diff = data.power - basePowerLevel;
                            return (
                                <PowerListItem 
                                    key={bucket}
                                    // @ts-ignore
                                    itemHash={data.itemHash}
                                    // @ts-ignore
                                    power={data.power}
                                    diff={diff}
                                    isMax={true}
                                />
                            );
                        })}
                        
                        <div className="mt-4 flex justify-between items-center border-t border-slate-700 pt-2">
                            <span className="text-slate-400 text-sm">Actual Light</span>
                            <span className="text-destiny-gold font-bold text-lg">♦{basePowerLevel}</span>
                        </div>
                        
                        <div className="mt-4 text-[10px] text-slate-500 bg-slate-900 p-2 rounded border border-slate-800">
                            ℹ You're on the Pinnacle Gear grind. Attain ♦{Math.ceil(basePowerLevel / 10) * 10} by completing the most challenging activities.
                        </div>
                    </div>
                </div>

                {/* Currencies */}
                <div className="flex gap-4">
                    <div className="w-6 relative">
                         <span className="absolute top-0 left-0 text-[10px] text-slate-500 uppercase tracking-widest font-bold -rotate-90 origin-bottom-left translate-y-16 whitespace-nowrap">
                             Currencies
                         </span>
                    </div>
                    <div className="flex-1 space-y-2">
                        <CurrencyRow name="Glimmer" value={glimmer} icon={currencyDefs[CURRENCIES.GLIMMER]?.displayProperties?.icon} />
                        <CurrencyRow name="Bright Dust" value={brightDust} icon={currencyDefs[CURRENCIES.BRIGHT_DUST]?.displayProperties?.icon} />
                        <div className="h-px bg-slate-800 my-2" />
                        <CurrencyRow name="Enhancement Core" value={cores} icon={currencyDefs[MATERIALS.ENHANCEMENT_CORE]?.displayProperties?.icon} />
                        <CurrencyRow name="Enhancement Prism" value={prisms} icon={currencyDefs[MATERIALS.ENHANCEMENT_PRISM]?.displayProperties?.icon} />
                        <CurrencyRow name="Ascendant Shard" value={shards} icon={currencyDefs[MATERIALS.ASCENDANT_SHARD]?.displayProperties?.icon} />
                        <CurrencyRow name="Ascendant Alloy" value={alloys} icon={currencyDefs[MATERIALS.ASCENDANT_ALLOY]?.displayProperties?.icon} />
                        <CurrencyRow name="Strange Coin" value={strangeCoins} icon={strangeCoinIcon} />
                    </div>
                </div>

                {/* Loadouts (Moved Below Currencies) */}
                <div className="flex gap-4">
                    <div className="w-6 relative">
                         <span className="absolute top-0 left-0 text-[10px] text-slate-500 uppercase tracking-widest font-bold -rotate-90 origin-bottom-left translate-y-12 whitespace-nowrap">
                             Loadouts
                         </span>
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-wrap gap-2">
                             {loadouts.length > 0 ? (
                                 loadouts.map((loadout: any, i: number) => (
                                     <LoadoutButton
                                         key={i}
                                         loadout={loadout}
                                         index={i}
                                         activeCharacterId={activeCharacterId}
                                         membershipInfo={membershipInfo}
                                         profile={profile}
                                     />
                                 ))
                             ) : (
                                 <div className="text-sm text-slate-600 italic py-2">No loadouts</div>
                             )}
                        </div>
                    </div>
                </div>

                {/* Postmaster */}
                <div className="flex gap-4">
                    <div className="w-6 relative">
                         <span className="absolute top-0 left-0 text-[10px] text-slate-500 uppercase tracking-widest font-bold -rotate-90 origin-bottom-left translate-y-16 whitespace-nowrap">
                             Postmaster
                         </span>
                    </div>
                    <div className="flex-1">
                        <div className="grid grid-cols-5 gap-1">
                            {Array.from({ length: 21 }).map((_, i) => {
                                const item = postmasterItems[i];
                                return (
                                    <div key={i} className="aspect-square rounded-sm bg-slate-900 border border-slate-800 overflow-hidden relative">
                                        {item ? (
                                            <DestinyItemCard
                                                itemHash={item.itemHash}
                                                itemInstanceId={item.itemInstanceId}
                                                instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                                reusablePlugs={profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs}
                                                className="w-full h-full"
                                                size={iconSize}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-transparent" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-right text-xs text-slate-500 mt-1">
                            {postmasterItems.length} / 21
                        </div>
                    </div>
                </div>

            </div>
            <ItemDetailsOverlay />
        </div>
    );
}
