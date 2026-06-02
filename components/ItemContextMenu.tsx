import React, { useEffect, useRef, useMemo, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { equipItem, setItemLockState, getBungieImage, moveItem, insertSocketPlugFree } from '@/lib/bungie';
import { toast } from 'sonner';
import { useTransferStore } from '@/store/transferStore';
import { useUIStore } from '@/store/uiStore';
import type { ArmorQuality } from '@/lib/destinyUtils';
import { cn } from '@/lib/utils';
import { ItemTooltip, WishListInfo } from './ItemTooltip';

interface ItemContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    itemHash: number;
    itemInstanceId?: string;
    ownerId?: string; // Character ID or 'VAULT'
    isLocked?: boolean;
    itemDef?: any;
    instanceData?: any;
    perks?: any[];
    mods?: any[];
    shaders?: any[];
    ornaments?: any[];
    killEffects?: any[];
    killTrackers?: any[];
    objectives?: any[];
    detailedPerks?: any[];
    wishListInfo?: WishListInfo;
    socketsData?: any;
    plugDefs?: Record<number, any>;
    /** Match hover `ItemTooltip` header (tier / element / season / MW / shiny / armor roll). */
    tooltipSeasonBadge?: string;
    tooltipElementIcon?: string;
    tooltipTier?: string | null;
    tooltipEnhancementTier?: number | null;
    tooltipIsShiny?: boolean;
    tooltipArmorQuality?: ArmorQuality | null;
    hideTooltipScreenshot?: boolean;
}

function findOwnedItemCopy(profile: any, itemHash: number) {
    for (const [characterId, equipment] of Object.entries(
        profile?.characterEquipment?.data ?? {}
    )) {
        const matchingItem = (equipment as any)?.items?.find(
            (item: any) => item?.itemHash === itemHash && item?.itemInstanceId
        );

        if (matchingItem) {
            return { itemInstanceId: matchingItem.itemInstanceId, ownerId: characterId };
        }
    }

    for (const [characterId, inventory] of Object.entries(
        profile?.characterInventories?.data ?? {}
    )) {
        const matchingItem = (inventory as any)?.items?.find(
            (item: any) => item?.itemHash === itemHash && item?.itemInstanceId
        );

        if (matchingItem) {
            return { itemInstanceId: matchingItem.itemInstanceId, ownerId: characterId };
        }
    }

    const vaultItem = profile?.profileInventory?.data?.items?.find(
        (item: any) => item?.itemHash === itemHash && item?.itemInstanceId
    );

    return vaultItem
        ? { itemInstanceId: vaultItem.itemInstanceId, ownerId: "VAULT" }
        : null;
}

export function ItemContextMenu({ 
    x, y, onClose, itemHash, itemInstanceId, ownerId, isLocked, 
    itemDef,
    instanceData,
    perks,
    mods,
    shaders,
    ornaments,
    killEffects,
    killTrackers,
    objectives,
    detailedPerks,
    wishListInfo,
    socketsData,
    plugDefs,
    tooltipSeasonBadge,
    tooltipElementIcon,
    tooltipTier,
    tooltipEnhancementTier,
    tooltipIsShiny,
    tooltipArmorQuality,
    hideTooltipScreenshot,
}: ItemContextMenuProps) {
    const shellRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    /** Mount rich tooltip after first paint so equip/transfer UI shows immediately. */
    const [tooltipReady, setTooltipReady] = useState(false);
    const { profile, stats, membershipInfo } = useDestinyProfileContext();
    const addOperation = useTransferStore(state => state.addOperation);
    const removeOperation = useTransferStore(state => state.removeOperation);
    const setDetailsItem = useUIStore(state => state.setDetailsItem);
    const setFullDetailsItem = useUIStore(state => state.setFullDetailsItem);

    const handleEquipPlug = async (socketIndex: number, plugItemHash: number) => {
        if (!itemInstanceId || !membershipInfo || !ownerId) return;
        
        const targetCharacterId = ownerId === 'VAULT' 
            ? stats?.characterId || Object.keys(profile?.characters?.data || {})[0] 
            : ownerId;

        const promise = (async () => {
            // 1. Move from Vault if needed
            if (ownerId === 'VAULT') {
                await moveItem(itemInstanceId, itemHash, 'VAULT', targetCharacterId, membershipInfo.membershipType);
            }

            // 2. Unlock if locked
            if (isLocked) {
                await setItemLockState(itemInstanceId, targetCharacterId, membershipInfo.membershipType, false);
            }

            try {
                // 3. Insert Plug using the FREE endpoint
                // This works for weapon perk toggles, subclass abilities, and free mods
                // Reference: https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/advanced-write-actions.ts
                await insertSocketPlugFree(itemInstanceId, plugItemHash, socketIndex, targetCharacterId, membershipInfo.membershipType);
            } finally {
                // 4. Relock if it was locked (restore state)
                if (isLocked) {
                    await setItemLockState(itemInstanceId, targetCharacterId, membershipInfo.membershipType, true);
                }
            }
        })();

        toast.promise(promise, {
            loading: 'Applying perk...',
            success: 'Perk applied!',
            error: (err) => {
                const bungieError = err.response?.data;
                // ErrorCode 1641 = DestinySocketActionNotAllowed
                if (bungieError?.ErrorCode === 1641) {
                    return 'This action requires materials or special permissions.';
                }
                return bungieError?.Message || 'Failed to apply perk';
            }
        });
    };

    // Prepare tooltip payload only after defer — avoids blocking the first menu paint.
    const tooltipData = useMemo(() => {
        if (!tooltipReady || !itemDef) return null;

        return {
            name: itemDef.displayProperties?.name,
            itemType: itemDef.itemTypeDisplayName,
            rarity: itemDef.inventory?.tierTypeName || 'Common',
            icon: itemDef.displayProperties?.icon ? getBungieImage(itemDef.displayProperties.icon) : undefined,
            power: instanceData?.primaryStat?.value,
            screenshot: hideTooltipScreenshot || !itemDef.screenshot ? undefined : getBungieImage(itemDef.screenshot),
            flavorText: itemDef.flavorText,
            stats: instanceData?.stats,
            itemHash,
            perks,
            mods,
            shaders,
            ornaments,
            killEffects,
            killTrackers,
            enhancementTier: tooltipEnhancementTier ?? undefined,
            tier: tooltipTier ?? undefined,
            seasonBadge: tooltipSeasonBadge,
            elementIcon: tooltipElementIcon,
            objectives,
            itemDef,
            detailedPerks,
            isShiny: tooltipIsShiny,
            armorQuality: tooltipArmorQuality ?? undefined,
            wishListInfo,
            socketsData,
            plugDefs
        };
    }, [
        tooltipReady,
        itemDef,
        instanceData,
        itemHash,
        perks,
        mods,
        shaders,
        ornaments,
        killEffects,
        killTrackers,
        objectives,
        detailedPerks,
        wishListInfo,
        socketsData,
        plugDefs,
        tooltipSeasonBadge,
        tooltipElementIcon,
        tooltipTier,
        tooltipEnhancementTier,
        tooltipIsShiny,
        tooltipArmorQuality,
        hideTooltipScreenshot,
    ]);

    const canManageInstance = Boolean(itemInstanceId && membershipInfo && ownerId);

    const shellLayout = useMemo(() => {
        const menuW = canManageInstance ? 256 : 0;
        const tooltipW = 350;
        const hasTip = !!tooltipData;
        const shellW = menuW + (hasTip ? tooltipW : 0);
        if (typeof window === "undefined") {
            return { left: x, top: y };
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pad = 8;
        let left = x;
        if (left + shellW > vw - pad) {
            left = Math.max(pad, vw - shellW - pad);
        }
        let top = y;
        const estH = 620;
        if (top + estH > vh - pad) {
            top = Math.max(pad, vh - estH - pad);
        }
        return { left, top };
    }, [canManageInstance, x, y, tooltipData]);
    
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (shellRef.current && !shellRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleScroll = () => onClose();

        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!cancelled) {
                    startTransition(() => setTooltipReady(true));
                }
            });
        });
        return () => {
            cancelled = true;
            cancelAnimationFrame(id);
        };
    }, []);

    const ownedItemCopy = useMemo(
        () => findOwnedItemCopy(profile, itemHash),
        [profile, itemHash]
    );
    const detailsItemInstanceId = itemInstanceId ?? ownedItemCopy?.itemInstanceId;
    const detailsOwnerId = ownerId ?? ownedItemCopy?.ownerId;

    const characters = profile?.characters?.data ? Object.values(profile.characters.data) as any[] : [];
    const classNames = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
    const CLASS_ICONS: Record<number, string> = {
        0: '/class-titan.svg',
        1: '/class-hunter.svg',
        2: '/class-warlock.svg',
    };

    // Actions
    const handleEquip = async (characterId: string) => {
        if (!canManageInstance || !itemInstanceId || !membershipInfo || !ownerId) return;

        // Optimistic / Queue
        const promise = (async () => {
            // Mark as pending
            addOperation({
                itemHash,
                itemInstanceId,
                fromOwnerId: ownerId,
                toOwnerId: characterId,
                item: null, // Ideally we pass the item, but simpler for now
                type: 'equip'
            });

            // Logic: If not on character, move to character first.
            if (ownerId !== characterId) {
                // 1. Move to character
                await moveItem(itemInstanceId, itemHash, ownerId, characterId, membershipInfo.membershipType);
            }
            // 2. Equip
            await equipItem(itemInstanceId, characterId, membershipInfo.membershipType);
            
            // Remove from pending
            removeOperation(itemInstanceId);
        })();

        toast.promise(promise, {
            loading: 'Equipping item...',
            success: 'Item equipped!',
            error: 'Failed to equip item'
        });
        
        onClose();
    };

    const handleTransfer = async (targetOwnerId: string, targetName: string) => {
         if (!canManageInstance || !itemInstanceId || !membershipInfo || !ownerId) return;

         // Optimistic / Queue
         const promise = (async () => {
            addOperation({
                itemHash,
                itemInstanceId,
                fromOwnerId: ownerId,
                toOwnerId: targetOwnerId,
                item: null, 
                type: 'transfer'
            });

            await moveItem(itemInstanceId, itemHash, ownerId, targetOwnerId, membershipInfo.membershipType);
            removeOperation(itemInstanceId);
        })();

        toast.promise(promise, {
            loading: `Transferring to ${targetName}...`,
            success: `Moved to ${targetName}`,
            error: 'Transfer failed'
        });

        onClose();
    };

    const handleLock = async () => {
        if (!canManageInstance || !itemInstanceId || !membershipInfo || !ownerId) return;

        const promise = setItemLockState(itemInstanceId, ownerId === 'VAULT' ? stats?.characterId || characters[0]?.characterId : ownerId, membershipInfo.membershipType, !isLocked);
        
        toast.promise(promise, {
            loading: isLocked ? 'Unlocking...' : 'Locking...',
            success: isLocked ? 'Unlocked' : 'Locked',
            error: 'Failed to change lock state'
        });
        
        onClose();
    };

    const handleOpenDetails = () => {
        setDetailsItem({
            itemHash,
            itemInstanceId: detailsItemInstanceId,
            ownerId: detailsOwnerId,
        });
        onClose();
    };

    const handleOpenFullDetails = () => {
        setFullDetailsItem({
            itemHash,
            itemInstanceId: detailsItemInstanceId,
            ownerId: detailsOwnerId,
        });
        onClose();
    };

    const detailsActions = (
        <div className="flex gap-1 border-t border-white/10 bg-gray-950/80 px-3 py-2">
            <button
                onClick={handleOpenFullDetails}
                className="flex h-8 flex-1 items-center justify-center rounded-sm bg-transparent text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800/50 hover:text-white"
            >
                Full
            </button>

            <div className="w-px bg-gray-700" />

            <button
                onClick={handleOpenDetails}
                className="flex h-8 flex-1 items-center justify-center rounded-sm bg-transparent text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800/50 hover:text-white"
            >
                Details
            </button>
        </div>
    );

    if (!canManageInstance && !tooltipData) {
        return null;
    }

    return createPortal(
        <div
            ref={shellRef}
            className={cn(
                'fixed z-200 flex flex-row items-start gap-0 shadow-2xl',
                !tooltipData && canManageInstance && 'w-64'
            )}
            style={{ left: shellLayout.left, top: shellLayout.top }}
        >
            {canManageInstance && (
                <div
                    className={cn(
                        'flex w-64 shrink-0 flex-col self-start h-fit py-1 overflow-hidden text-sm text-gray-200 select-none bg-gray-800/90 backdrop-blur-md',
                        tooltipData
                            ? 'rounded-l-sm border border-white/10'
                            : 'rounded-sm border border-white/10'
                    )}
                >
                    {/* Equip Options */}
                    <div className="px-3 py-1 text-[10px] text-white uppercase tracking-wider">Equip</div>
                    <div className="flex gap-1 px-3 pb-2">
                        {characters.map((char: any) => (
                            <button
                                key={`equip-${char.characterId}`}
                                onClick={() => handleEquip(char.characterId)}
                                className="relative h-10 flex-1 rounded-sm overflow-hidden border border-white/10 hover:border-white/50 transition-colors group"
                                title={`Equip on ${classNames[char.classType as keyof typeof classNames]} (${char.light})`}
                            >
                                <div
                                    className="absolute inset-0 bg-cover bg-center opacity-70 group-hover:opacity-100 transition-opacity"
                                    style={{ backgroundImage: `url(${getBungieImage(char.emblemBackgroundPath)})` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <Image
                                        src={CLASS_ICONS[char.classType]}
                                        width={28}
                                        height={28}
                                        className="object-contain drop-shadow-md"
                                        alt={classNames[char.classType as keyof typeof classNames]}
                                    />
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="h-px bg-gray-700 my-1 mx-3" />

                    {/* Store / Transfer Options */}
                    <div className="px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">Store</div>
                    <div className="flex gap-1 px-3 pb-2">
                        {characters.map((char: any) => (
                            <button
                                key={`store-${char.characterId}`}
                                onClick={() => handleTransfer(char.characterId, classNames[char.classType as keyof typeof classNames])}
                                className="relative h-10 flex-1 rounded-sm overflow-hidden border border-white/10 hover:border-white/50 transition-colors group"
                                title={`Store on ${classNames[char.classType as keyof typeof classNames]}`}
                            >
                                <div
                                    className="absolute inset-0 bg-cover bg-center opacity-70 group-hover:opacity-100 transition-opacity"
                                    style={{ backgroundImage: `url(${getBungieImage(char.emblemBackgroundPath)})` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <Image
                                        src={CLASS_ICONS[char.classType]}
                                        width={20}
                                        height={20}
                                        className="object-contain drop-shadow-md"
                                        alt={classNames[char.classType as keyof typeof classNames]}
                                    />
                                </div>
                            </button>
                        ))}
                        <button
                            onClick={() => handleTransfer('VAULT', 'Vault')}
                            className="relative h-10 flex-1 rounded-sm overflow-hidden border border-white/10 hover:border-white/50 transition-colors group bg-slate-800"
                            title="Vault"
                        >
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="w-7 h-7 flex items-center justify-center bg-slate-700 rounded-sm group-hover:bg-slate-600 transition-colors">
                                    <div className="w-3.5 h-3.5 bg-slate-400 rotate-45" />
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="h-px bg-gray-700 my-1 mx-3" />

                    <div className="px-3 pb-2">
                        <button
                            onClick={handleLock}
                            className="h-8 w-full bg-transparent text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800/30 hover:text-white"
                        >
                            {isLocked ? 'Unlock' : 'Lock'}
                        </button>
                    </div>

                </div>
            )}

            {tooltipData && (
                <div
                    ref={tooltipRef}
                    className={cn(
                        "flex h-fit w-[350px] shrink-0 flex-col min-w-0 overflow-visible border border-white/10 bg-gray-950/40 backdrop-blur-md",
                        canManageInstance ? "rounded-r-sm" : "rounded-sm"
                    )}
                >
                    <ItemTooltip
                        {...tooltipData}
                        docked
                        fixedPosition={true}
                        onPlugClick={(socketIndex, plugHash) =>
                            handleEquipPlug(socketIndex, plugHash)
                        }
                    />
                    {detailsActions}
                </div>
            )}
        </div>,
        document.body
    );

}
