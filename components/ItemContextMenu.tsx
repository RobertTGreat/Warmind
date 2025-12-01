import React, { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { equipItem, setItemLockState, getBungieImage, moveItem, insertSocketPlugFree } from '@/lib/bungie';
import { toast } from 'sonner';
import { useTransferStore } from '@/store/transferStore';
import { useUIStore } from '@/store/uiStore';
import { ItemTooltip, WishListInfo } from './ItemTooltip';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';

interface ItemContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    itemHash: number;
    itemInstanceId?: string;
    ownerId?: string; // Character ID or 'VAULT'
    isLocked?: boolean;
    itemDef?: any;
    sockets?: { socket: any, def: any }[];
    instanceData?: any;
    detailedPerks?: any[];
    wishListInfo?: WishListInfo;
    socketsData?: any;
    plugDefs?: Record<number, any>;
}

export function ItemContextMenu({ 
    x, y, onClose, itemHash, itemInstanceId, ownerId, isLocked, 
    itemDef, sockets, instanceData, detailedPerks, wishListInfo, socketsData, plugDefs
}: ItemContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const { profile, stats, membershipInfo } = useDestinyProfile();
    const addOperation = useTransferStore(state => state.addOperation);
    const removeOperation = useTransferStore(state => state.removeOperation);
    const setDetailsItem = useUIStore(state => state.setDetailsItem);

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

    // Prepare Tooltip Data
    const tooltipData = useMemo(() => {
        if (!itemDef) return null;

        // Separate sockets into detailed perks and mods
        const mods: any[] = [];
        const shaders: any[] = [];
        const ornaments: any[] = [];
        const killEffects: any[] = [];
        const killTrackers: any[] = [];

        sockets?.forEach((s) => {
            if (!s.def) return;
            const type = s.def.itemTypeDisplayName?.toLowerCase() || "";
            const name = s.def.displayProperties?.name?.toLowerCase() || "";
            
            if (type.includes("shader")) {
                shaders.push(s.def);
                return;
            }
            if (type.includes("ornament")) {
                ornaments.push(s.def);
                return;
            }
            if (type.includes("tracker") || name.includes("kill tracker")) {
                killTrackers.push(s.def);
                return;
            }
            if (type.includes("combat flair")) {
                killEffects.push(s.def);
                return;
            }
            if (type.includes("intrinsic")) {
                return;
            }

            // Mods
            if (type.includes("mod")) {
                mods.push(s.def);
                return;
            }
        });

        return {
            name: itemDef.displayProperties?.name,
            itemType: itemDef.itemTypeDisplayName,
            rarity: itemDef.inventory?.tierTypeName || 'Common',
            icon: itemDef.displayProperties?.icon ? getBungieImage(itemDef.displayProperties.icon) : undefined,
            power: instanceData?.primaryStat?.value,
            screenshot: itemDef.screenshot ? getBungieImage(itemDef.screenshot) : undefined,
            flavorText: itemDef.flavorText,
            stats: instanceData?.stats, 
            perks: [], // Legacy prop, empty because we use detailedPerks
            detailedPerks, // Use passed detailedPerks
            mods,
            shaders,
            ornaments,
            killEffects,
            killTrackers,
            enhancementTier: undefined, 
            tier: undefined,
            wishListInfo,
            socketsData,
            plugDefs
        };
    }, [itemDef, sockets, instanceData, detailedPerks, wishListInfo, socketsData, plugDefs]);
    
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) && 
                (!tooltipRef.current || !tooltipRef.current.contains(e.target as Node))) {
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

    if (!itemInstanceId || !membershipInfo || !ownerId) return null;

    const characters = profile?.characters?.data ? Object.values(profile.characters.data) as any[] : [];
    const classNames = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
    const CLASS_ICONS: Record<number, string> = {
        0: '/class-titan.svg',
        1: '/class-hunter.svg',
        2: '/class-warlock.svg',
    };

    // Actions
    const handleEquip = async (characterId: string) => {
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
        const promise = setItemLockState(itemInstanceId, ownerId === 'VAULT' ? stats?.characterId || characters[0]?.characterId : ownerId, membershipInfo.membershipType, !isLocked);
        
        toast.promise(promise, {
            loading: isLocked ? 'Unlocking...' : 'Locking...',
            success: isLocked ? 'Unlocked' : 'Locked',
            error: 'Failed to change lock state'
        });
        
        onClose();
    };

    return createPortal(
        <div 
            ref={menuRef}
            className="fixed z-200 w-64 bg-gray-800/20 border border-white/10 shadow-2xl py-0 text-sm text-gray-200 select-none flex flex-col backdrop-blur-xl rounded-sm overflow-hidden"
            style={{ left: x, top: y }}
        >
            {/* Static Tooltip to the right */}
            {tooltipData && (
                <ItemTooltip 
                    {...tooltipData} 
                    initialPosition={{ x: x + 264, y: y }} 
                    fixedPosition={true}
                    itemDef={itemDef}
                    onPlugClick={(socketIndex, plugHash) => handleEquipPlug(socketIndex, plugHash)}
                    containerRef={tooltipRef}
                    showWishListSection={true}
                />
            )}

            {/* Actions List */}
            <div className="py-1">
                {/* Equip Options */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Equip</div>
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

            <div className="flex gap-1 px-3 pb-2">
                <button 
                    onClick={handleLock} 
                    className="flex-1 h-8 flex items-center justify-center bg-transparent hover:bg-gray-800/30 rounded-sm text-xs font-medium text-gray-300 hover:text-white transition-colors"
                >
                    {isLocked ? 'Unlock' : 'Lock'}
                </button>

                <button 
                    onClick={() => { 
                        setDetailsItem({ itemHash, itemInstanceId });
                        onClose(); 
                    }} 
                    className="flex-1 h-8 flex items-center justify-center bg-transparent hover:bg-gray-800/30 rounded-sm text-xs font-medium text-gray-300 hover:text-white transition-colors"
                >
                    Details
                </button>
            </div>
        </div>
    </div>,
        document.body
    );

}
