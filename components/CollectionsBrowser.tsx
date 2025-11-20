import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePresentationNode } from '@/hooks/useDefinitions';
import { FrostedCard } from './FrostedCard';
import { ChevronRight, ChevronDown, Search, Lock } from 'lucide-react';
import { getBungieImage } from '@/lib/bungie';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { cn } from '@/lib/utils';
import { DestinyItemCard } from './DestinyItemCard';
import { useCollectible } from '@/hooks/useDefinitions';

interface CollectionsBrowserProps {
    rootHash: number;
}

export function CollectionsBrowser({ rootHash }: CollectionsBrowserProps) {
    // Top Level State
    // We will always fetch the root node to display the "Top Bar" (Tabs)
    const { node: rootNode, isLoading: isRootLoading } = usePresentationNode(rootHash);

    // selectedTopHash is the hash of the currently selected "Tab" (e.g. Weapons, Armor)
    const [selectedTopHash, setSelectedTopHash] = useState<number | null>(null);
    
    // Initialize selectedTopHash with the first child when root loads
    useEffect(() => {
        if (rootNode && rootNode.children?.presentationNodes?.length > 0 && !selectedTopHash) {
            setSelectedTopHash(rootNode.children.presentationNodes[0].presentationNodeHash);
        }
    }, [rootNode, selectedTopHash]);

    if (isRootLoading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse">Loading Collections...</div>;
    }

    if (!rootNode) {
        return <div className="p-12 text-center text-red-400">Failed to load collection data.</div>;
    }

    const topLevelNodes = rootNode.children?.presentationNodes || [];

    return (
        <div className="flex flex-col h-[80vh] gap-6">
            {/* Top Navigation Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5 custom-scrollbar">
                {topLevelNodes.map((node: any) => (
                    <TopLevelTab 
                        key={node.presentationNodeHash}
                        hash={node.presentationNodeHash}
                        isSelected={selectedTopHash === node.presentationNodeHash}
                        onClick={() => setSelectedTopHash(node.presentationNodeHash)}
                    />
                ))}
            </div>

            {/* Content Area (Sidebar + Main) */}
            {selectedTopHash ? (
                <CategoryBrowser key={selectedTopHash} rootHash={selectedTopHash} />
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    Select a category above.
                </div>
            )}
        </div>
    );
}

function TopLevelTab({ hash, isSelected, onClick }: { hash: number, isSelected: boolean, onClick: () => void }) {
    const { node } = usePresentationNode(hash);
    if (!node) return <div className="w-24 h-10 bg-white/5 animate-pulse rounded-none" />;

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-sm transition-all border whitespace-nowrap",
                isSelected 
                    ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold" 
                    : "bg-gray-800/40 border-white/10 text-slate-400 hover:bg-gray-700/50 hover:text-white"
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

// This component manages the Sidebar Tree and Main Content for a selected Top Category
function CategoryBrowser({ rootHash }: { rootHash: number }) {
    // selectedLeafHash is the Node whose items are displayed in the Main Area
    const [selectedLeafHash, setSelectedLeafHash] = useState<number | null>(null);
    
    const { node: rootNode, isLoading } = usePresentationNode(rootHash);
    const { profile } = useDestinyProfile();

    if (isLoading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse">Loading...</div>;
    }

    if (!rootNode) {
        return <div className="p-12 text-center text-red-400">Failed to load category.</div>;
    }

    const sidebarNodes = rootNode.children?.presentationNodes || [];

    return (
        <div className="flex flex-1 gap-6 min-h-0">
            {/* Left Sidebar - Tree View */}
            <div className="w-64 flex flex-col gap-2 shrink-0 overflow-y-auto border-r border-white/5 pr-4 custom-scrollbar pb-4">
                {sidebarNodes.map((child: any) => (
                    <RecursiveSidebarNode
                        key={child.presentationNodeHash}
                        hash={child.presentationNodeHash}
                        depth={0}
                        selectedHash={selectedLeafHash}
                        onSelect={setSelectedLeafHash}
                    />
                ))}
                 {sidebarNodes.length === 0 && (
                    <div className="text-slate-500 text-sm italic p-2">No sub-categories.</div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 p-2 custom-scrollbar pb-20">
                {selectedLeafHash ? (
                    <MainContentArea 
                        hash={selectedLeafHash} 
                        profile={profile} 
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                         <Search className="w-12 h-12 opacity-20" />
                         <p>Select a category from the sidebar.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function RecursiveSidebarNode({ 
    hash, 
    depth, 
    selectedHash, 
    onSelect 
}: { 
    hash: number, 
    depth: number, 
    selectedHash: number | null, 
    onSelect: (h: number) => void 
}) {
    const { node } = usePresentationNode(hash);
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand if selectedHash is a descendant? 
    // For simplicity, we won't traverse to find if descendant, but we could if needed.
    
    if (!node) return <div className="h-8 animate-pulse bg-white/5 rounded-sm my-1" />;

    const hasChildren = node.children?.presentationNodes?.length > 0;
    const hasItems = node.children?.collectibles?.length > 0;

    const handleClick = () => {
        if (hasChildren) {
            setIsExpanded(!isExpanded);
        }
        // If it has items, we can select it
        // Or if it's purely a container, we might just expand it.
        // User might want to see items of a container if it has mixed content (rare).
        // Let's say: If it has items, selecting it shows items.
        // If it ONLY has children, expanding is the primary action.
        
        if (hasItems || !hasChildren) {
             onSelect(hash);
        } else {
             // If it's a folder, just toggle expand (already done above)
             // But maybe we want to select it to show "Select a subcategory"?
             // Let's mostly rely on leaf selection for now.
        }
    };

    const isSelected = selectedHash === hash;

    return (
        <div className="flex flex-col">
            <button
                onClick={handleClick}
                className={cn(
                    "text-left px-3 py-2 rounded-sm transition-all text-sm font-medium flex items-center justify-between group w-full",
                    isSelected 
                        ? "bg-destiny-gold text-slate-900 shadow-sm" 
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    // Indentation via padding-left
                )}
                style={{ paddingLeft: `${(depth * 12) + 12}px` }}
            >
                <div className="flex items-center gap-2 truncate">
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
                {hasChildren && (
                    <ChevronDown className={cn(
                        "w-3 h-3 transition-transform opacity-50",
                        isExpanded ? "rotate-180" : "-rotate-90"
                    )} />
                )}
            </button>
            
            {isExpanded && hasChildren && (
                <div className="flex flex-col mt-1 gap-1 border-l border-white/5 ml-4">
                    {node.children.presentationNodes.map((child: any) => (
                        <RecursiveSidebarNode
                            key={child.presentationNodeHash}
                            hash={child.presentationNodeHash}
                            depth={0} // We reset depth visually because we used margin/border above, or we can increment.
                            // Let's stick to simple indentation without margin nesting for cleaner look, OR use margin nesting.
                            // The visual border-l indicates depth well. We can keep depth=0 for padding if we use margin.
                            selectedHash={selectedHash}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function MainContentArea({ hash, profile }: { hash: number, profile: any }) {
    const { node, isLoading } = usePresentationNode(hash);

    if (isLoading) return <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2"><div className="aspect-square bg-white/5 animate-pulse" /></div>;
    if (!node) return null;

    const collectibles = node.children?.collectibles || [];
    
    if (collectibles.length > 0) {
        return (
            <div>
                <div className="mb-4 sticky top-0 backdrop-blur z-10 py-2 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{collectibles.length} Items</span>
                </div>
                
                {/* Extremely compact grid: minmax(2.5rem) is 40px */}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
                    {collectibles.map((child: any) => (
                        <CollectionItem 
                            key={child.collectibleHash} 
                            hash={child.collectibleHash} 
                            profile={profile}
                        />
                    ))}
                </div>
            </div>
        );
    }
    
    return <div className="text-slate-500 text-center mt-10">No items in this category.</div>;
}

function CollectionItem({ hash, profile }: { hash: number, profile: any }) {
    const { collectible, isLoading } = useCollectible(hash);

    if (isLoading) return <div className="aspect-square bg-white/5 animate-pulse rounded-none" />;
    if (!collectible) return null;

    // Check state in Profile Collectibles (Component 800)
    let state = profile?.profileCollectibles?.data?.collectibles?.[hash]?.state;
    
    // If not found in profile, check Character Collectibles (Component 800 is usually profile-wide, but check characters just in case for some items)
    // Actually, component 800 is profileCollectibles. 
    // Character-specific collectibles are in component 200? No, 800 is generally sufficient for Collections.
    // However, exotic armor might be weird if it relies on Entitlements or character-specific unlocks?
    // Actually, the issue with Exotic Armor not tracking is usually because some collectibles are character-scoped.
    // Let's check characterCollectibles (from profile.characterCollectibles.data[charId].collectibles)
    
    if (state === undefined && profile?.characterCollectibles?.data) {
         const charIds = Object.keys(profile.characterCollectibles.data);
         for (const charId of charIds) {
             const charState = profile.characterCollectibles.data[charId]?.collectibles?.[hash]?.state;
             if (charState !== undefined) {
                 // Use the "best" state (e.g., if acquired on one char, it's acquired)
                 // State is a bitmask. 1 = NotAcquired.
                 // We want the one where (state & 1) === 0
                 if ((charState & 1) === 0) {
                     state = charState;
                     break;
                 }
                 // Otherwise just take the first valid one found
                 if (state === undefined) state = charState;
             }
         }
    }

    // Default to NotAcquired (1) if absolutely not found
    const finalState = state ?? 1;
    const isAcquired = (finalState & 1) === 0;
    const isVisible = (finalState & 4) === 0;

    if (!isVisible) return null;

    return (
        <div className={cn("relative group w-full aspect-square", !isAcquired && "opacity-60 grayscale")}>
            <DestinyItemCard 
                itemHash={collectible.itemHash} 
                hidePower 
                hideBorder={!isAcquired}
                className="rounded-none w-full h-full"
                minimal 
            />
            {!isAcquired && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Lock className="w-3 h-3 text-white/50 drop-shadow-lg" />
                </div>
            )}
        </div>
    );
}
