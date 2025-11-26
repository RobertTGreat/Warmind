'use client';

import { VirtuosoGrid, GridComponents, GridItemContent, GridScrollSeekPlaceholderProps } from 'react-virtuoso';
import { DestinyItemCard } from './DestinyItemCard';
import { cn } from '@/lib/utils';
import { forwardRef, useMemo, useCallback, memo, CSSProperties, HTMLAttributes, useRef } from 'react';

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
    maxHeight?: number;
    gap?: number;
}

// --- Size configurations ---
const SIZE_CONFIG = {
    small: { width: 64, height: 64, gap: 4, itemHeight: 92 },
    medium: { width: 80, height: 80, gap: 4, itemHeight: 108 },
    large: { width: 96, height: 96, gap: 4, itemHeight: 124 }
} as const;

// --- Placeholder for fast scrolling ---
const ItemPlaceholder = memo(({ iconSize }: { iconSize: 'small' | 'medium' | 'large' }) => {
    const config = SIZE_CONFIG[iconSize];
    return (
        <div 
            className="bg-slate-800/30 border border-white/5 animate-pulse rounded-sm"
            style={{ width: config.width, height: config.height }}
        />
    );
});
ItemPlaceholder.displayName = 'ItemPlaceholder';

// --- Grid Item Renderer ---
interface ItemRendererProps {
    item: VaultItem;
    iconSize: 'small' | 'medium' | 'large';
    ownerId: string;
    isHighlighted: boolean;
    instanceData?: any;
    socketsData?: any;
    reusablePlugs?: any[];
}

const ItemRenderer = memo(({ 
    item, 
    iconSize, 
    ownerId,
    isHighlighted,
    instanceData,
    socketsData,
    reusablePlugs
}: ItemRendererProps) => {
    const iconSizeClass = {
        small: 'w-16 h-16',
        medium: 'w-20 h-20',
        large: 'w-24 h-24'
    }[iconSize];

    // Only pass quantity for non-instanced items (consumables, materials)
    // Instanced items (weapons, armor) should show power instead
    const showQuantity = !item.itemInstanceId && item.quantity && item.quantity > 0;

    return (
        <DestinyItemCard
            itemHash={item.itemHash}
            instanceData={instanceData}
            socketsData={socketsData}
            reusablePlugs={reusablePlugs}
            className={iconSizeClass}
            isHighlighted={isHighlighted}
            itemInstanceId={item.itemInstanceId}
            ownerId={ownerId}
            quantity={showQuantity ? item.quantity : undefined}
            size={iconSize}
        />
    );
}, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
        prevProps.item.itemInstanceId === nextProps.item.itemInstanceId &&
        prevProps.item.itemHash === nextProps.item.itemHash &&
        prevProps.iconSize === nextProps.iconSize &&
        prevProps.isHighlighted === nextProps.isHighlighted &&
        prevProps.instanceData === nextProps.instanceData
    );
});
ItemRenderer.displayName = 'ItemRenderer';

/**
 * VaultGrid - A virtualized grid for displaying vault items
 * 
 * Features:
 * - Only renders visible items + 5 extra rows (overscan)
 * - Supports drag-and-drop (pass onDragOver and onDrop)
 * - Preserves hover tooltips (handled by DestinyItemCard)
 * - Fast scroll placeholders
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
    maxHeight = 400,
    gap
}: VaultGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const config = SIZE_CONFIG[iconSize];
    const gridGap = gap ?? config.gap;

    // For small item counts, use regular flex layout (no virtualization overhead)
    const VIRTUALIZATION_THRESHOLD = 30;
    
    if (items.length <= VIRTUALIZATION_THRESHOLD) {
        const iconSizeClass = {
            small: 'w-16 h-16',
            medium: 'w-20 h-20',
            large: 'w-24 h-24'
        }[iconSize];

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
                        />
                    );
                })}
            </div>
        );
    }

    // For larger collections, use virtualization
    // Create grid list component
    const List = useMemo(() => {
        const ListComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
            <div
                ref={ref}
                {...props}
                onDragOver={onDragOver}
                onDrop={onDrop}
                style={{
                    ...props.style,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: `${gridGap}px`,
                }}
            />
        ));
        ListComponent.displayName = 'VaultGridList';
        return ListComponent;
    }, [gridGap, onDragOver, onDrop]);

    // Item container
    const Item = useMemo(() => {
        const ItemComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { 'data-index'?: number }>((props, ref) => (
            <div
                ref={ref}
                {...props}
                style={{
                    ...props.style,
                    width: config.width,
                    minHeight: config.itemHeight,
                }}
            />
        ));
        ItemComponent.displayName = 'VaultGridItem';
        return ItemComponent;
    }, [config.width, config.itemHeight]);

    // Placeholder for fast scrolling
    const ScrollSeekPlaceholder = useCallback((props: GridScrollSeekPlaceholderProps) => (
        <div>
            <ItemPlaceholder iconSize={iconSize} />
        </div>
    ), [iconSize]);

    // Grid components config
    const components: GridComponents<VaultItem> = useMemo(() => ({
        List,
        Item,
        ScrollSeekPlaceholder,
    }), [List, Item, ScrollSeekPlaceholder]);

    // Item content renderer
    const itemContent = useCallback((index: number, item: VaultItem) => {
        const isHighlighted = checkMatch ? checkMatch(item) : true;
        
        return (
            <ItemRenderer
                item={item}
                iconSize={iconSize}
                ownerId={ownerId}
                isHighlighted={isHighlighted}
                instanceData={item.itemInstanceId ? getInstanceData?.(item.itemInstanceId) : undefined}
                socketsData={item.itemInstanceId ? getSocketsData?.(item.itemInstanceId) : undefined}
                reusablePlugs={item.itemInstanceId ? getReusablePlugs?.(item.itemInstanceId) : undefined}
            />
        );
    }, [iconSize, ownerId, checkMatch, getInstanceData, getSocketsData, getReusablePlugs]);

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
        <div ref={containerRef} className={className}>
            <VirtuosoGrid
                style={{ height: maxHeight, minHeight: 60 }}
                totalCount={items.length}
                data={items}
                overscan={200} // ~5 rows extra
                components={components}
                itemContent={itemContent}
                scrollSeekConfiguration={{
                    enter: (velocity) => Math.abs(velocity) > 1000,
                    exit: (velocity) => Math.abs(velocity) < 200,
                }}
                className="custom-scrollbar"
            />
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
    maxHeight?: number;
    gap?: number;
}

/**
 * GroupedVaultGrid - Renders vault items grouped by category (rarity, class, etc.)
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
    maxHeight = 400,
    gap
}: GroupedVaultGridProps) {
    const config = SIZE_CONFIG[iconSize];
    const gridGap = gap ?? config.gap;
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

    // For small total counts, render without inner virtualization
    const iconSizeClass = {
        small: 'w-16 h-16',
        medium: 'w-20 h-20',
        large: 'w-24 h-24'
    }[iconSize];

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
                            maxHeight={totalItems > 100 ? 300 : undefined}
                        />
                    </div>
                );
            })}
        </div>
    );
}

export default VaultGrid;

