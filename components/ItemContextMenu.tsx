import React, { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { equipItem, setItemLockState, getBungieImage, moveItem } from '@/lib/bungie';
import { toast } from 'sonner';
import { useTransferStore } from '@/store/transferStore';
import { useUIStore } from '@/store/uiStore';
import { ItemTooltip } from './ItemTooltip';
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
}

export function ItemContextMenu({ 
    x, y, onClose, itemHash, itemInstanceId, ownerId, isLocked, 
    itemDef, sockets, instanceData, detailedPerks 
}: ItemContextMenuProps & { detailedPerks?: any[] }) {
    const menuRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const { profile, stats, membershipInfo } = useDestinyProfile();
    const addOperation = useTransferStore(state => state.addOperation);
    const removeOperation = useTransferStore(state => state.removeOperation);
    const setDetailsItem = useUIStore(state => state.setDetailsItem);

    const handleEquipPlug = async (socketIndex: number, plugItemHash: number) => {
        if (!itemInstanceId || !membershipInfo || !ownerId) return;
        
        // Helper to find actual owner if VAULT (needs character ID for action context)
        const characterId = ownerId === 'VAULT' ? stats?.characterId || Object.keys(profile?.characters?.data || {})[0] : ownerId;

        const promise = (async () => {
            // Note: This function insertSocketPlug needs to be imported or available
            // Assuming it's exported from bungie lib based on previous context
            const { insertSocketPlug } = await import('@/lib/bungie');
            await insertSocketPlug(itemInstanceId, plugItemHash, socketIndex, characterId, membershipInfo.membershipType);
        })();

        toast.promise(promise, {
            loading: 'Applying perk...',
            success: 'Perk applied!',
            error: 'Failed to apply perk'
        });
        // Don't close menu so user can see change (if we had live update) or just close
        // onClose(); 
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
            tier: undefined 
        };
    }, [itemDef, sockets, instanceData, detailedPerks]);
    
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
            className="fixed z-200 w-64 bg-gray-900/90 border border-white/10 shadow-2xl py-0 text-sm text-gray-200 select-none flex flex-col backdrop-blur-xl rounded-sm overflow-hidden"
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
                />
            )}

            {/* Actions List */}
            <div className="py-1">
                {/* Equip Options */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Equip</div>
            {characters.map((char: any) => (
                <button 
                    key={`equip-${char.characterId}`}
                    onClick={() => handleEquip(char.characterId)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"
                >
                     <div 
                        className="w-4 h-4 bg-contain bg-center bg-no-repeat rounded-sm"
                        style={{ backgroundImage: `url(${getBungieImage(char.emblemPath)})` }} 
                    />
                    <span>{classNames[char.classType as keyof typeof classNames]}</span>
                    <span className="text-xs text-destiny-gold ml-auto">{char.light}</span>
                </button>
            ))}
            
            <div className="h-px bg-gray-700 my-1" />

            {/* Store / Transfer Options */}
            <div className="px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">Store</div>
            {characters.map((char: any) => (
                <button 
                    key={`store-${char.characterId}`}
                    onClick={() => handleTransfer(char.characterId, classNames[char.classType as keyof typeof classNames])}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"
                >
                    <div 
                        className="w-4 h-4 bg-contain bg-center bg-no-repeat rounded-sm"
                        style={{ backgroundImage: `url(${getBungieImage(char.emblemPath)})` }} 
                    />
                    <span>{classNames[char.classType as keyof typeof classNames]}</span>
                </button>
            ))}
             <button 
                onClick={() => handleTransfer('VAULT', 'Vault')}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"
            >
                <div className="w-4 h-4 flex items-center justify-center bg-slate-800 rounded-sm">
                   <div className="w-2 h-2 bg-slate-400 rotate-45" />
                </div>
                <span>Vault</span>
            </button>
             
            <div className="h-px bg-gray-700 my-1" />

            <button onClick={handleLock} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex justify-between">
                <span>{isLocked ? 'Unlock' : 'Lock'}</span>
            </button>

            <button onClick={() => { 
                setDetailsItem({ itemHash, itemInstanceId });
                onClose(); 
            }} className="w-full text-left px-4 py-2 hover:bg-gray-700">
                Details
            </button>
        </div>
    </div>,
        document.body
    );

}
