"use client";

import { useDestinyProfile, DestinyStats } from "@/hooks/useDestinyProfile";
import { BUCKETS, CURRENCIES, MATERIALS, calculateBasePowerLevel, getBestItemsPerSlot } from "@/lib/destinyUtils";
import { DestinyItemCard } from "@/components/DestinyItemCard";
import { useMemo, useState, useEffect, useRef } from "react";
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

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

// Helper to find currency quantity
const findCurrency = (profile: any, hash: number) => {
    return profile?.profileCurrencies?.data?.items?.find((i: any) => i.itemHash === hash)?.quantity || 0;
};

const findMaterialQuantity = (profile: any, characterId: string, hash: number) => {
    let quantity = 0;
    
    // Check Profile Inventory
    profile?.profileInventory?.data?.items?.forEach((item: any) => {
        if (item.itemHash === hash) quantity += item.quantity;
    });

    // Check Character Inventory
    profile?.characterInventories?.data?.[characterId]?.items?.forEach((item: any) => {
        if (item.itemHash === hash) quantity += item.quantity;
    });

    return quantity;
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

export default function CharacterPage() {
    const { profile, stats, isLoading, isLoggedIn, membershipInfo } = useDestinyProfile();
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const { addOperation, removeOperation, pendingOperations } = useTransferStore();
    const { setDetailsItem } = useUIStore();
    const [mounted, setMounted] = useState(false);
    
    // Settings & Filter State
    const [searchQuery, setSearchQuery] = useState("");
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

    // Collect Vault Item Hashes for Definitions
    const vaultItemHashes = useMemo(() => {
        return profile?.profileInventory?.data?.items?.map((i: any) => i.itemHash) || [];
    }, [profile]);

    const { definitions: vaultDefs } = useItemDefinitions(vaultItemHashes);

    // Default to active character from stats
    const activeCharacterId = selectedCharacterId || stats?.characterId;
    const characters = profile?.characters?.data ? Object.values(profile.characters.data) : [];
    const activeCharacter = characters.find((c: any) => c.characterId === activeCharacterId);
    const activeClassType = (activeCharacter as any)?.classType ?? stats?.classType;

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

    const handleEquipSubclass = async (item: any) => {
        if (!membershipInfo || !activeCharacterId) return;
        try {
            toast.loading("Equipping subclass...");
            await equipItem(item.itemInstanceId, activeCharacterId, membershipInfo.membershipType);
            toast.success("Subclass equipped");
        } catch (err) {
            toast.error("Failed to equip subclass");
            console.error(err);
        }
    };

    const handleEquipLoadout = async (index: number) => {
        if (!membershipInfo || !activeCharacterId) return;
        try {
            toast.loading(`Equipping Loadout ${index + 1}...`);
            await equipLoadout(index, activeCharacterId, membershipInfo.membershipType);
            toast.success(`Loadout ${index + 1} equipped`);
        } catch (err) {
            toast.error("Failed to equip loadout");
            console.error(err);
        }
    };

    // Filter & Sort Logic
    const processVaultItems = (items: any[]) => {
        let filtered = items;
        
        // Filter
        if (searchQuery) {
            const term = searchQuery.toLowerCase();
            filtered = filtered.filter(item => {
                const def = vaultDefs[item.itemHash];
                const name = def?.displayProperties?.name?.toLowerCase() || "";
                const type = def?.itemTypeDisplayName?.toLowerCase() || "";
                return name.includes(term) || type.includes(term);
            });
        }

        // Sort
        return filtered.sort((a, b) => {
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
    };


    if (!mounted) return null; 
    if (isLoading) return <div className="p-8 text-center">Loading Character Data...</div>;
    if (!isLoggedIn) return <div className="p-8 text-center">Please log in to view character data.</div>;
    if (!profile || !activeCharacterId) return <div className="p-8 text-center">No character data found.</div>;

    const characterInventory = profile.characterInventories?.data?.[activeCharacterId]?.items || [];
    const characterEquipment = profile.characterEquipment?.data?.[activeCharacterId]?.items || [];
    const profileInventory = profile.profileInventory?.data?.items || []; // Vault
    
    // Loadouts
    const loadouts = profile.characterLoadouts?.data?.[activeCharacterId]?.loadouts || [];

    // Helper to get items for a specific bucket with optimistic updates
    const getSectionItems = (bucketHash: number) => {
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

        // Apply Sort/Filter to Vault
        vault = processVaultItems(vault);

        return { equipped, inventory, vault };
    };

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

    const engrams = [...characterInventory, ...profileInventory].filter((i: any) => i.bucketHash === BUCKETS.ENGRAMS);
    
    const subclassEquipped = characterEquipment.filter((i: any) => i.bucketHash === BUCKETS.SUBCLASS); 
    const subclassInv = characterInventory.filter((i: any) => i.bucketHash === BUCKETS.SUBCLASS);
    const allSubclasses = [...subclassEquipped, ...subclassInv];

    // Currencies
    const glimmer = findCurrency(profile, CURRENCIES.GLIMMER);
    const brightDust = findCurrency(profile, CURRENCIES.BRIGHT_DUST);
    const cores = findMaterialQuantity(profile, activeCharacterId, MATERIALS.ENHANCEMENT_CORE);
    const prisms = findMaterialQuantity(profile, activeCharacterId, MATERIALS.ENHANCEMENT_PRISM);
    const shards = findMaterialQuantity(profile, activeCharacterId, MATERIALS.ASCENDANT_SHARD);
    const alloys = findMaterialQuantity(profile, activeCharacterId, MATERIALS.ASCENDANT_ALLOY);

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
                                     <Image 
                                        src={getBungieImage(char.emblemPath)} 
                                        alt="Character"
                                        width={40}
                                        height={40}
                                        className="object-cover w-full h-full" 
                                    />
                                 </button>
                             ))}
                         </div>

                        {/* Subclass List */}
                        <div className="flex items-center gap-2 shrink-0 border-l border-white/10 pl-6">
                            {allSubclasses.map((item: any) => (
                                 <div 
                                    key={item.itemInstanceId} 
                                    className="w-14 h-14 cursor-pointer transition-transform hover:scale-105 hover:brightness-110"
                                    onClick={() => setDetailsItem(item)}
                                    title="Click to Inspect"
                                 >
                                    <DestinyItemCard
                                        itemHash={item.itemHash}
                                        itemInstanceId={item.itemInstanceId}
                                        instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                        socketsData={profile.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                        className="w-full h-full"
                                        hideBorder={true}
                                        hidePower={true}
                                        ownerId={activeCharacterId}
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
                                        <div className="w-14 h-14 border border-slate-800">
                                            {equipped && (
                                                <ItemCardWrapper 
                                                    item={equipped} 
                                                    profile={profile} 
                                                    basePower={basePowerLevel} 
                                                    classFilter={activeClassType}
                                                    characterId={activeCharacterId}
                                                />
                                            )}
                                        </div>

                                        {/* Inventory Grid (3x3) Drop Zone */}
                                        <div 
                                            className={cn(
                                                "grid grid-cols-3 gap-2 gap-y-6 w-[184px] p-1 -m-1 border border-transparent rounded-sm transition-colors content-start",
                                                "hover:bg-white/5 hover:border-white/5"
                                            )}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, activeCharacterId, section.bucket)}
                                        >
                                            {inventorySlots.map((_, i) => {
                                                const item = inventory[i];
                                                return (
                                                    <div key={i} className="w-14 h-14 border border-slate-800/50 bg-slate-900/20 shrink-0">
                                                        {item && (
                                                            <ItemCardWrapper 
                                                                item={item} 
                                                                profile={profile} 
                                                                basePower={basePowerLevel} 
                                                                classFilter={activeClassType}
                                                                characterId={activeCharacterId}
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
                                        <div className="flex flex-wrap gap-2 gap-y-0 content-start">
                                            {vault.map((item: any) => (
                                                <div key={item.itemInstanceId} className="w-14 min-h-14 border border-slate-800/50">
                                                    <ItemCardWrapper 
                                                        item={item} 
                                                        profile={profile} 
                                                        basePower={basePowerLevel} 
                                                        classFilter={activeClassType}
                                                        ownerId="VAULT"
                                                    />
                                                </div>
                                            ))}
                                            {vault.length === 0 && (
                                                <div className="w-full text-xs text-slate-600 italic p-2">
                                                    Vault empty
                                                </div>
                                            )}
                                        </div>
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
                                                className="w-full h-full"
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
                        <CurrencyRow name="Glimmer" value={glimmer} icon="/common/destiny2_content/icons/609f5a4e8145828084e6401269a41367.png" />
                        <CurrencyRow name="Bright Dust" value={brightDust} icon="/common/destiny2_content/icons/430697cb39667c0a04e42a1b6f6d10e4.png" />
                        <div className="h-px bg-slate-800 my-2" />
                        <CurrencyRow name="Enhancement Core" value={cores} icon="/common/destiny2_content/icons/40391936300c074a325d4df95d117b33.png" />
                        <CurrencyRow name="Enhancement Prism" value={prisms} icon="/common/destiny2_content/icons/d7083b74b3c61a3e3e0a066f50213716.png" />
                        <CurrencyRow name="Ascendant Shard" value={shards} icon="/common/destiny2_content/icons/6522830243649038464d07638709c444.png" />
                        <CurrencyRow name="Ascendant Alloy" value={alloys} icon="/common/destiny2_content/icons/b4722000d9862b4df668e32a4e98d0f0.png" />
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
                                     <div 
                                        key={i} 
                                        onClick={() => handleEquipLoadout(i)}
                                        className="w-12 h-12 bg-slate-900/50 border border-slate-800 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
                                        title={`Equip Loadout ${i + 1}`}
                                     >
                                         {/* If we have an icon path, use it. Bungie loadouts often have an icon hash. */}
                                         {/* For now, just text L# */}
                                         L{i + 1}
                                     </div>
                                 ))
                             ) : (
                                 <div className="text-sm text-slate-600 italic py-2">No loadouts</div>
                             )}
                        </div>
                    </div>
                </div>

            </div>
            <ItemDetailsOverlay />
        </div>
    );
}

// Wrapper to handle common item props
function ItemCardWrapper({ item, profile, basePower, classFilter, characterId, ownerId }: any) {
    const instance = profile.itemComponents?.instances?.data?.[item.itemInstanceId];
    
    // DISABLED Power Difference on Main Gear as per request
    const diff = undefined; 
    // const power = instance?.primaryStat?.value || 0;
    // const diff = power > 0 && basePower > 0 ? power - basePower : 0;

    return (
        <DestinyItemCard
            itemHash={item.itemHash}
            itemInstanceId={item.itemInstanceId}
            instanceData={instance}
            socketsData={profile.itemComponents?.sockets?.data?.[item.itemInstanceId]}
            className="w-full h-full"
            powerDiff={diff}
            classFilter={classFilter}
            ownerId={ownerId || characterId}
            showClassSymbolOnMismatch
        />
    );
}

function CurrencyRow({ name, value, icon }: { name: string, value: number, icon?: string }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-slate-400">
                {icon && (
                    <Image 
                        src={`https://www.bungie.net${icon}`} 
                        width={20} 
                        height={20} 
                        className="object-contain opacity-90" 
                        alt="" 
                    />
                )}
                <span>{name}</span>
            </div>
            <span className="font-medium text-slate-200">{value.toLocaleString()}</span>
        </div>
    );
}
