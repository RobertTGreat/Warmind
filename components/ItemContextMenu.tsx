import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { equipItem, setItemLockState, getBungieImage, moveItem } from '@/lib/bungie';
import { toast } from 'sonner';
import { useTransferStore } from '@/store/transferStore';
import { useUIStore } from '@/store/uiStore';

interface ItemContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    itemHash: number;
    itemInstanceId?: string;
    ownerId?: string; // Character ID or 'VAULT'
    isLocked?: boolean;
}

export function ItemContextMenu({ x, y, onClose, itemHash, itemInstanceId, ownerId, isLocked }: ItemContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const { profile, stats, membershipInfo } = useDestinyProfile();
    const addOperation = useTransferStore(state => state.addOperation);
    const removeOperation = useTransferStore(state => state.removeOperation);
    const setDetailsItem = useUIStore(state => state.setDetailsItem);
    
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
            className="fixed z-[200] w-56 bg-gray-800/20 border border-gray-700 shadow-xl py-1 text-sm text-gray-200 select-none flex flex-col backdrop-blur-xl"
            style={{ left: x, top: y }}
        >
            {/* Equip Options */}
            <div className="px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">Equip</div>
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
        </div>,
        document.body
    );
}
