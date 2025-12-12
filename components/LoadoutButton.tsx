"use client";

import useSWR from 'swr';
import { endpoints, getBungieImage, equipLoadout, bungieApi } from '@/lib/bungie';
import { toast } from 'sonner';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { BUCKETS } from '@/lib/destinyUtils';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface LoadoutButtonProps {
    loadout: any;
    index: number;
    activeCharacterId: string;
    membershipInfo: any;
    profile: any;
}

export function LoadoutButton({ loadout, index, activeCharacterId, membershipInfo, profile }: LoadoutButtonProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // Debug logging
    useEffect(() => {
        if (isHovered) {
            console.log(`Loadout ${index} Hovered:`, loadout);
        }
    }, [isHovered, loadout, index]);

    // Fetch Loadout Identifiers
    const { data: iconDef } = useSWR(
        loadout.iconHash ? endpoints.getLoadoutIconDefinition(loadout.iconHash) : null,
        fetcher
    );

    const { data: nameDef } = useSWR(
        loadout.nameHash ? endpoints.getLoadoutNameDefinition(loadout.nameHash) : null,
        fetcher
    );

    const { data: colorDef } = useSWR(
        loadout.colorHash ? endpoints.getLoadoutColorDefinition(loadout.colorHash) : null,
        fetcher
    );

    const loadoutName = nameDef?.Response?.name || `Loadout ${index + 1}`;
    const loadoutIcon = iconDef?.Response?.iconImagePath;

    // Resolve Items & Plugs
    const { resolvedItems, allHashes } = useMemo(() => {
        if (!loadout.items || !profile) return { resolvedItems: [], allHashes: [] };

        const itemMap = new Map<string, any>(); // Map to full item object

        // Build itemMap from profile to find bucketHashes
        const allInventoryItems = [
            ...Object.values(profile.characterInventories?.data || {}).flatMap((c: any) => c.items),
            ...Object.values(profile.characterEquipment?.data || {}).flatMap((c: any) => c.items),
            ...(profile.profileInventory?.data?.items || [])
        ];
        allInventoryItems.forEach((item: any) => {
            if (item.itemInstanceId) itemMap.set(String(item.itemInstanceId), item);
        });

        const resolved: any[] = [];
        const hashesToFetch = new Set<number>();

        loadout.items.forEach((item: any) => {
            let itemHash = item.itemHash;
            let inventoryItem = null;

            if (item.itemInstanceId && String(item.itemInstanceId) !== "0") {
                inventoryItem = itemMap.get(String(item.itemInstanceId));
                if (inventoryItem) itemHash = inventoryItem.itemHash;
            }

            if (itemHash) {
                hashesToFetch.add(itemHash);

                // Check if Subclass to fetch plugs
                let isSubclass = false;
                if (inventoryItem && inventoryItem.bucketHash === BUCKETS.SUBCLASS) {
                    isSubclass = true;
                }

                if (isSubclass && item.plugItemHashes) {
                    item.plugItemHashes.forEach((h: number) => hashesToFetch.add(h));
                }

                resolved.push({
                    itemHash,
                    itemInstanceId: item.itemInstanceId,
                    plugItemHashes: item.plugItemHashes || [],
                    bucketHash: inventoryItem?.bucketHash
                });
            }
        });

        return { resolvedItems: resolved, allHashes: Array.from(hashesToFetch) };
    }, [loadout, profile, index]);

    const { definitions: itemDefs } = useItemDefinitions(allHashes);

    const handleEquip = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!membershipInfo || !activeCharacterId) {
            toast.error("Character info missing");
            return;
        }

        try {
            toast.loading(`Equipping ${loadoutName}...`, { id: 'equip-loadout' });
            await equipLoadout(index, activeCharacterId, membershipInfo.membershipType);
            toast.success(`${loadoutName} equipped`, { id: 'equip-loadout' });
        } catch (err) {
            toast.error("Failed to equip loadout", { id: 'equip-loadout' });
            console.error(err);
        }
    };

    const handleMouseEnter = (e: React.MouseEvent) => {
        setIsHovered(true);
        updatePosition(e);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        updatePosition(e);
    };

    const updatePosition = (e: React.MouseEvent) => {
        let x = e.clientX + 15;
        let y = e.clientY + 15;
        if (x + 280 > window.innerWidth) {
            x = e.clientX - 295;
        }
        // Keep within viewport height
        if (y + 400 > window.innerHeight) {
            y = window.innerHeight - 410;
            if (y < 0) y = 10; // Safety
        }
        setPosition({ x, y });
    };

    // Categorize Items for Render
    const { weapons, armor, subclass, subclassPlugs } = useMemo(() => {
        const weapons: any[] = [];
        const armor: any[] = [];
        let subclass: any = null;
        const subclassPlugs: any = { abilities: [], superAspects: [], fragments: [] };

        resolvedItems.forEach(item => {
            const def = itemDefs[item.itemHash];
            if (!def) return;

            if (def.itemType === 3) { // Weapon
                weapons.push(def);
            } else if (def.itemType === 2) { // Armor
                armor.push(def);
            } else if (def.inventory?.bucketTypeHash === BUCKETS.SUBCLASS) {
                subclass = def;

                // Process Plugs
                item.plugItemHashes.forEach((plugHash: number) => {
                    const plugDef = itemDefs[plugHash];
                    if (!plugDef) return;

                    // Filter out empty/dummy plugs
                    if (!plugDef.displayProperties?.name) return;

                    const category = plugDef.plug?.plugCategoryIdentifier || "";
                    const typeName = plugDef.itemTypeDisplayName || "";

                    // Categorization Logic
                    if (category.includes('fragments') || typeName.includes('Fragment')) {
                        subclassPlugs.fragments.push(plugDef);
                    } else if (category.includes('aspects') || typeName.includes('Aspect')) {
                        subclassPlugs.superAspects.push(plugDef);
                    } else if (category.includes('supers') || typeName.includes('Super')) {
                        subclassPlugs.superAspects.unshift(plugDef); // Put Super first
                    } else if (
                        category.includes('class_abilities') ||
                        category.includes('movement') ||
                        category.includes('melee') ||
                        category.includes('grenades')
                    ) {
                        subclassPlugs.abilities.push(plugDef);
                    }
                });
            }
        });

        // Sort Weapons
        const weaponOrder = [BUCKETS.KINETIC_WEAPON, BUCKETS.ENERGY_WEAPON, BUCKETS.POWER_WEAPON];
        weapons.sort((a, b) => {
            const idxA = weaponOrder.indexOf(a.inventory?.bucketTypeHash);
            const idxB = weaponOrder.indexOf(b.inventory?.bucketTypeHash);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });

        // Sort Armor
        const armorOrder = [BUCKETS.HELMET, BUCKETS.GAUNTLETS, BUCKETS.CHEST_ARMOR, BUCKETS.LEG_ARMOR, BUCKETS.CLASS_ARMOR];
        armor.sort((a, b) => {
            const idxA = armorOrder.indexOf(a.inventory?.bucketTypeHash);
            const idxB = armorOrder.indexOf(b.inventory?.bucketTypeHash);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });

        // Sort Abilities (Class -> Jump -> Melee -> Grenade is standard-ish)
        const abilityOrder = ['class_abilities', 'movement', 'melee', 'grenades'];
        subclassPlugs.abilities.sort((a: any, b: any) => {
            const catA = a.plug?.plugCategoryIdentifier || "";
            const catB = b.plug?.plugCategoryIdentifier || "";
            // simplistic sort based on string presence
            const idxA = abilityOrder.findIndex(k => catA.includes(k));
            const idxB = abilityOrder.findIndex(k => catB.includes(k));
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });

        return { weapons, armor, subclass, subclassPlugs };
    }, [resolvedItems, itemDefs]);

    const renderIcon = (def: any, size: string = "w-10 h-10", rounded: string = "rounded-sm") => {
        const isSubclass = def.inventory?.bucketTypeHash === BUCKETS.SUBCLASS;
        return (
            <div key={def.hash} className={`${size} ${isSubclass ? "bg-transparent border-none" : "bg-gray-800/20 border border-white/10"} relative overflow-hidden ${rounded} shrink-0`}>
                {def.displayProperties?.icon ? (
                    <Image
                        src={getBungieImage(def.displayProperties.icon)}
                        fill
                        sizes="40px"
                        className="object-cover"
                        alt={def.displayProperties.name}
                    />
                ) : (
                    <div className="w-full h-full bg-gray-800/20 flex items-center justify-center text-[8px] text-slate-500">?</div>
                )}
            </div>
        )
    };

    return (
        <>
            <button
                onClick={handleEquip}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setIsHovered(false)}
                className="w-12 h-12 bg-gray-800/20 border border-white/5 relative group overflow-hidden hover:border-destiny-gold/30 hover:bg-white/5 transition-colors"
                title={`Equip ${loadoutName}`}
            >
                {loadoutIcon ? (
                    <Image
                        src={getBungieImage(loadoutIcon)}
                        alt={loadoutName}
                        fill
                        sizes="48px"
                        className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                ) : (
                    <span className="text-xs text-slate-500 group-hover:text-white">L{index + 1}</span>
                )}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
            </button>

            {isHovered && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[9999] w-[350px] flex flex-col shadow-2xl font-sans backdrop-blur-xl pointer-events-none"
                    style={{ left: position.x, top: position.y }}
                >
                    {/* Header */}
                    <div className="relative h-14 flex items-center px-4 gap-3 overflow-hidden bg-[#222]">
                        {/* Header Pattern Overlay */}
                        <div
                            className="absolute inset-0 opacity-20 mix-blend-overlay"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3Ccircle cx='13' cy='13' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
                                backgroundSize: '20px 20px'
                            }}
                        />

                        {loadoutIcon && (
                            <div className="relative z-10 w-9 h-9 shrink-0 bg-gray-800/20 overflow-hidden border border-white/10">
                                <Image src={getBungieImage(loadoutIcon)} fill className="object-cover" alt="" />
                            </div>
                        )}

                        <div className="relative z-10 flex-1 min-w-0 overflow-hidden">
                            <span className="font-bold text-white uppercase tracking-widest text-xl drop-shadow-md whitespace-nowrap">
                                {loadoutName}
                            </span>
                            <p className="text-[10px] text-white/90 uppercase tracking-wider font-bold truncate">Loadout</p>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="bg-gray-800/20 border-x border-b border-white/10 p-3 space-y-3">
                        {/* Weapons */}
                        {weapons.length > 0 && (
                            <div className="space-y-1">
                                <h4 className="text-[10px] uppercase tracking-widest text-white-500 font-bold">Weapons</h4>
                                <div className="flex gap-1">
                                    {weapons.map(def => renderIcon(def))}
                                </div>
                            </div>
                        )}

                        {/* Armor */}
                        {armor.length > 0 && (
                            <div className="space-y-1 pt-2 border-t border-white/5">
                                <h4 className="text-[10px] uppercase tracking-widest text-white-500 font-bold">Armor</h4>
                                <div className="flex gap-1">
                                    {armor.map(def => renderIcon(def))}
                                </div>
                            </div>
                        )}

                        {/* Subclass Row */}
                        {subclass && (
                            <div className="space-y-1 pt-2 border-t border-white/5">
                                <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Subclass</h4>
                                <div className="flex gap-1 items-center">
                                    {renderIcon(subclass, "w-10 h-10")}
                                    <div className="w-px h-8 bg-white/10 mx-1" />
                                    {subclassPlugs.abilities.map((def: any) => renderIcon(def, "w-8 h-8", "rounded-full"))}
                                </div>

                                {/* Super & Aspects */}
                                {(subclassPlugs.superAspects.length > 0) && (
                                    <div className="flex gap-1 items-center pl-1 pt-1">
                                        {subclassPlugs.superAspects.map((def: any) => renderIcon(def, "w-8 h-8"))}
                                    </div>
                                )}

                                {/* Fragments */}
                                {(subclassPlugs.fragments.length > 0) && (
                                    <div className="flex gap-1 items-center pl-1 pt-1 flex-wrap">
                                        {subclassPlugs.fragments.map((def: any) => renderIcon(def, "w-6 h-6"))}
                                    </div>
                                )}
                            </div>
                        )}

                        {resolvedItems.length === 0 && (
                            <div className="text-xs text-slate-500 italic py-2 text-center flex flex-col gap-1">
                                <span>No items identified</span>
                            </div>
                        )}

                        <div className="text-[9px] text-slate-500 text-center border-t border-white/5 pt-2 mt-1 uppercase tracking-wider">
                            Click to Equip
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
