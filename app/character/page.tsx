"use client";

import dynamic from 'next/dynamic';
import { DestinyStats } from "@/hooks/useDestinyProfile";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { BUCKETS, CURRENCIES, MATERIALS, calculateBasePowerLevel, getBestItemsPerSlot } from "@/lib/destinyUtils";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { getBungieImage, moveItem, equipItem, equipLoadout } from "@/lib/bungie";
import { useTransferStore } from "@/store/transferStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { useWishListStore } from "@/store/wishlistStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { Search, Settings } from "lucide-react";

// Lazy load heavy components
const DestinyItemCard = dynamic(
    () => import("@/components/DestinyItemCard").then((mod) => mod.DestinyItemCard),
    { ssr: false }
);

const VaultGrid = dynamic(
    () => import("@/components/VaultGrid").then((mod) => mod.VaultGrid),
    { ssr: false }
);

const GroupedVaultGrid = dynamic(
    () => import("@/components/VaultGrid").then((mod) => mod.GroupedVaultGrid),
    { ssr: false }
);

const ItemDetailsOverlay = dynamic(
    () => import("@/components/ItemDetailsOverlay").then((mod) => mod.ItemDetailsOverlay),
    { ssr: false }
);

const LoadoutButton = dynamic(
    () => import("@/components/LoadoutButton").then((mod) => mod.LoadoutButton),
    { ssr: false }
);

const CharacterHeader = dynamic(
    () => import("@/components/CharacterHeader").then((mod) => mod.CharacterHeader),
    { ssr: false }
);

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
            imageFetchPriority="low"
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
    const { profile, stats, isLoading, isLoggedIn, membershipInfo } = useDestinyProfileContext();
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const { addOperation, removeOperation, pendingOperations } = useTransferStore();
    const { setDetailsItem } = useUIStore();
    const [mounted, setMounted] = useState(false);

    // Settings & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showPowerOverlay, setShowPowerOverlay] = useState(false);
    const { iconSize, sortMethod, vaultGrouping, setIconSize, setSortMethod, setVaultGrouping } = useSettingsStore();
    const settingsRef = useRef<HTMLDivElement>(null);

    const sizeConfig = useMemo(() => ({
        small: { class: 'w-16 h-16', containerWidth: 'w-[208px]', headerWidth: 'w-[280px]' },
        medium: { class: 'w-20 h-20', containerWidth: 'w-[256px]', headerWidth: 'w-[344px]' },
        large: { class: 'w-24 h-24', containerWidth: 'w-[304px]', headerWidth: 'w-[408px]' }
    }[iconSize] || { class: 'w-20 h-20', containerWidth: 'w-[256px]', headerWidth: 'w-[344px]' }), [iconSize]);

    // Ensure wishlists are loaded from IndexedDB
    const wishLists = useWishListStore(state => state.wishLists);
    const isLoadingWishLists = useWishListStore(state => state.isLoading);

    useEffect(() => {
        setMounted(true);

        // Load wishlists from IndexedDB if they're enabled but missing rolls
        const enabledWishLists = wishLists.filter(wl => wl.enabled);
        const needsLoading = enabledWishLists.some(wl => !wl.rolls || wl.rolls.size === 0);

        if (needsLoading && !isLoadingWishLists && typeof window !== 'undefined') {
            // Use requestIdleCallback to load in background
            const scheduleLoad = (callback: () => void) => {
                if ('requestIdleCallback' in window) {
                    (window as any).requestIdleCallback(callback, { timeout: 2000 });
                } else {
                    setTimeout(callback, 1000);
                }
            };

            scheduleLoad(() => {
                const store = useWishListStore.getState();
                enabledWishLists.forEach(wl => {
                    if (!wl.rolls || wl.rolls.size === 0) {
                        // Only refresh this specific wishlist
                        store.refreshWishList(wl.id).catch(err => {
                            console.warn(`Failed to load wishlist ${wl.title}:`, err);
                        });
                    }
                });
            });
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wishLists, isLoadingWishLists]);

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

    const updateOperationStatus = useTransferStore(state => state.updateOperationStatus);
    const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

    const handleDrop = async (e: React.DragEvent, targetOwnerId: string, bucketHash?: number) => {
        e.preventDefault();
        setDragOverTarget(null);
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

            // Add operation with 'syncing' status (handled by store)
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
                    // API confirmed - update status to success, then remove after brief delay
                    updateOperationStatus(itemInstanceId, 'success');
                    setTimeout(() => removeOperation(itemInstanceId), 1500);
                } catch (err) {
                    // API failed - set error status for bounce-back animation
                    updateOperationStatus(itemInstanceId, 'error');
                    // Remove after animation completes
                    setTimeout(() => removeOperation(itemInstanceId), 800);
                    throw err;
                }
            })();

            toast.promise(promise, {
                loading: `Transferring to ${targetName}...`,
                success: `Moved to ${targetName}`,
                error: 'Transfer failed - item returned'
            });

        } catch (e) {
            console.error("Drop parsing error", e);
        }
    };

    const handleDragOver = (e: React.DragEvent, targetId?: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (targetId) setDragOverTarget(targetId);
    };

    const handleDragLeave = () => {
        setDragOverTarget(null);
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

                {/* Top Section: Character Header, Loadouts, Postmaster, Engrams, Currencies + Settings */}
                <div className="flex gap-4 mb-6 relative z-20 pt-10 pb-4 -mx-4 px-4 min-h-[140px]">
                    {/* Scrollable Left Side */}
                    <div className="flex-1 flex gap-4 items-start overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 pb-4">

                        {/* Character Selector Group */}
                        <div className="flex gap-2 h-[106px] shrink-0">
                            {/* Active Character Large Card */}
                            {characters.map((char: any) => {
                                if (char.characterId !== activeCharacterId) return null;
                                return (
                                    <div
                                        key={char.characterId}
                                        className={cn(sizeConfig.headerWidth, "h-[106px] relative border border-white/20 group")}
                                    >
                                        <CharacterHeader
                                            character={{
                                                characterId: char.characterId,
                                                classType: char.classType,
                                                light: char.light,
                                                emblemBackgroundPath: char.emblemBackgroundPath,
                                                titleRecordHash: char.titleRecordHash,
                                            }}
                                            className="h-full"
                                        />
                                    </div>
                                );
                            })}

                            {/* Inactive Characters Vertical Stack */}
                            <div className="flex flex-col gap-2 h-full justify-between">
                                {characters.map((char: any) => {
                                    if (char.characterId === activeCharacterId) return null;
                                    return (
                                        <button
                                            key={char.characterId}
                                            onClick={() => setSelectedCharacterId(char.characterId)}
                                            className="w-[52px] h-[49px] relative border border-white/10 hover:border-destiny-gold overflow-hidden transition-all hover:scale-105 group"
                                            title={`Switch to ${char.classType === 0 ? 'Titan' : char.classType === 1 ? 'Hunter' : 'Warlock'}`}
                                        >
                                            <Image
                                                src={getBungieImage(char.emblemPath)}
                                                alt=""
                                                fill
                                                className="object-cover opacity-60 group-hover:opacity-100"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Image
                                                    src={CLASS_ICONS[char.classType]}
                                                    width={20}
                                                    height={20}
                                                    className="object-contain drop-shadow-md"
                                                    alt=""
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-[106px] bg-white/10 shrink-0" />

                        {/* Loadouts Grid */}
                        <div className="flex flex-col h-[106px] shrink-0 relative">
                            <span className="absolute -top-6 left-0.5 text-[10px] uppercase font-bold text-white-500 tracking-wider">Loadouts</span>
                            <div className="grid grid-rows-2 grid-flow-col gap-2 h-full">
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
                                    <div className="text-sm text-slate-600 italic px-2">No Loadouts</div>
                                )}
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-[106px] bg-white/10 shrink-0" />

                        {/* Postmaster Grid */}
                        <div className="flex flex-col h-[106px] shrink-0 relative">
                            <span className="absolute -top-6 left-0.5 text-[10px] uppercase font-bold text-white-500 tracking-wider">Postmaster</span>
                            <div className="grid grid-rows-2 grid-flow-col gap-2 h-full">
                                {Array.from({ length: 21 }).map((_, i) => {
                                    const item = postmasterItems[i];
                                    return (
                                        <div key={i} className="w-12 h-12 bg-gray-800/20 border border-white/5 relative overflow-hidden hover:border-destiny-gold/30 hover:bg-white/5 transition-all text-sm group">
                                            {item ? (
                                                <DestinyItemCard
                                                    itemHash={item.itemHash}
                                                    itemInstanceId={item.itemInstanceId}
                                                    instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                                    socketsData={profile.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                                    reusablePlugs={profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs}
                                                    className="w-full h-full"
                                                    size="small" // Fixed small size for header
                                                    hideBorder={true}  // Hide inner border to use outer container
                                                    hidePower={true}
                                                    imageFetchPriority="low"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-white/0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-[106px] bg-white/10 shrink-0" />

                        {/* Engrams Grid */}
                        <div className="flex flex-col h-[106px] shrink-0 relative">
                            <span className="absolute -top-6 left-0.5 text-[10px] uppercase font-bold text-white-500 tracking-wider">Engrams</span>
                            <div className="grid grid-rows-2 grid-flow-col gap-1.5 h-full">
                                {Array.from({ length: 10 }).map((_, i) => {
                                    const item = engrams[i];
                                    return (
                                        <div key={i} className="relative w-12 h-12 group" style={{ aspectRatio: '1 / 0.866' }}>
                                            <svg className="absolute inset-0 w-full h-full transition-colors" viewBox="0 0 100 86.6">
                                                <path
                                                    d="M 32,2 L 68,2 Q 75,2 80,10 L 92,36 Q 98,43.3 92,50.6 L 80,76.6 Q 75,84.6 68,84.6 L 32,84.6 Q 25,84.6 20,76.6 L 8,50.6 Q 2,43.3 8,36 L 20,10 Q 25,2 32,2 Z"
                                                    fill="rgba(31, 41, 55, 0.2)"
                                                    stroke="rgba(255, 255, 255, 0.05)"
                                                    strokeWidth="4"
                                                    className="group-hover:stroke-destiny-gold/30 group-hover:fill-white/5"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 overflow-hidden flex items-center justify-center p-0.5" style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}>
                                                {item ? (
                                                    <DestinyItemCard
                                                        itemHash={item.itemHash}
                                                        itemInstanceId={item.itemInstanceId}
                                                        instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                                        socketsData={profile.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                                        reusablePlugs={profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs}
                                                        className="w-full h-full"
                                                        size="small"
                                                        hideBorder={true}
                                                        hidePower={true}
                                                        imageFetchPriority="low"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-white/0" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-[106px] bg-white/10 shrink-0" />

                        {/* Currencies */}
                        <div className="flex flex-col h-[106px] shrink-0 min-w-[320px] relative">
                            <span className="absolute -top-6 left-0.5 text-[10px] uppercase font-bold text-white-500 tracking-wider">Currencies</span>
                            <div className="grid grid-cols-4 gap-2 h-full content-center">
                                {[
                                    { val: glimmer, icon: currencyDefs[CURRENCIES.GLIMMER]?.displayProperties?.icon, name: 'Glimmer', color: 'text-blue-300' },
                                    { val: brightDust, icon: currencyDefs[CURRENCIES.BRIGHT_DUST]?.displayProperties?.icon, name: 'Bright Dust', color: 'text-purple-300' },
                                    { val: cores, icon: currencyDefs[MATERIALS.ENHANCEMENT_CORE]?.displayProperties?.icon, name: 'Cores', color: 'text-orange-300' },
                                    { val: prisms, icon: currencyDefs[MATERIALS.ENHANCEMENT_PRISM]?.displayProperties?.icon, name: 'Prisms', color: 'text-yellow-300' },
                                    { val: shards, icon: currencyDefs[MATERIALS.ASCENDANT_SHARD]?.displayProperties?.icon, name: 'Shards', color: 'text-white-300' },
                                    { val: alloys, icon: currencyDefs[MATERIALS.ASCENDANT_ALLOY]?.displayProperties?.icon, name: 'Alloys', color: 'text-amber-300' },
                                    { val: strangeCoins, icon: strangeCoinIcon, name: 'Strange Coins', color: 'text-teal-300' },
                                ].map((curr, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/20 border border-white/5 hover:border-destiny-gold/30 hover:bg-white/5 transition-all group min-w-[80px]"
                                        title={`${curr.name}: ${curr.val}`}
                                    >
                                        <div className="relative shrink-0 w-6 h-6">
                                            {curr.icon ? (
                                                <Image
                                                    src={getBungieImage(curr.icon)}
                                                    fill
                                                    className="object-contain drop-shadow-sm group-hover:scale-110 transition-transform"
                                                    alt={curr.name}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-slate-800 rounded-full animate-pulse" />
                                            )}
                                        </div>
                                        <span className={cn("font-bold text-sm tracking-wide font-mono tabular-nums", curr.color || "text-slate-200")}>
                                            {new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(curr.val)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Search & Settings (Pushed to Right / Sticky?) */}
                        {/* We might want to keep search somewhere accessible. Putting it at the end of the scroll row might be bad UX. 
                        Let's place it absolutely positioned top-right or just at the end. */}
                    </div>

                    {/* Fixed Right Side: Search & Settings */}
                    <div className="flex gap-4 items-center shrink-0 h-[106px] pt-0">
                        {/* Search Bar (Bigger, Left) */}
                        <div className="relative w-64 h-10">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Filter Vault..."
                                className="w-full h-full bg-black/40 border border-white/10 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-destiny-gold/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Settings & Power Group */}
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setShowPowerOverlay(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-destiny-gold/50 bg-destiny-gold/10 text-destiny-gold hover:bg-destiny-gold/20 transition-colors uppercase text-xs font-bold tracking-wider rounded-sm h-10"
                            >
                                <span>♦ Power</span>
                            </button>
                            <div className="relative" ref={settingsRef}>
                                <button
                                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                    className={cn(
                                        "p-2 border transition-all h-10 w-10 flex items-center justify-center hover:bg-white/10",
                                        isSettingsOpen ? "bg-white/10 border-destiny-gold text-destiny-gold" : "border-white/10 text-slate-400"
                                    )}
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                                {isSettingsOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 shadow-2xl p-4 z-50 backdrop-blur-xl flex flex-col gap-4">
                                        {/* Copied from previous logic, simplified here for brevity (kept same) */}
                                        <div>
                                            <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-2">Icon Size</h3>
                                            <div className="grid grid-cols-3 gap-1">
                                                {['small', 'medium', 'large'].map((size) => (
                                                    <button key={size} onClick={() => setIconSize(size as any)} className={cn("px-2 py-1.5 text-xs uppercase font-bold border transition-colors", iconSize === size ? "bg-destiny-gold text-black border-destiny-gold" : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30")}>{size}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-2">Sort By</h3>
                                            <div className="grid grid-cols-2 gap-1">
                                                {['power', 'name', 'rarity', 'newest'].map((method) => (
                                                    <button key={method} onClick={() => setSortMethod(method as any)} className={cn("px-2 py-1.5 text-xs uppercase font-bold border transition-colors", sortMethod === method ? "bg-destiny-gold text-black border-destiny-gold" : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30")}>{method}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-2">Group Vault By</h3>
                                            <div className="flex gap-2">
                                                <button onClick={() => setVaultGrouping({ byRarity: !vaultGrouping.byRarity })} className={cn("px-3 py-1.5 text-xs uppercase font-bold border transition-colors flex-1", vaultGrouping.byRarity ? "bg-destiny-gold text-black border-destiny-gold" : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30")}>Rarity</button>
                                                <button onClick={() => setVaultGrouping({ byClass: !vaultGrouping.byClass })} className={cn("px-3 py-1.5 text-xs uppercase font-bold border transition-colors flex-1", vaultGrouping.byClass ? "bg-destiny-gold text-black border-destiny-gold" : "bg-black/40 text-slate-400 border-white/10 hover:border-white/30")}>Class</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
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
                                    {(() => {
                                        const inventoryDropZoneId = `${activeCharacterId}-${section.bucket}`;
                                        return (
                                            <div
                                                className={cn(
                                                    "grid grid-cols-3 gap-2 gap-y-7 p-1 -m-1 border border-transparent rounded-sm transition-colors content-start",
                                                    sizeConfig.containerWidth,
                                                    dragOverTarget === inventoryDropZoneId
                                                        ? "drag-over-active border-destiny-gold/40 bg-destiny-gold/10"
                                                        : "hover:bg-white/5 hover:border-white/5"
                                                )}
                                                onDragOver={(e) => handleDragOver(e, inventoryDropZoneId)}
                                                onDragLeave={handleDragLeave}
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
                                        );
                                    })()}
                                </div>

                                {/* Spacer / Vault Divider */}
                                <div className="w-px bg-slate-800 mx-2" />

                                {/* Vault Grid Drop Zone (Expanded View) */}
                                {(() => {
                                    const vaultDropZoneId = `VAULT-${section.bucket}`;
                                    return (
                                        <div
                                            className={cn(
                                                "flex-1 p-2 -m-1 border border-transparent rounded-sm transition-colors",
                                                dragOverTarget === vaultDropZoneId
                                                    ? "drag-over-active border-destiny-gold/40 bg-destiny-gold/10"
                                                    : "hover:bg-white/5 hover:border-white/5"
                                            )}
                                            onDragOver={(e) => handleDragOver(e, vaultDropZoneId)}
                                            onDragLeave={handleDragLeave}
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
                                                            definitions={vaultDefs}
                                                            checkMatch={checkMatch}
                                                            getInstanceData={getInstanceData}
                                                            getSocketsData={getSocketsData}
                                                            getReusablePlugs={getReusablePlugs}
                                                            gap={8}
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
                                                            definitions={vaultDefs}
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
                                                            definitions={vaultDefs}
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
                                                                            definitions={vaultDefs}
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
                                                        definitions={vaultDefs}
                                                        checkMatch={checkMatch}
                                                        getInstanceData={getInstanceData}
                                                        getSocketsData={getSocketsData}
                                                        getReusablePlugs={getReusablePlugs}
                                                        gap={8}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

            {/* Sidebar (Right) - Updated Order: Postmaster -> Engrams -> Currencies */ }
    {/* Sidebar Removed as per request */ }
    {/* Power Overlay Slide-out */ }
            <div className={cn(
                "absolute top-0 right-0 w-[400px] h-full bg-gray-800/20 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 transition-transform duration-300 transform",
                showPowerOverlay ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="flex flex-col h-full p-6">
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
                        <h2 className="text-xl font-bold uppercase tracking-widest text-destiny-gold">Power Analysis</h2>
                        <button onClick={() => setShowPowerOverlay(false)} className="text-slate-400 hover:text-white">
                            ✕
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className="mb-6 flex flex-col items-center">
                            <span className="text-sm text-slate-400 uppercase tracking-widest mb-1">Base Power</span>
                            <span className="text-6xl font-bold text-white relative">
                                {Math.floor(basePowerLevel)}
                                <span className="absolute -top-4 -right-8 text-xl text-destiny-gold">
                                    {Math.floor((basePowerLevel % 1) * 8)}/8
                                </span>
                            </span>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-2">Highest Items Per Slot</h3>
                            {bestItems && Object.entries(bestItems).map(([bucket, data]) => {
                                // @ts-ignore
                                const diff = data.power - Math.floor(basePowerLevel);
                                return (
                                    <div key={bucket} className="bg-white/5 p-2 rounded-sm border border-white/5">
                                        {/* @ts-ignore */}
                                        <PowerListItemInternal itemHash={data.itemHash} power={data.power} diff={diff} isMax={true} />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 p-4 bg-destiny-gold/5 border border-destiny-gold/20 rounded-sm">
                            <h4 className="text-destiny-gold font-bold uppercase tracking-wide text-xs mb-2">Power Guide</h4>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                To reach the next level of <b>{Math.floor(basePowerLevel) + 1}</b>, you need
                                <span className="text-white font-bold ml-1">{8 - Math.floor((basePowerLevel % 1) * 8)}</span> more points across your gear.
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                                Tip: Focus on Powerful Rewards (Tier 1/2) to fill in gaps where your gear is below your base power.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <ItemDetailsOverlay />
        </div >
    );
}


