import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { usePresentationNode } from '@/hooks/useDefinitions';
import { ChevronRight, Search, Lock, Eye, EyeOff } from 'lucide-react';
import { getBungieImage } from '@/lib/bungie';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { cn } from '@/lib/utils';
import { DestinyItemCard } from './DestinyItemCard';
import { useCollectible } from '@/hooks/useDefinitions';
import { PRESENTATION_NODES } from "@/lib/destinyUtils";

interface CollectionsBrowserProps {
    rootHash: number;
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
        if (topLevelNodes.length > 0 && !selectedTopHash) {
            setSelectedTopHash(topLevelNodes[0].presentationNodeHash);
        }
    }, [topLevelNodes, selectedTopHash]);

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
                            onClick={() => setSelectedTopHash(node.presentationNodeHash)}
                        />
                    ))}
                </div>

                {/* Not Collected Switch */}
                <button 
                    onClick={handleToggleShowAll}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-sm transition-all border whitespace-nowrap ml-4",
                        !showAll 
                            ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold" 
                            : "bg-gray-800/40 border-white/10 text-slate-400 hover:bg-gray-700/50 hover:text-white"
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
                            onSelect={setSelectedTier2Hash}
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

function Tier2Selector({ parentHash, selectedHash, onSelect }: { parentHash: number, selectedHash: number | null, onSelect: (h: number) => void }) {
    const { node } = usePresentationNode(parentHash);
    
    // Auto-select first child if none selected? 
    // User didn't explicitly ask for auto-select, but it's good UX for "Tabs".
    // However, "Horizontal Buttons" implies choice.
    useEffect(() => {
        if (node?.children?.presentationNodes?.length > 0 && !selectedHash) {
            onSelect(node.children.presentationNodes[0].presentationNodeHash);
        }
    }, [node, selectedHash, onSelect]);

    if (!node) return <div className="h-12 bg-white/5 animate-pulse" />;

    // Filter out "Featured" category (hash often varies, but name is consistent)
    // Or specifically for Exotics (parentHash === 1068557105), filter child named "Featured"
    const children = useMemo(() => {
        if (!node.children?.presentationNodes) return [];
        
        if (parentHash === PRESENTATION_NODES.EXOTICS) {
            return node.children.presentationNodes.filter((n: any) => n.displayProperties?.name !== "Featured");
        }
        
        return node.children.presentationNodes;
    }, [node, parentHash]);

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
                    "w-full h-10 flex items-center justify-center rounded-sm transition-all border shrink-0",
                    isSelected 
                        ? "bg-destiny-gold text-slate-900 border-destiny-gold" 
                        : "bg-gray-800/40 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
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

    // Auto-select first child
    useEffect(() => {
        if (children.length > 0 && !selectedHash) {
             onSelect(children[0].presentationNodeHash);
        }
    }, [children, selectedHash, onSelect]);

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
                "text-left px-3 py-2.5 rounded-sm transition-all text-sm font-medium flex items-center justify-between group w-full border border-transparent",
                isSelected 
                    ? "bg-white/10 text-white border-l-destiny-gold border-l-2 border-y-transparent border-r-transparent" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
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
    const { profile } = useDestinyProfile();

    if (isLoading) return <div className="p-8 text-slate-500">Loading content...</div>;
    if (!node) return null;

    // Check if node has Presentation Nodes (Tier 4 Groups)
    const hasGroups = node.children?.presentationNodes?.length > 0;
    const hasItems = node.children?.collectibles?.length > 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                />
            ))}

            {/* Case 2: Direct Items (Leaf Node) */}
            {hasItems && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
                     {node.children.collectibles.map((child: any) => (
                        <CollectionItem 
                            key={child.collectibleHash} 
                            hash={child.collectibleHash} 
                            profile={profile}
                            showAll={showAll}
                        />
                    ))}
                </div>
            )}
            
            {!hasGroups && !hasItems && (
                 <div className="text-slate-500 italic p-4">No items found.</div>
            )}
        </div>
    );
}

function CollectionGroup({ hash, profile, showAll }: { hash: number, profile: any, showAll: boolean }) {
    const { node } = usePresentationNode(hash);
    
    if (!node) return null;
    
    const collectibles = node.children?.collectibles || [];
    if (collectibles.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-destiny-gold uppercase tracking-wider border-b border-white/5 pb-1 flex items-center gap-2">
                {node.displayProperties?.hasIcon && (
                    <Image src={getBungieImage(node.displayProperties.icon)} width={16} height={16} alt="" className="opacity-70" />
                )}
                {node.displayProperties?.name}
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
                {collectibles.map((child: any) => (
                    <CollectionItem 
                        key={child.collectibleHash} 
                        hash={child.collectibleHash} 
                        profile={profile}
                        showAll={showAll}
                    />
                ))}
            </div>
        </div>
    );
}

function CollectionItem({ hash, profile, showAll }: { hash: number, profile: any, showAll: boolean }) {
    const { collectible, isLoading } = useCollectible(hash);

    if (isLoading) return <div className="aspect-square bg-white/5 animate-pulse rounded-none" />;
    if (!collectible) return null;

    // --- State Check Logic ---
    let state = profile?.profileCollectibles?.data?.collectibles?.[hash]?.state;
    
    if (state === undefined && profile?.characterCollectibles?.data) {
         const charIds = Object.keys(profile.characterCollectibles.data);
         for (const charId of charIds) {
             const charState = profile.characterCollectibles.data[charId]?.collectibles?.[hash]?.state;
             if (charState !== undefined) {
                 if ((charState & 1) === 0) {
                     state = charState;
                     break;
                 }
                 if (state === undefined) state = charState;
             }
         }
    }

    const finalState = state ?? 1;
    const isAcquired = (finalState & 1) === 0;
    const isVisible = (finalState & 4) === 0; // Invisible flag

    // Filter logic
    if (!isVisible) return null;
    if (!showAll && isAcquired) return null;

    return (
        <div className={cn("relative group w-full aspect-square transition-opacity", !isAcquired && "opacity-40 grayscale hover:opacity-100")}>
            <DestinyItemCard 
                itemHash={collectible.itemHash} 
                hidePower 
                hideBorder={!isAcquired}
                className="rounded-none w-full h-full"
                minimal 
            />
            {!isAcquired && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Lock className="w-4 h-4 text-white/50 drop-shadow-md" />
                </div>
            )}
        </div>
    );
}
