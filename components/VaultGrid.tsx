'use client';

import { DestinyItemCard } from './DestinyItemCard';
import { cn } from '@/lib/utils';
import { memo, useRef } from 'react';

// --- Types ---
export interface VaultItem {
    itemHash: number;
    itemInstanceId?: string;
    quantity?: number;
    bucketHash?: number;
}

export interface VaultGridProps {
    items: VaultItem[];
    iconSize: 'small' | 'medium' | 'large';
    ownerId: string;
    checkMatch?: (item: VaultItem) => boolean;
    getInstanceData?: (itemInstanceId: string) => any;
    getSocketsData?: (itemInstanceId: string) => any;
    getReusablePlugs?: (itemInstanceId: string) => any[];
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    className?: string;
    maxHeight?: number; // Kept for backwards compatibility, but ignored
    gap?: number;
}

// --- Size configurations ---
const SIZE_CONFIG = {
    small: { width: 64, height: 64, gap: 4 },
    medium: { width: 80, height: 80, gap: 4 },
    large: { width: 96, height: 96, gap: 4 }
} as const;

/**
 * VaultGrid - A simple grid for displaying vault items
 * 
 * Features:
 * - Displays ALL items without internal scrolling
 * - Supports drag-and-drop (pass onDragOver and onDrop)
 * - Preserves hover tooltips (handled by DestinyItemCard)
 */
export function VaultGrid({
    items,
    iconSize,
    ownerId,
    checkMatch,
    getInstanceData,
    getSocketsData,
    getReusablePlugs,
    onDragOver,
    onDrop,
    className,
    gap
}: VaultGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const config = SIZE_CONFIG[iconSize];
    const gridGap = gap ?? config.gap;

    const iconSizeClass = {
        small: 'w-16 h-16',
        medium: 'w-20 h-20',
        large: 'w-24 h-24'
    }[iconSize];

    if (items.length === 0) {
        return (
            <div 
                className={cn("flex items-center justify-center text-slate-600 text-xs italic py-4 min-h-[60px]", className)}
                onDragOver={onDragOver}
                onDrop={onDrop}
            >
                No items in vault
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className={cn("flex flex-wrap min-h-[60px]", className)}
            style={{ gap: `${gridGap}px` }}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {items.map((item, idx) => {
                // Only pass quantity for non-instanced items (consumables, materials)
                // Instanced items (weapons, armor) should show power instead
                const showQuantity = !item.itemInstanceId && item.quantity && item.quantity > 0;
                
                return (
                    <DestinyItemCard
                        key={`${item.itemHash}-${item.itemInstanceId || idx}`}
                        itemHash={item.itemHash}
                        instanceData={item.itemInstanceId ? getInstanceData?.(item.itemInstanceId) : undefined}
                        socketsData={item.itemInstanceId ? getSocketsData?.(item.itemInstanceId) : undefined}
                        reusablePlugs={item.itemInstanceId ? getReusablePlugs?.(item.itemInstanceId) : undefined}
                        className={iconSizeClass}
                        isHighlighted={checkMatch ? checkMatch(item) : true}
                        itemInstanceId={item.itemInstanceId}
                        ownerId={ownerId}
                        quantity={showQuantity ? item.quantity : undefined}
                        size={iconSize}
                        imageFetchPriority="low"
                    />
                );
            })}
        </div>
    );
}

// --- Grouped Vault Grid ---
export interface GroupedVaultGridProps {
    groups: {
        key: string | number;
        label: string;
        items: VaultItem[];
        labelClassName?: string;
    }[];
    iconSize: 'small' | 'medium' | 'large';
    ownerId: string;
    checkMatch?: (item: VaultItem) => boolean;
    getInstanceData?: (itemInstanceId: string) => any;
    getSocketsData?: (itemInstanceId: string) => any;
    getReusablePlugs?: (itemInstanceId: string) => any[];
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    maxHeight?: number; // Kept for backwards compatibility, but ignored
    gap?: number;
}

/**
 * GroupedVaultGrid - Renders vault items grouped by category (rarity, class, etc.)
 * Displays ALL items without internal scrolling
 */
export function GroupedVaultGrid({
    groups,
    iconSize,
    ownerId,
    checkMatch,
    getInstanceData,
    getSocketsData,
    getReusablePlugs,
    onDragOver,
    onDrop,
    gap
}: GroupedVaultGridProps) {
    const config = SIZE_CONFIG[iconSize];
    const gridGap = gap ?? config.gap;

    return (
        <div 
            className="flex flex-col gap-6 min-h-[60px]"
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {groups.map(group => {
                if (group.items.length === 0) return null;
                
                return (
                    <div key={group.key}>
                        <h4 className={cn(
                            "text-[10px] uppercase font-bold mb-2",
                            group.labelClassName || "text-slate-500"
                        )}>
                            {group.label}
                        </h4>
                        <VaultGrid
                            items={group.items}
                            iconSize={iconSize}
                            ownerId={ownerId}
                            checkMatch={checkMatch}
                            getInstanceData={getInstanceData}
                            getSocketsData={getSocketsData}
                            getReusablePlugs={getReusablePlugs}
                            gap={gridGap}
                        />
                    </div>
                );
            })}
        </div>
    );
}

export default VaultGrid;

