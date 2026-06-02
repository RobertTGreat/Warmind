import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { VirtuosoGrid, type GridComponents } from 'react-virtuoso';
import { usePresentationNode } from '@/hooks/useDefinitions';
import { ChevronRight, Search, Lock, Eye, EyeOff } from 'lucide-react';
import { getBungieImage } from '@/lib/bungie';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { cn } from '@/lib/utils';
import { useManifestTable } from '@/hooks/useManifestTable';
import { ItemTile, type ItemTileModel } from '@/components/ItemTile';
import { DestinyItemCard } from '@/components/DestinyItemCard';
import { buildBungieIconUrl, getClientManifestVersionCacheKey, normalizeBungieAssetPath } from '@/lib/bungieImageProxy';
import { PRESENTATION_NODES } from "@/lib/destinyUtils";

interface CollectionsBrowserProps {
    rootHash: number;
}

type CollectionTileModel = ItemTileModel & {
    collectibleHash: number;
    isAcquired: boolean;
    definition: any;
};

const COLLECTION_TILE_SIZE_PX = 80;
const COLLECTION_TILE_DECODE_WIDTH = 160;

function getCollectibleState(profile: any, collectibleHash: number) {
    let state = profile?.profileCollectibles?.data?.collectibles?.[collectibleHash]?.state;

    if (state === undefined && profile?.characterCollectibles?.data) {
        const characterIds = Object.keys(profile.characterCollectibles.data);

        for (const characterId of characterIds) {
            const characterState =
                profile.characterCollectibles.data[characterId]?.collectibles?.[collectibleHash]?.state;

            if (characterState !== undefined) {
                if ((characterState & 1) === 0) {
                    return characterState;
                }

                if (state === undefined) {
                    state = characterState;
                }
            }
        }
    }

    return state ?? 1;
}

function buildCollectionTileModels(
    collectibleChildren: any[],
    collectibleTable: Record<string, any> | undefined,
    itemTable: Record<string, any> | undefined,
    profile: any,
    showAll: boolean
): CollectionTileModel[] {
    if (!collectibleTable || !itemTable) return [];

    const manifestVersion = getClientManifestVersionCacheKey();

    return collectibleChildren.flatMap((child: any) => {
        const collectibleHash = child.collectibleHash;
        const collectible = collectibleTable[String(collectibleHash)];
        const itemDefinition = itemTable[String(collectible?.itemHash)];

        if (!collectible || !itemDefinition) return [];

        const state = getCollectibleState(profile, collectibleHash);
        const isAcquired = (state & 1) === 0;
        const isVisible = (state & 4) === 0;

        if (!isVisible) return [];
        if (!showAll && isAcquired) return [];

        const iconPath = normalizeBungieAssetPath(itemDefinition.displayProperties?.icon);
        const watermarkPath = normalizeBungieAssetPath(
            itemDefinition.iconWatermark || itemDefinition.iconWatermarkShelved
        );

        return [{
            collectibleHash,
            itemHash: collectible.itemHash,
            name: itemDefinition.displayProperties?.name ?? String(collectible.itemHash),
            iconSrc: iconPath
                ? buildBungieIconUrl(iconPath, COLLECTION_TILE_DECODE_WIDTH, manifestVersion)
                : null,
            watermarkSrc: watermarkPath
                ? buildBungieIconUrl(watermarkPath, COLLECTION_TILE_DECODE_WIDTH, manifestVersion)
                : null,
            rarityClassName: isAcquired ? "border-white/20" : "border-white/10",
            isDimmed: !isAcquired,
            isAcquired,
            definition: itemDefinition,
        }];
    });
}

export function CollectionsBrowser({ rootHash }: CollectionsBrowserProps) {
    const { node: rootNode, isLoading: isRootLoading } = usePresentationNode(rootHash);
    const [selectedTopHash, setSelectedTopHash] = useState<number | null>(null);
    const [selectedTier2Hash, setSelectedTier2Hash] = useState<number | null>(null);
    const [selectedTier3Hash, setSelectedTier3Hash] = useState<number | null>(null);
    const [showAll, setShowAll] = useState(true);

    // Initialize state from local storage on mount
    useEffect(() => {
        const storedShowAll = localStorage.getItem('collections_show_all');
        if (storedShowAll !== null) {
            setShowAll(storedShowAll === 'true');
        }
    }, []);

    const handleToggleShowAll = () => {
        const newValue = !showAll;
        setShowAll(newValue);
        localStorage.setItem('collections_show_all', String(newValue));
    };

    const topLevelNodes = useMemo(() => {
        const rawNodes = rootNode?.children?.presentationNodes || [];
        if (!rawNodes.length) return [];

        // Find Exotics Node
        const exoticsNode = rawNodes.find((n: any) => n.presentationNodeHash === PRESENTATION_NODES.EXOTICS);
        
        // Filter out Recently Discovered (3306548141) and Exotics (to re-add at top)
        const otherNodes = rawNodes.filter((n: any) => 
            n.presentationNodeHash !== PRESENTATION_NODES.EXOTICS && 
            n.presentationNodeHash !== 3306548141
        );

        if (exoticsNode) {
            return [exoticsNode, ...otherNodes];
        }
        
        return otherNodes;
    }, [rootNode]);

    // Initialize Tier 1
    useEffect(() => {
        const selectedTopHashIsValid = topLevelNodes.some(
            (node: any) => node.presentationNodeHash === selectedTopHash
        );

        if (topLevelNodes.length > 0 && !selectedTopHashIsValid) {
            setSelectedTopHash(topLevelNodes[0].presentationNodeHash);
            setSelectedTier2Hash(null);
            setSelectedTier3Hash(null);
        }
    }, [topLevelNodes, selectedTopHash]);

    const handleTopLevelSelect = (hash: number) => {
        if (hash === selectedTopHash) return;

        setSelectedTopHash(hash);
        setSelectedTier2Hash(null);
        setSelectedTier3Hash(null);
    };

    const handleTier2Select = (hash: number) => {
        if (hash === selectedTier2Hash) return;

        setSelectedTier2Hash(hash);
        setSelectedTier3Hash(null);
    };

    return (
        <div className="flex flex-col h-[85vh] gap-4">
            {/* Header Controls */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                {/* Tier 1: Top Bar */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    {topLevelNodes.map((node: any) => (
                        <TopLevelTab 
                            key={node.presentationNodeHash}
                            hash={node.presentationNodeHash}
                            isSelected={selectedTopHash === node.presentationNodeHash}
                            onClick={() => handleTopLevelSelect(node.presentationNodeHash)}
                        />
                    ))}
                </div>

                {/* Not Collected Switch */}
                <button 
                    onClick={handleToggleShowAll}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 transition-all border whitespace-nowrap ml-4",
                        !showAll 
                            ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold hover:cursor-pointer" 
                            : " border-white/10 text-slate-400 hover:border-white/70 hover:text-white hover:cursor-pointer"
                    )}
                >
                    {showAll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span className="uppercase tracking-wider font-bold text-sm">{showAll ? 'All Items' : 'Missing Only'}</span>
                </button>
            </div>

            {/* Content Area (Sidebar + Main) */}
            <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
                
                {/* Left Column: Tier 2 Selector + Tier 3 Sidebar */}
                <div className="w-64 shrink-0 flex flex-col gap-4 border-r border-white/5 pr-4">
                    {/* Tier 2: Horizontal Buttons */}
                    {selectedTopHash && (
                        <Tier2Selector 
                            parentHash={selectedTopHash} 
                            selectedHash={selectedTier2Hash} 
                            onSelect={handleTier2Select}
                        />
                    )}

                    {/* Tier 3: Sidebar */}
                    {selectedTier2Hash && (
                         <Tier3Sidebar 
                            parentHash={selectedTier2Hash}
                            selectedHash={selectedTier3Hash}
                            onSelect={setSelectedTier3Hash}
                        />
                    )}
                </div>

                {/* Main Content (Tier 4 Groups / Items) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                    {selectedTier3Hash ? (
                        <MainContentArea 
                            hash={selectedTier3Hash} 
                            showAll={showAll}
                        />
                    ) : selectedTier2Hash ? (
                        // Fallback: If Tier 2 is selected but no Tier 3 selected (or Tier 2 is leaf)
                         <MainContentArea 
                            hash={selectedTier2Hash} 
                            showAll={showAll}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 opacity-50">
                             <Search className="w-12 h-12 opacity-20" />
                             <p>Select a category.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Components ---

function TopLevelTab({ hash, isSelected, onClick }: { hash: number, isSelected: boolean, onClick: () => void }) {
    const { node } = usePresentationNode(hash);
    if (!node) return <div className="w-24 h-10 bg-white/5 animate-pulse rounded-none" />;

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 transition-all border whitespace-nowrap",
                isSelected 
                    ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold" 
                    : "border-white/10 text-slate-400 hover:border-white/70 hover:text-white cursor-pointer"
            )}
        >
             {node.displayProperties?.hasIcon && (
                <Image 
                    src={getBungieImage(node.displayProperties.icon)} 
                    width={20}
                    height={20}
                    className={cn("object-contain", !isSelected && "opacity-50 grayscale")} 
                    alt=""
                />
            )}
            <span className="uppercase tracking-wider font-bold text-sm">{node.displayProperties?.name}</span>
        </button>
    );
}

function Tier2Selector({ parentHash, selectedHash, onSelect }: { parentHash: number, selectedHash: number | null, onSelect: (h: number) => void }) {
    const { node } = usePresentationNode(parentHash);

    // Filter out "Featured" category (hash often varies, but name is consistent)
    // Or specifically for Exotics (parentHash === 1068557105), filter child named "Featured"
    const children = useMemo(() => {
        if (!node?.children?.presentationNodes) return [];
        
        if (parentHash === PRESENTATION_NODES.EXOTICS) {
            return node.children.presentationNodes.filter((n: any) => n.displayProperties?.name !== "Featured");
        }
        
        return node.children.presentationNodes;
    }, [node, parentHash]);

    const selectedHashIsValid = children.some(
        (child: any) => child.presentationNodeHash === selectedHash
    );

    useEffect(() => {
        if (children.length > 0 && !selectedHashIsValid) {
            onSelect(children[0].presentationNodeHash);
        }
    }, [children, selectedHashIsValid, onSelect]);

    if (!node) return <div className="h-12 bg-white/5 animate-pulse" />;

    if (children.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {children.map((child: any) => (
                <Tier2Button 
                    key={child.presentationNodeHash}
                    hash={child.presentationNodeHash}
                    isSelected={selectedHash === child.presentationNodeHash}
                    onClick={() => onSelect(child.presentationNodeHash)}
                />
            ))}
        </div>
    );
}

function Tier2Button({ hash, isSelected, onClick }: { hash: number, isSelected: boolean, onClick: () => void }) {
    const { node } = usePresentationNode(hash);
    if (!node) return null;

    return (
        <div className="relative group flex-1 min-w-[40px]">
            <button
                onClick={onClick}
                className={cn(
                    "w-full h-10 flex items-center justify-center transition-all border shrink-0",
                    isSelected 
                        ? "bg-destiny-gold text-slate-900 border-destiny-gold" 
                        : " border-white/10 text-slate-400 hover:border-white/70 hover:text-white hover:cursor-pointer"
                )}
            >
                    {node.displayProperties?.hasIcon ? (
                    <Image 
                        src={getBungieImage(node.displayProperties.icon)} 
                        width={24}
                        height={24}
                        className={cn("object-contain", !isSelected && "opacity-70 grayscale")} 
                        alt={node.displayProperties.name}
                    />
                ) : (
                    <span className="text-xs font-bold">{node.displayProperties?.name?.substring(0, 2)}</span>
                )}
            </button>

        </div>
    );
}

function Tier3Sidebar({ parentHash, selectedHash, onSelect }: { parentHash: number, selectedHash: number | null, onSelect: (h: number) => void }) {
    const { node } = usePresentationNode(parentHash);
    
    const children = useMemo(() => {
        if (!node?.children?.presentationNodes) return [];
        // Filter out "Featured" or "Featured Gear"
        return node.children.presentationNodes.filter((n: any) => 
            n.displayProperties?.name !== "Featured" && 
            n.displayProperties?.name !== "Featured Gear"
        );
    }, [node]);

    const selectedHashIsValid = children.some(
        (child: any) => child.presentationNodeHash === selectedHash
    );

    useEffect(() => {
        if (children.length > 0 && !selectedHashIsValid) {
             onSelect(children[0].presentationNodeHash);
        }
    }, [children, selectedHashIsValid, onSelect]);

    if (!node) return <div className="w-64 h-full bg-white/5 animate-pulse" />;

    // If no children, maybe we shouldn't show sidebar? Or show "No Categories"
    if (children.length === 0) {
         return <div className="w-64 shrink-0 border-r border-white/5 flex items-center justify-center text-slate-500 text-sm italic">No Sub-categories</div>;
    }

    return (
        <div className="flex flex-col gap-1 shrink-0 overflow-y-auto custom-scrollbar flex-1 min-h-0 pb-4">
            {children.map((child: any) => (
                <Tier3Button
                    key={child.presentationNodeHash}
                    hash={child.presentationNodeHash}
                    isSelected={selectedHash === child.presentationNodeHash}
                    onClick={() => onSelect(child.presentationNodeHash)}
                />
            ))}
        </div>
    );
}

function Tier3Button({ hash, isSelected, onClick }: { hash: number, isSelected: boolean, onClick: () => void }) {
    const { node } = usePresentationNode(hash);
    if (!node) return <div className="h-8 bg-white/5 animate-pulse rounded-sm my-1" />;

    return (
        <button
            onClick={onClick}
            className={cn(
                "text-left px-3 py-2.5 transition-all text-sm font-medium flex items-center justify-between group w-full border border-transparent",
                isSelected 
                    ? "bg-linear-to-r from-destiny-gold/10 to-transparent text-white border-l-destiny-gold border-l-2 border-y-transparent border-r-transparent" 
                    : "text-slate-400 hover:bg-linear-to-r from-white/5 to-transparent hover:text-white hover:cursor-pointer hover:border-l-white/70 border-l-2"
            )}
        >
            <div className="flex items-center gap-3 truncate">
                {node.displayProperties?.hasIcon && (
                    <Image 
                        src={getBungieImage(node.displayProperties.icon)} 
                        width={16}
                        height={16}
                        className="object-contain opacity-80" 
                        alt="" 
                    />
                )}
                <span className="truncate">{node.displayProperties?.name}</span>
            </div>
            <ChevronRight className={cn("w-3 h-3 transition-transform opacity-0 group-hover:opacity-50", isSelected && "opacity-100 text-destiny-gold")} />
        </button>
    );
}

function MainContentArea({ hash, showAll }: { hash: number, showAll: boolean }) {
    const { node, isLoading } = usePresentationNode(hash);
    const { profile } = useDestinyProfileContext();
    const {
        table: collectibleTable,
        isLoading: collectibleTableLoading,
    } = useManifestTable<any>("DestinyCollectibleDefinition");
    const {
        table: itemTable,
        isLoading: itemTableLoading,
    } = useManifestTable<any>("DestinyInventoryItemDefinition", { view: "card" });

    const directItems = useMemo(
        () => buildCollectionTileModels(
            node?.children?.collectibles ?? [],
            collectibleTable,
            itemTable,
            profile,
            showAll
        ),
        [node, collectibleTable, itemTable, profile, showAll]
    );

    const isContentLoading = isLoading || collectibleTableLoading || itemTableLoading;

    if (isContentLoading) return <div className="p-8 text-slate-500">Loading content...</div>;
    if (!node) return null;

    // Check if node has Presentation Nodes (Tier 4 Groups)
    const hasGroups = node.children?.presentationNodes?.length > 0;
    const hasItems = node.children?.collectibles?.length > 0;

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
             {/* Header for Current Selection */}
             <div className="sticky top-0 z-10 py-2 border-b border-white/10 mb-4">
                <h2 className="text-xl font-light text-white">{node.displayProperties?.name}</h2>
                {node.displayProperties?.description && (
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">{node.displayProperties.description}</p>
                )}
             </div>

            {/* Case 1: Tier 4 Groups */}
            {hasGroups && node.children.presentationNodes.map((child: any) => (
                <CollectionGroup 
                    key={child.presentationNodeHash} 
                    hash={child.presentationNodeHash} 
                    profile={profile}
                    showAll={showAll}
                    collectibleTable={collectibleTable}
                    itemTable={itemTable}
                />
            ))}

            {/* Case 2: Direct Items (Leaf Node) */}
            {hasItems && directItems.length > 0 && (
                <CollectionTileGrid
                    items={directItems}
                    height="calc(85vh - 220px)"
                />
            )}
            
            {(!hasGroups && !hasItems) || (hasItems && directItems.length === 0) ? (
                 <div className="text-slate-500 italic p-4">No items found.</div>
            ) : null}
        </div>
    );
}

function CollectionGroup({
    hash,
    profile,
    showAll,
    collectibleTable,
    itemTable,
}: {
    hash: number;
    profile: any;
    showAll: boolean;
    collectibleTable: Record<string, any> | undefined;
    itemTable: Record<string, any> | undefined;
}) {
    const { node } = usePresentationNode(hash);
    const items = useMemo(
        () => buildCollectionTileModels(
            node?.children?.collectibles ?? [],
            collectibleTable,
            itemTable,
            profile,
            showAll
        ),
        [node, collectibleTable, itemTable, profile, showAll]
    );
    
    if (!node) return null;
    
    const collectibles = node.children?.collectibles || [];
    if (collectibles.length === 0) return null;
    if (items.length === 0) return null;

    const estimatedItemsPerRow = 8;
    const tileRowHeight = COLLECTION_TILE_SIZE_PX + 16;
    const rowCount = Math.ceil(items.length / estimatedItemsPerRow);
    const groupHeight = Math.min(460, rowCount * tileRowHeight);

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-bold text-destiny-gold uppercase tracking-wider border-b border-white/5 pb-1 flex items-center gap-2">
                {node.displayProperties?.hasIcon && (
                    <Image src={getBungieImage(node.displayProperties.icon)} width={16} height={16} alt="" className="opacity-70" />
                )}
                {node.displayProperties?.name}
            </h3>
            <CollectionTileGrid items={items} height={groupHeight} addBottomPadding={false} />
        </div>
    );
}

function CollectionTileGrid({
    items,
    height,
    addBottomPadding = true,
}: {
    items: CollectionTileModel[];
    height: number | string;
    addBottomPadding?: boolean;
}) {
    const components: GridComponents<CollectionTileModel> = useMemo(() => {
        const List = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
            <div
                ref={ref}
                {...props}
                style={{
                    ...props.style,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                }}
            />
        ));
        List.displayName = 'CollectionGridList';

        const Item = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
            <div
                ref={ref}
                {...props}
                style={{
                    ...props.style,
                    width: COLLECTION_TILE_SIZE_PX,
                    height: COLLECTION_TILE_SIZE_PX + 8,
                }}
            />
        ));
        Item.displayName = 'CollectionGridItem';

        return { List, Item };
    }, []);

    if (items.length === 0) {
        return <div className="text-slate-500 italic p-4">No items found.</div>;
    }

    return (
        <VirtuosoGrid
            style={{ height }}
            data={items}
            overscan={240}
            components={components}
            itemContent={(index, item) => (
                <InteractiveCollectionTile
                    item={item}
                    fetchPriority={index < 18 ? "auto" : "low"}
                />
            )}
            className={cn("custom-scrollbar", addBottomPadding && "pb-20")}
        />
    );
}

function InteractiveCollectionTile({
    item,
    fetchPriority,
}: {
    item: CollectionTileModel;
    fetchPriority: "auto" | "low";
}) {
    const [tooltipPosition, setTooltipPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);

    const updateTooltipPosition = (event: React.MouseEvent) => {
        if (!contextMenuPosition) {
            setTooltipPosition({ x: event.clientX, y: event.clientY });
        }
    };

    const handleMouseLeave = () => {
        setTooltipPosition(null);
    };

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        setTooltipPosition(null);
        setContextMenuPosition({ x: event.clientX, y: event.clientY });
    };

    return (
        <div
            className="cursor-pointer"
            onMouseEnter={updateTooltipPosition}
            onMouseMove={updateTooltipPosition}
            onMouseLeave={handleMouseLeave}
            onContextMenu={handleContextMenu}
        >
            <ItemTile
                item={item}
                sizePx={COLLECTION_TILE_SIZE_PX}
                className="w-20"
                fetchPriority={fetchPriority}
                title=""
            >
                {!item.isAcquired && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Lock className="w-4 h-4 text-white/50 drop-shadow-md" />
                    </div>
                )}
            </ItemTile>

            {(tooltipPosition || contextMenuPosition) && (
                <DestinyItemCard
                    itemHash={item.itemHash}
                    definition={item.definition}
                    definitionIsPartial
                    deferDetails
                    renderTile={false}
                    forcedTooltipPosition={tooltipPosition ?? undefined}
                    forcedContextMenuPosition={contextMenuPosition ?? undefined}
                    onCloseForcedContextMenu={() => setContextMenuPosition(null)}
                    imageFetchPriority={fetchPriority}
                    size="large"
                    hideTooltipScreenshot
                />
            )}
        </div>
    );
}
