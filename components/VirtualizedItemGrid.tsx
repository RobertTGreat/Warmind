'use client';

import { VirtuosoGrid, GridComponents, GridItemContent, GridScrollSeekPlaceholderProps } from 'react-virtuoso';
import { DestinyItemCard } from './DestinyItemCard';
import { cn } from '@/lib/utils';
import { ComponentType, forwardRef, useMemo, useCallback, memo, CSSProperties, HTMLAttributes } from 'react';

// --- Types ---
export interface VirtualizedItem {
    itemHash: number;
    itemInstanceId?: string;
    quantity?: number;
    bucketHash?: number;
    // Additional instance/socket data to pass through
    instanceData?: any;
    socketsData?: any;
    reusablePlugs?: any[];
}

export interface VirtualizedItemGridProps {
    items: VirtualizedItem[];
    iconSize: 'small' | 'medium' | 'large';
    ownerId: string;
    checkMatch?: (item: VirtualizedItem) => boolean;
    onDragStart?: (e: React.DragEvent, item: VirtualizedItem) => void;
    className?: string;
    containerHeight?: number | string;
    overscan?: number; // Extra rows to render (default: 5)
    minItemWidth?: number;
    gap?: number;
}

// --- Size configurations ---
const SIZE_CONFIG = {
    small: { width: 64, height: 64, gap: 4 },
    medium: { width: 80, height: 80, gap: 4 },
    large: { width: 96, height: 96, gap: 4 }
} as const;

// --- Placeholder component for fast scrolling ---
const ItemPlaceholder = memo(({ 
    iconSize 
}: { 
    iconSize: 'small' | 'medium' | 'large' 
}) => {
    const config = SIZE_CONFIG[iconSize];
    return (
        <div 
            className="bg-slate-800/40 border border-white/5 animate-pulse rounded-sm"
            style={{ width: config.width, height: config.height }}
            data-placeholder="true"
        />
    );
});
ItemPlaceholder.displayName = 'ItemPlaceholder';

// --- Grid Item Component ---
interface ItemRendererProps {
    item: VirtualizedItem;
    iconSize: 'small' | 'medium' | 'large';
    ownerId: string;
    isHighlighted: boolean;
}

const ItemRenderer = memo(({ 
    item, 
    iconSize, 
    ownerId,
    isHighlighted
}: ItemRendererProps) => {
    const iconSizeClass = {
        small: 'w-16 h-16',
        medium: 'w-20 h-20',
        large: 'w-24 h-24'
    }[iconSize];

    return (
        <DestinyItemCard
            itemHash={item.itemHash}
            instanceData={item.instanceData}
            socketsData={item.socketsData}
            reusablePlugs={item.reusablePlugs}
            className={iconSizeClass}
            isHighlighted={isHighlighted}
            itemInstanceId={item.itemInstanceId}
            ownerId={ownerId}
            quantity={item.quantity}
            size={iconSize}
        />
    );
});
ItemRenderer.displayName = 'ItemRenderer';

// --- Main Component ---
export function VirtualizedItemGrid({
    items,
    iconSize,
    ownerId,
    checkMatch,
    className,
    containerHeight = 400,
    overscan = 200, // Render extra 200px of items (roughly 2-3 rows)
    minItemWidth,
    gap
}: VirtualizedItemGridProps) {
    const config = SIZE_CONFIG[iconSize];
    const itemWidth = minItemWidth || config.width;
    const itemHeight = config.height + 28; // Account for the stats row below items
    const gridGap = gap ?? config.gap;

    // Memoize item rendering to prevent unnecessary re-renders
    const itemContent = useCallback((index: number, item: VirtualizedItem) => {
        const isHighlighted = checkMatch ? checkMatch(item) : true;
        
        return (
            <ItemRenderer
                item={item}
                iconSize={iconSize}
                ownerId={ownerId}
                isHighlighted={isHighlighted}
            />
        );
    }, [iconSize, ownerId, checkMatch]);

    // Custom list component with CSS grid
    const List = useMemo(() => {
        const ListComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
            <div
                ref={ref}
                {...props}
                style={{
                    ...props.style,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: `${gridGap}px`,
                }}
            />
        ));
        ListComponent.displayName = 'VirtualizedList';
        return ListComponent;
    }, [gridGap]);

    // Custom item container
    const Item = useMemo(() => {
        const ItemComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
            <div
                ref={ref}
                {...props}
                style={{
                    ...props.style,
                    width: itemWidth,
                    height: itemHeight,
                }}
            />
        ));
        ItemComponent.displayName = 'VirtualizedItem';
        return ItemComponent;
    }, [itemWidth, itemHeight]);

    // Placeholder for scroll seek
    const ScrollSeekPlaceholder = useCallback((props: GridScrollSeekPlaceholderProps) => (
        <ItemPlaceholder iconSize={iconSize} />
    ), [iconSize]);

    // Grid components configuration
    const components: GridComponents<VirtualizedItem> = useMemo(() => ({
        List,
        Item,
        ScrollSeekPlaceholder,
    }), [List, Item, ScrollSeekPlaceholder]);

    // Transform items to include data property for virtuoso
    const itemsWithData = useMemo(() => 
        items.map(item => ({ ...item, data: item })), 
        [items]
    );

    if (items.length === 0) {
        return (
            <div className={cn("flex items-center justify-center text-slate-500 text-sm py-8", className)}>
                No items
            </div>
        );
    }

    return (
        <VirtuosoGrid
            style={{ height: containerHeight }}
            totalCount={items.length}
            data={items}
            overscan={overscan}
            components={components}
            itemContent={itemContent}
            scrollSeekConfiguration={{
                enter: (velocity) => Math.abs(velocity) > 800,
                exit: (velocity) => Math.abs(velocity) < 100,
            }}
            className={cn("custom-scrollbar", className)}
        />
    );
}

// --- Grouped Virtualized Grid (for vault sections) ---
export interface GroupedVirtualizedGridProps {
    groups: {
        key: string;
        label: string;
        items: VirtualizedItem[];
        labelClassName?: string;
    }[];
    iconSize: 'small' | 'medium' | 'large';
    ownerId: string;
    checkMatch?: (item: VirtualizedItem) => boolean;
    containerHeight?: number | string;
    gap?: number;
}

export function GroupedVirtualizedGrid({
    groups,
    iconSize,
    ownerId,
    checkMatch,
    containerHeight = 400,
    gap
}: GroupedVirtualizedGridProps) {
    const config = SIZE_CONFIG[iconSize];
    const gridGap = gap ?? config.gap;

    // For small lists, don't virtualize - just render normally
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
    
    if (totalItems < 50) {
        const iconSizeClass = {
            small: 'w-16 h-16',
            medium: 'w-20 h-20',
            large: 'w-24 h-24'
        }[iconSize];

        return (
            <div className="flex flex-col gap-6">
                {groups.map(group => {
                    if (group.items.length === 0) return null;
                    return (
                        <div key={group.key}>
                            <h4 className={cn("text-[10px] uppercase font-bold mb-2", group.labelClassName || "text-slate-500")}>
                                {group.label}
                            </h4>
                            <div 
                                className="flex flex-wrap" 
                                style={{ gap: `${gridGap}px` }}
                            >
                                {group.items.map((item, idx) => (
                                    <DestinyItemCard
                                        key={`${item.itemHash}-${item.itemInstanceId || idx}`}
                                        itemHash={item.itemHash}
                                        instanceData={item.instanceData}
                                        socketsData={item.socketsData}
                                        reusablePlugs={item.reusablePlugs}
                                        className={iconSizeClass}
                                        isHighlighted={checkMatch ? checkMatch(item) : true}
                                        itemInstanceId={item.itemInstanceId}
                                        ownerId={ownerId}
                                        quantity={item.quantity}
                                        size={iconSize}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // For larger lists, use virtualization per group
    return (
        <div className="flex flex-col gap-6" style={{ height: containerHeight, overflow: 'auto' }}>
            {groups.map(group => {
                if (group.items.length === 0) return null;
                return (
                    <div key={group.key}>
                        <h4 className={cn("text-[10px] uppercase font-bold mb-2 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-sm py-1 z-10", group.labelClassName || "text-slate-500")}>
                            {group.label}
                        </h4>
                        <VirtualizedItemGrid
                            items={group.items}
                            iconSize={iconSize}
                            ownerId={ownerId}
                            checkMatch={checkMatch}
                            containerHeight="auto"
                            gap={gridGap}
                        />
                    </div>
                );
            })}
        </div>
    );
}

export default VirtualizedItemGrid;

