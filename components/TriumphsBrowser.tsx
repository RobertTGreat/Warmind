'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { usePresentationNode, useRecord } from '@/hooks/useDefinitions';
import { ChevronRight, ArrowLeft, CheckCircle2, Trophy, Search, X, AlertTriangle, Settings2, Eye, EyeOff, Layers } from 'lucide-react';
import { getBungieImage, bungieApi, endpoints } from '@/lib/bungie';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { ScrollingText } from '@/components/ScrollingText';
import { PretextLineClamp } from '@/components/PretextLineClamp';
import { useSettingsStore } from '@/store/settingsStore';

interface TriumphsBrowserProps {
    rootHash: number;
    mode?: 'triumphs' | 'seals';
}

type NodeProgress = {
    current: number;
    total: number;
    percent: number;
};

type SealSortOption = 'name_asc' | 'name_desc' | 'completion_asc' | 'completion_desc';
type SealCompletionFilter = 'all' | 'completed' | 'incomplete';

type RecordVisibilityOptions = {
    showCompleted: boolean;
    hideInvisible: boolean;
    hideUnobtainable: boolean;
};

const LEGACY_TITLES_NODE_HASH = 1881970629;

export function TriumphsBrowser({ rootHash, mode = 'triumphs' }: TriumphsBrowserProps) {
    const [history, setHistory] = useState<number[]>([]);
    const [currentHash, setCurrentHash] = useState<number | undefined>(rootHash);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const isSealsMode = mode === 'seals';

    const [sealSortOption, setSealSortOption] = useState<SealSortOption>('name_asc');
    const [sealCompletionFilter, setSealCompletionFilter] = useState<SealCompletionFilter>('all');
    const hideCompletedTriumphs = useSettingsStore((state) => state.hideCompletedTriumphs);
    const setHideCompletedTriumphs = useSettingsStore((state) => state.setHideCompletedTriumphs);
    const hideInvisibleTriumphs = useSettingsStore((state) => state.hideInvisibleTriumphs);
    const hideUnobtainableTriumphs = useSettingsStore((state) => state.hideUnobtainableTriumphs);
    const groupTitles = useSettingsStore((state) => state.groupTitles);
    const setGroupTitles = useSettingsStore((state) => state.setGroupTitles);

    const { node, isLoading, isError } = usePresentationNode(currentHash);
    const { node: legacyTitlesNode } = usePresentationNode(isSealsMode ? LEGACY_TITLES_NODE_HASH : undefined);
    const { profile } = useDestinyProfileContext();
    const recordVisibilityOptions: RecordVisibilityOptions = {
        showCompleted: !hideCompletedTriumphs,
        hideInvisible: hideInvisibleTriumphs,
        hideUnobtainable: hideUnobtainableTriumphs,
    };

    // Reset when rootHash changes (e.g. switching tabs)
    useEffect(() => {
        if (rootHash) {
            setCurrentHash(rootHash);
            setHistory([]);
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [rootHash]);

    const handleNodeClick = (hash: number) => {
        if (currentHash) {
            setHistory(prev => [...prev, currentHash]);
        }
        setCurrentHash(hash);
    };

    const handleBack = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setHistory(prevHistory => prevHistory.slice(0, -1));
        setCurrentHash(prev);
    };

    const handleBreadcrumbClick = (index: number) => {
        if (index === -1) {
             // Root
             // If we are already at root (history empty), do nothing
             if (history.length === 0) return;
             // Reset to root
             setHistory([]);
             setCurrentHash(rootHash);
             return;
        }
        
        // If clicking current (last item), do nothing
        if (index === history.length) return;

        const targetHash = history[index];
        const newHistory = history.slice(0, index);
        setHistory(newHistory);
        setCurrentHash(targetHash);
    };

    const performSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            // Search for Records
            const res = await bungieApi.get(endpoints.searchDestinyEntities('DestinyRecordDefinition', searchQuery));
            // Handle potential response variations
            const results = res.data.Response.results?.results || res.data.Response.results || [];
            setSearchResults(results);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
    };

    if (!rootHash && !searchQuery) {
        return (
             <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-destiny-gold border-t-transparent rounded-full animate-spin" />
                <p>Initializing Triumphs...</p>
            </div>
        );
    }

    if (isLoading && !node && !searchQuery) {
        return (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-destiny-gold border-t-transparent rounded-full animate-spin" />
                <p>Loading Triumphs...</p>
            </div>
        );
    }

    if (isError || (!node && !searchQuery)) {
        // If we are searching, don't show node error
        if (searchQuery) return null;

        console.error("Triumphs Load Error:", isError);
        return (
            <div className="p-12 text-center text-red-400 flex flex-col items-center gap-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <div>
                    <h3 className="text-lg font-bold">Failed to load triumph data</h3>
                    <p className="text-sm opacity-80 mt-1">
                        {(isError as any)?.message || "Unknown error occurred"}
                    </p>
                    <p className="text-xs opacity-60 mt-4 font-mono">
                        Node Hash: {currentHash}
                    </p>
                </div>
            </div>
        );
    }

    const baseChildNodes = node?.children?.presentationNodes || [];
    const childNodes = (() => {
        if (!isSealsMode || currentHash !== rootHash) {
            return baseChildNodes;
        }

        const childNodeByHash = new Map<number, any>();

        for (const childNode of baseChildNodes) {
            childNodeByHash.set(Number(childNode.presentationNodeHash), childNode);
        }

        for (const childNode of legacyTitlesNode?.children?.presentationNodes ?? []) {
            childNodeByHash.set(Number(childNode.presentationNodeHash), {
                ...childNode,
                isLegacyTitleNode: true,
            });
        }

        return Array.from(childNodeByHash.values());
    })();
    const childRecords = node?.children?.records || [];
    const itemLabel = isSealsMode ? 'Seals' : 'Triumphs';
    const isSealDetail = isSealsMode && history.length > 0 && childRecords.length > 0;
    const shouldShowNodeHeader = !(isSealsMode && history.length === 0);
    const isMissingTitlesOnly = sealCompletionFilter === 'incomplete';

    return (
        <div className={cn("relative space-y-6", isSealsMode && !isSealDetail && "pb-24")}>
            {/* Header & Search */}
            {!isSealDetail && (
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
               <div className="flex-1 w-full">
                   <form onSubmit={performSearch} className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                       <input
                           type="text"
                           placeholder={isSealsMode ? "Search seals..." : "Search triumphs..."}
                           className="w-full border border-white/10 py-2 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-destiny-gold transition-colors rounded-none"
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                       />
                       {searchQuery && (
                           <button
                               type="button"
                               onClick={clearSearch}
                               className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                           >
                               <X className="w-4 h-4" />
                           </button>
                       )}
                   </form>
               </div>
               
               {isSealsMode ? (
                   <SealSortMenu
                       sortOption={sealSortOption}
                       completionFilter={sealCompletionFilter}
                       onSortChange={setSealSortOption}
                       onCompletionFilterChange={setSealCompletionFilter}
                   />
               ) : (
                   <button
                       onClick={() => setHideCompletedTriumphs(!hideCompletedTriumphs)}
                       className={cn(
                           "flex items-center gap-2 px-4 py-2 border transition-all rounded-none min-w-[160px] justify-center",
                           !hideCompletedTriumphs ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold" : "bg-black/20 border-white/10 text-slate-500 hover:text-slate-300"
                       )}
                   >
                       <div className={cn("w-2 h-2 rounded-full", !hideCompletedTriumphs ? "bg-destiny-gold" : "bg-slate-600")} />
                       <span className="text-sm font-bold uppercase tracking-wider hover:cursor-pointer">
                           {!hideCompletedTriumphs ? `All ${itemLabel}` : "Incomplete Only"}
                       </span>
                   </button>
               )}
            </div>
            )}

            {/* Search Results Mode */}
            {searchQuery ? (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">Search Results</h3>
                    {isSearching ? (
                        <div className="text-slate-500">Searching...</div>
                    ) : searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                             {searchResults.map((result) => (
                                <RecordItem
                                    key={result.hash}
                                    hash={result.hash}
                                    profile={profile}
                                    visibilityOptions={recordVisibilityOptions}
                                />
                             ))}
                        </div>
                    ) : (
                        <div className="text-slate-400">No results found.</div>
                    )}
                </div>
            ) : isSealDetail ? (
                <SealDetailView
                    hash={currentHash!}
                    node={node}
                    records={childRecords}
                    profile={profile}
                    visibilityOptions={recordVisibilityOptions}
                    onBack={handleBack}
                />
            ) : (
                <>
                    {/* Navigation Header with Breadcrumbs */}
                    <div className="flex items-center gap-4 mb-6 bg-black/20 p-4 border border-white/5">
                         <div className="flex flex-wrap items-center gap-2 text-sm">
                             <button
                                onClick={() => handleBreadcrumbClick(-1)}
                                className={cn("hover:text-destiny-gold transition-colors", history.length === 0 ? "text-destiny-gold font-bold" : "text-slate-400")}
                             >
                                 ROOT
                             </button>
                             {history.map((hash, index) => (
                                 <React.Fragment key={hash}>
                                     <ChevronRight className="w-4 h-4 text-slate-600" />
                                     <BreadcrumbItem hash={hash} onClick={() => handleBreadcrumbClick(index)} isLast={false} />
                                 </React.Fragment>
                             ))}
                             {history.length > 0 && (
                                 <>
                                     <ChevronRight className="w-4 h-4 text-slate-600" />
                                     <div className="text-destiny-gold font-bold max-w-[200px] overflow-hidden">
                                        <ScrollingText>{node?.displayProperties?.name}</ScrollingText>
                                     </div>
                                 </>
                             )}
                         </div>
                    </div>

                    {shouldShowNodeHeader && (
                        <div className="flex items-start gap-6 mb-8">
                            {node?.displayProperties?.hasIcon && (
                                 <Image
                                    src={getBungieImage(node.displayProperties.icon)}
                                    width={64}
                                    height={64}
                                    className="object-contain"
                                    alt=""
                                />
                            )}
                            <div>
                                <h2 className="text-3xl font-bold text-white">
                                    {node?.displayProperties?.name}
                                </h2>
                                {node?.displayProperties?.description && (
                                    <p className="text-slate-400 mt-1">{node.displayProperties.description}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sub-Categories */}
                    {childNodes.length > 0 && (
                        <div className={cn(
                            "mb-8",
                            isSealsMode
                                ? ""
                                : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                        )}>
                            {isSealsMode ? (
                                <SealNodeGrid
                                    nodes={childNodes}
                                    sortOption={sealSortOption}
                                    completionFilter={sealCompletionFilter}
                                    onNodeClick={handleNodeClick}
                                    profile={profile}
                                    groupTitles={groupTitles}
                                />
                            ) : (
                                childNodes.map((child: any) => (
                                    <PresentationNodeCard
                                        key={child.presentationNodeHash}
                                        hash={child.presentationNodeHash}
                                        onClick={handleNodeClick}
                                        profile={profile}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* Records */}
                    {childRecords.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                            {childRecords.map((child: any) => (
                                <RecordItem
                                    key={child.recordHash}
                                    hash={child.recordHash}
                                    profile={profile}
                                    visibilityOptions={recordVisibilityOptions}
                                />
                            ))}
                        </div>
                    )}
                    
                    {childNodes.length === 0 && childRecords.length === 0 && (
                        <div className="text-center text-slate-500 py-12">
                            No items found in this category.
                        </div>
                    )}
                </>
            )}
            {isSealsMode && !isSealDetail && (
                <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end">
                    <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2 border border-white/15 bg-[#0f151b]/75 p-2 shadow-2xl backdrop-blur-md">
                        <button
                            type="button"
                            onClick={() => setSealCompletionFilter(isMissingTitlesOnly ? 'all' : 'incomplete')}
                            className={cn(
                                "flex h-10 items-center gap-2 border px-3 text-xs font-bold uppercase tracking-wider transition-colors",
                                isMissingTitlesOnly
                                    ? "border-destiny-gold bg-destiny-gold/10 text-destiny-gold"
                                    : "border-white/10 text-slate-400 hover:border-white/70 hover:text-white"
                            )}
                            aria-pressed={isMissingTitlesOnly}
                            title={isMissingTitlesOnly ? "Show all titles" : "Hide acquired titles"}
                        >
                            {isMissingTitlesOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            <span>{isMissingTitlesOnly ? "Missing Only" : "All Titles"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setGroupTitles(!groupTitles)}
                            className={cn(
                                "flex h-10 items-center gap-2 border px-3 text-xs font-bold uppercase tracking-wider transition-colors",
                                groupTitles
                                    ? "border-destiny-gold bg-destiny-gold/10 text-destiny-gold"
                                    : "border-white/10 text-slate-400 hover:border-white/70 hover:text-white"
                            )}
                            aria-pressed={groupTitles}
                            title={groupTitles ? "Ungroup titles" : "Group titles by acquired status"}
                        >
                            <Layers className="h-4 w-4" />
                            <span>Grouped</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BreadcrumbItem({ hash, onClick, isLast }: { hash: number, onClick: () => void, isLast: boolean }) {
    const { node } = usePresentationNode(hash);
    if (!node) return <span className="animate-pulse w-12 h-4" />;
    
    return (
        <button
            onClick={onClick}
            className={cn("hover:text-destiny-gold transition-colors max-w-[150px] truncate", isLast ? "text-destiny-gold font-bold" : "text-slate-400")}
        >
            {node.displayProperties?.name}
        </button>
    );
}

const SEAL_SORT_OPTIONS: { value: SealSortOption; label: string }[] = [
    { value: 'name_asc', label: 'Name Asc' },
    { value: 'name_desc', label: 'Name Desc' },
    { value: 'completion_asc', label: 'Completion Asc' },
    { value: 'completion_desc', label: 'Completion Desc' },
];

const SEAL_COMPLETION_FILTER_OPTIONS: { value: SealCompletionFilter; label: string }[] = [
    { value: 'all', label: 'All Seals' },
    { value: 'completed', label: 'Completed' },
    { value: 'incomplete', label: 'Incomplete' },
];

function getSealSortLabel(sortOption: SealSortOption) {
    return SEAL_SORT_OPTIONS.find((option) => option.value === sortOption)?.label || 'Name Asc';
}

function getSealCompletionFilterLabel(completionFilter: SealCompletionFilter) {
    return SEAL_COMPLETION_FILTER_OPTIONS.find((option) => option.value === completionFilter)?.label || 'All Seals';
}

function SealSortMenu({
    sortOption,
    completionFilter,
    onSortChange,
    onCompletionFilterChange,
}: {
    sortOption: SealSortOption,
    completionFilter: SealCompletionFilter,
    onSortChange: (sortOption: SealSortOption) => void,
    onCompletionFilterChange: (completionFilter: SealCompletionFilter) => void,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        function handlePointerDown(event: MouseEvent) {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    return (
        <div ref={menuRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((previousValue) => !previousValue)}
                className="flex h-10 w-10 items-center justify-center border border-destiny-gold bg-destiny-gold/10 text-destiny-gold transition-colors hover:bg-destiny-gold/15"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                title="Seal options"
            >
                <Settings2 className={cn("h-5 w-5 transition-transform", isOpen && "rotate-45")} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-64 border border-white/15 bg-[#0f151b] p-2 shadow-2xl">
                    <div className="px-2 pb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                        Sort By
                    </div>
                    <div className="space-y-1">
                        {SEAL_SORT_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onSortChange(option.value);
                                }}
                                className={cn(
                                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
                                    sortOption === option.value ? "text-destiny-gold" : "text-slate-300"
                                )}
                                role="menuitem"
                            >
                                <span>{option.label}</span>
                                {sortOption === option.value && <CheckCircle2 className="h-4 w-4" />}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 border-t border-white/10 px-2 pb-2 pt-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                        Completion
                    </div>
                    <div className="space-y-1">
                        {SEAL_COMPLETION_FILTER_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onCompletionFilterChange(option.value);
                                }}
                                className={cn(
                                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
                                    completionFilter === option.value ? "text-destiny-gold" : "text-slate-300"
                                )}
                                role="menuitem"
                            >
                                <span>{option.label}</span>
                                {completionFilter === option.value && <CheckCircle2 className="h-4 w-4" />}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 border-t border-white/10 px-2 pt-3 text-xs text-slate-500">
                        {getSealCompletionFilterLabel(completionFilter)} - {getSealSortLabel(sortOption)}
                    </div>
                </div>
            )}
        </div>
    );
}

function getSealNodeHash(nodeEntry: any) {
    return Number(nodeEntry.presentationNodeHash);
}

function getSealNodeName(nodeDefinition: any, nodeEntry?: any) {
    return nodeDefinition?.displayProperties?.name || nodeEntry?.displayProperties?.name || '';
}

function compareSealCompletion(firstProgress: NodeProgress, secondProgress: NodeProgress) {
    if (firstProgress.percent !== secondProgress.percent) {
        return firstProgress.percent - secondProgress.percent;
    }

    if (firstProgress.current !== secondProgress.current) {
        return firstProgress.current - secondProgress.current;
    }

    return firstProgress.total - secondProgress.total;
}

type SealNodeDisplayEntry = {
    entry: any;
    hash: number;
    definition: any;
    progress: NodeProgress;
    isComplete: boolean;
    isLegacy: boolean;
};

function isLegacySealNode(nodeEntry: any, nodeDefinition: any) {
    const displayProperties = nodeDefinition?.displayProperties ?? nodeEntry?.displayProperties ?? {};
    const searchableText = [
        displayProperties.name,
        displayProperties.description,
    ]
        .filter((value) => value !== undefined && value !== null)
        .join(' ')
        .toLowerCase();

    return (
        searchableText.includes('legacy') ||
        searchableText.includes('retired') ||
        searchableText.includes('unavailable') ||
        searchableText.includes('no longer available')
    );
}

function shouldShowSealForCompletionFilter(isComplete: boolean, completionFilter: SealCompletionFilter) {
    if (completionFilter === 'completed') return isComplete;
    if (completionFilter === 'incomplete') return !isComplete;
    return true;
}

const sealGridClassName = "grid grid-cols-2 justify-center gap-x-6 gap-y-8 sm:grid-cols-[repeat(auto-fill,152px)] sm:gap-x-10";

function SealNodeGrid({
    nodes,
    sortOption,
    completionFilter,
    onNodeClick,
    profile,
    groupTitles,
}: {
    nodes: any[],
    sortOption: SealSortOption,
    completionFilter: SealCompletionFilter,
    onNodeClick: (hash: number) => void,
    profile: any,
    groupTitles: boolean,
}) {
    const nodeHashes = useMemo(
        () => nodes.map(getSealNodeHash).filter(Boolean),
        [nodes]
    );
    const nodeHashesKey = nodeHashes.join(',');
    const { data: nodeDefinitions = {} } = useSWR(
        nodeHashesKey ? ['seal-node-definitions', nodeHashesKey] : null,
        async () => {
            const definitionEntries = await Promise.all(
                nodeHashes.map(async (hash) => {
                    const response = await bungieApi.get(endpoints.getPresentationNodeDefinition(hash));
                    return [hash, response.data.Response] as const;
                })
            );

            return Object.fromEntries(definitionEntries);
        }
    );

    const sortedNodes = useMemo<SealNodeDisplayEntry[]>(() => {
        return nodes
            .map((nodeEntry: any) => {
                const hash = getSealNodeHash(nodeEntry);
                const definition = nodeDefinitions[hash];
                const progress = getPresentationNodeProgress(hash, definition, profile);
                const isComplete = progress.total > 0 && progress.current >= progress.total;
                const isLegacy = Boolean(nodeEntry.isLegacyTitleNode) || isLegacySealNode(nodeEntry, definition);

                return { entry: nodeEntry, hash, definition, progress, isComplete, isLegacy };
            })
            .filter((nodeEntry) => nodeEntry.hash)
            .filter((nodeEntry) => shouldShowSealForCompletionFilter(nodeEntry.isComplete, completionFilter))
            .sort((firstNodeEntry, secondNodeEntry) => {
            const firstNodeDefinition = firstNodeEntry.definition;
            const secondNodeDefinition = secondNodeEntry.definition;

            if (sortOption === 'name_asc' || sortOption === 'name_desc') {
                const nameComparison = getSealNodeName(firstNodeDefinition, firstNodeEntry.entry).localeCompare(
                    getSealNodeName(secondNodeDefinition, secondNodeEntry.entry)
                );

                if (nameComparison !== 0) {
                    return sortOption === 'name_asc' ? nameComparison : -nameComparison;
                }
            }

            if (sortOption === 'completion_asc' || sortOption === 'completion_desc') {
                const firstProgress = firstNodeEntry.progress;
                const secondProgress = secondNodeEntry.progress;
                const progressComparison = compareSealCompletion(firstProgress, secondProgress);

                if (progressComparison !== 0) {
                    return sortOption === 'completion_asc' ? progressComparison : -progressComparison;
                }
            }

            return (firstNodeEntry.entry.nodeDisplayPriority || 0) - (secondNodeEntry.entry.nodeDisplayPriority || 0);
        });
    }, [completionFilter, nodes, nodeDefinitions, profile, sortOption]);

    const renderSealNodeCards = (entries: SealNodeDisplayEntry[]) => (
        <div className={sealGridClassName}>
            {entries.map((nodeEntry) => (
                <SealNodeCard
                    key={nodeEntry.hash}
                    hash={nodeEntry.hash}
                    onClick={onNodeClick}
                    profile={profile}
                    completionFilter="all"
                    isLegacy={nodeEntry.isLegacy}
                />
            ))}
        </div>
    );

    if (sortedNodes.length === 0) {
        return <div className="text-center text-slate-500 py-12">No titles found.</div>;
    }

    const standardTitles = sortedNodes.filter((nodeEntry) => !nodeEntry.isLegacy);
    const legacyTitles = sortedNodes.filter((nodeEntry) => nodeEntry.isLegacy);

    const renderStandardTitles = (entries: SealNodeDisplayEntry[]) => {
        if (entries.length === 0) return null;

        if (groupTitles) {
            const acquiredTitles = entries.filter((nodeEntry) => nodeEntry.isComplete);
            const missingTitles = entries.filter((nodeEntry) => !nodeEntry.isComplete);

            return (
                <div className="space-y-8">
                    {acquiredTitles.length > 0 && (
                        <section className="space-y-3">
                            <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-[0.22em] text-destiny-gold">
                                Acquired Titles
                            </h3>
                            {renderSealNodeCards(acquiredTitles)}
                        </section>
                    )}
                    {missingTitles.length > 0 && (
                        <section className="space-y-3">
                            <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                                Missing Titles
                            </h3>
                            {renderSealNodeCards(missingTitles)}
                        </section>
                    )}
                </div>
            );
        }

        return renderSealNodeCards(entries);
    };

    const standardTitleContent = renderStandardTitles(standardTitles);

    if (legacyTitles.length > 0) {
        return (
            <div className="space-y-10">
                {standardTitleContent}
                <section className="space-y-4 border-t border-white/10 pt-6">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/10" />
                        <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                            Legacy Titles
                        </h3>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>
                    {renderSealNodeCards(legacyTitles)}
                </section>
            </div>
        );
    }

    return standardTitleContent;
}

function getRecordComponent(profile: any, recordHash: number) {
    const profileRecord = profile?.profileRecords?.data?.records?.[recordHash];
    if (profileRecord) return profileRecord;

    const characterRecords = profile?.characterRecords?.data;
    if (!characterRecords) return null;

    let bestRecord = null;

    for (const characterId in characterRecords) {
        const characterRecord = characterRecords[characterId].records?.[recordHash];
        if (!characterRecord) continue;

        const isCharacterRecordCompleted = (characterRecord.state & 4) === 0;
        if (!bestRecord || isCharacterRecordCompleted) {
            bestRecord = characterRecord;
        }
    }

    return bestRecord;
}

function getPresentationComponentProgress(hash: number, profile: any): NodeProgress | null {
    const profileNode = profile?.profilePresentationNodes?.data?.nodes?.[hash];
    const characterNodes = profile?.characterPresentationNodes?.data;
    let bestProgress = profileNode?.progressValue || 0;
    let bestCompletion = profileNode?.completionValue || 0;

    if (characterNodes) {
        for (const characterId in characterNodes) {
            const characterNode = characterNodes[characterId].nodes?.[hash];
            if (!characterNode) continue;

            if (characterNode.progressValue > bestProgress) {
                bestProgress = characterNode.progressValue;
                bestCompletion = characterNode.completionValue;
            }
        }
    }

    if (bestCompletion <= 0) return null;

    return {
        current: bestProgress,
        total: bestCompletion,
        percent: Math.min(100, (bestProgress / bestCompletion) * 100),
    };
}

function getRecordProgressFromNode(node: any, profile: any): NodeProgress | null {
    const childRecords = node?.children?.records || [];
    if (childRecords.length === 0) return null;

    let completedRecordCount = 0;
    let visibleRecordCount = 0;

    childRecords.forEach((childRecord: any) => {
        const recordComponent = getRecordComponent(profile, childRecord.recordHash);
        const recordState = recordComponent?.state;
        const isInvisible = recordState !== undefined && (recordState & 16) === 16;

        if (isInvisible) return;

        visibleRecordCount += 1;

        if (recordState !== undefined && (recordState & 4) === 0) {
            completedRecordCount += 1;
        }
    });

    if (visibleRecordCount === 0) return null;

    return {
        current: completedRecordCount,
        total: visibleRecordCount,
        percent: Math.min(100, (completedRecordCount / visibleRecordCount) * 100),
    };
}

function getPresentationNodeProgress(hash: number, node: any, profile: any): NodeProgress {
    const componentProgress = getPresentationComponentProgress(hash, profile);
    const recordProgress = componentProgress || getRecordProgressFromNode(node, profile);

    return recordProgress || {
        current: 0,
        total: 0,
        percent: 0,
    };
}

function PresentationNodeCard({ hash, onClick, profile }: { hash: number, onClick: (h: number) => void, profile: any }) {
    const { node, isLoading } = usePresentationNode(hash);

    if (isLoading) return <div className="h-24 bg-white/5 animate-pulse rounded-none" />;
    if (!node) return null;

    const progress = getPresentationNodeProgress(hash, node, profile);

    return (
        <div 
            onClick={() => onClick(hash)}
            className="group relative flex items-center gap-4 p-4 border border-white/10 hover:bg-linear-to-r from-destiny-gold/5 to-transparent hover:border-destiny-gold/30 transition-all cursor-pointer rounded-none"
        >
            {node.displayProperties?.hasIcon && (
                <div className="w-14 h-14 shrink-0 bg-black/30 p-1 border border-white/5 rounded-none overflow-hidden relative">
                    <Image 
                        src={getBungieImage(node.displayProperties.icon)} 
                        fill 
                        sizes="56px"
                        className="object-contain transition-transform" 
                        alt="" 
                    />
                </div>
            )}
            <div className="overflow-hidden flex-1">
                <ScrollingText className="font-bold text-lg text-white group-hover:text-destiny-gold transition-colors">
                    {node.displayProperties?.name}
                </ScrollingText>
                {progress.total > 0 && (
                    <div className="mt-2">
                         <div className="flex justify-between text-xs text-slate-400 mb-1">
                             <span>{progress.current} / {progress.total}</span>
                             <span>{Math.floor(progress.percent)}%</span>
                         </div>
                         <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                             <div className="h-full bg-destiny-gold transition-all duration-500" style={{ width: `${progress.percent}%` }} />
                         </div>
                    </div>
                )}
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
        </div>
    );
}

function SealNodeCard({
    hash,
    onClick,
    profile,
    completionFilter,
    isLegacy = false,
}: {
    hash: number,
    onClick: (h: number) => void,
    profile: any,
    completionFilter: SealCompletionFilter,
    isLegacy?: boolean,
}) {
    const { node, isLoading } = usePresentationNode(hash);

    if (isLoading) return <div className="aspect-square bg-white/5 animate-pulse rounded-none" />;
    if (!node) return null;

    const progress = getPresentationNodeProgress(hash, node, profile);
    const isComplete = progress.total > 0 && progress.current >= progress.total;

    if (completionFilter === 'completed' && !isComplete) return null;
    if (completionFilter === 'incomplete' && isComplete) return null;

    return (
        <button
            type="button"
            onClick={() => onClick(hash)}
            title={node.displayProperties?.name}
            className={cn(
                "group flex min-w-0 flex-col items-center text-left",
                isLegacy && "opacity-65 grayscale transition-opacity hover:opacity-90"
            )}
        >
            <div className="relative aspect-square w-full max-w-[168px] overflow-hidden border border-transparent transition-colors duration-200 group-hover:border-white/15">
                {progress.total > 0 && (
                    <div className="absolute left-1/2 top-0 z-10 h-4 w-[76%] max-w-[122px] -translate-x-1/2">
                        <div
                            className="h-full bg-[#d6c586] transition-all duration-500"
                            style={{ width: `${progress.percent}%` }}
                        />
                        <div className="absolute right-0 top-0 text-[11px] font-bold leading-4 text-white drop-shadow">
                            {progress.current} / {progress.total}
                        </div>
                    </div>
                )}

                <div className="absolute inset-x-0 bottom-0 top-4">
                    {node.displayProperties?.hasIcon ? (
                        <Image
                            src={getBungieImage(node.displayProperties.icon)}
                            fill
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
                            className={cn(
                                "object-contain",
                                !isComplete && "opacity-95"
                            )}
                            alt=""
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Trophy className="h-12 w-12 text-slate-600" />
                        </div>
                    )}
                </div>

                {isComplete && (
                    <CheckCircle2 className="absolute bottom-2 right-2 z-10 h-5 w-5 text-destiny-gold drop-shadow" />
                )}
            </div>

            <div className={cn(
                "mt-2 min-h-8 overflow-hidden text-center text-xs font-bold uppercase tracking-wider transition-colors group-hover:text-destiny-gold",
                isLegacy ? "text-slate-500" : "text-slate-300"
            )}>
                <ScrollingText>{node.displayProperties?.name}</ScrollingText>
            </div>
        </button>
    );
}

function getSealTitleName(name: string | undefined) {
    if (!name) return '';
    if (name.endsWith('s') && !name.endsWith('ss')) {
        return name.slice(0, -1);
    }
    return name;
}

function getRecordObjectiveRows(record: any, recordComponent: any) {
    const componentObjectives = recordComponent?.objectives || [];

    if (componentObjectives.length > 0) {
        return componentObjectives.map((objective: any) => {
            const definitionObjective = record.objectives?.find(
                (recordObjective: any) => recordObjective.objectiveHash === objective.objectiveHash
            );
            const total = objective.completionValue || definitionObjective?.completionValue || 1;

            return {
                objectiveHash: objective.objectiveHash,
                current: objective.progress || 0,
                total,
                isComplete: Boolean(objective.complete),
            };
        });
    }

    const intervalObjectives = record.intervalInfo?.intervalObjectives || [];
    return intervalObjectives.map((intervalObjective: any) => ({
        objectiveHash: intervalObjective.intervalObjectiveHash,
        current: 0,
        total: 1,
        isComplete: false,
    }));
}

function getRecordProgress(record: any, recordComponent: any) {
    const rows = getRecordObjectiveRows(record, recordComponent);

    if (rows.length === 0) {
        const state = recordComponent?.state ?? 6;
        const isComplete = (state & 4) === 0;
        return {
            percent: isComplete ? 100 : 0,
            current: isComplete ? 1 : 0,
            total: 1,
        };
    }

    const totalProgress = rows.reduce((sum: number, row: any) => {
        return sum + Math.min(1, row.total > 0 ? row.current / row.total : 0);
    }, 0);

    const current = rows.reduce((sum: number, row: any) => sum + row.current, 0);
    const total = rows.reduce((sum: number, row: any) => sum + row.total, 0);

    return {
        percent: Math.min(100, (totalProgress / rows.length) * 100),
        current,
        total,
    };
}

function SealDetailView({
    hash,
    node,
    records,
    profile,
    visibilityOptions,
    onBack,
}: {
    hash: number,
    node: any,
    records: any[],
    profile: any,
    visibilityOptions: RecordVisibilityOptions,
    onBack: () => void,
}) {
    const progress = getPresentationNodeProgress(hash, node, profile);
    const titleName = getSealTitleName(node?.displayProperties?.name);

    return (
        <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="xl:sticky xl:top-24 xl:self-start">
                <button
                    type="button"
                    onClick={onBack}
                    className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-destiny-gold"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Seals
                </button>

                <div className="border-r border-white/10 pr-8">
                    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
                        {node?.displayProperties?.hasIcon ? (
                            <Image
                                src={getBungieImage(node.displayProperties.icon)}
                                fill
                                sizes="260px"
                                className="object-contain"
                                alt=""
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <Trophy className="h-16 w-16 text-slate-600" />
                            </div>
                        )}
                    </div>

                    <div className="mt-8 space-y-5">
                        <div>
                            <h2 className="text-3xl font-semibold text-white">
                                {node?.displayProperties?.name}
                            </h2>
                            {node?.displayProperties?.description && (
                                <p className="mt-3 text-sm italic leading-relaxed text-slate-400">
                                    {node.displayProperties.description}
                                </p>
                            )}
                        </div>

                        {progress.total > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                                    <span>Title Progress</span>
                                    <span>{progress.current} / {progress.total}</span>
                                </div>
                                <div className="h-1.5 bg-white/15">
                                    <div
                                        className="h-full bg-white"
                                        style={{ width: `${progress.percent}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {titleName && (
                            <div className="border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-300">
                                {titleName}
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <div className="grid auto-rows-min gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {records.map((recordEntry: any) => (
                    <SealRecordCard
                        key={recordEntry.recordHash}
                        hash={recordEntry.recordHash}
                        profile={profile}
                        visibilityOptions={visibilityOptions}
                    />
                ))}
            </div>
        </div>
    );
}

function shouldHideRecord(
    state: number,
    hasRecordComponent: boolean,
    isCompleted: boolean,
    visibilityOptions: RecordVisibilityOptions
) {
    const isInvisible = (state & 16) === 16;
    const isUnobtainable = hasRecordComponent && !isCompleted && (state & 2) === 2;

    if (isInvisible && visibilityOptions.hideInvisible) return true;
    if (isUnobtainable && visibilityOptions.hideUnobtainable) return true;
    if (isCompleted && !visibilityOptions.showCompleted) return true;

    return false;
}

function SealRecordCard({
    hash,
    profile,
    visibilityOptions,
}: {
    hash: number,
    profile: any,
    visibilityOptions: RecordVisibilityOptions,
}) {
    const { record, isLoading } = useRecord(hash);

    if (isLoading) return <div className="min-h-36 border border-white/10 bg-white/5 animate-pulse" />;
    if (!record) return null;

    const recordComponent = getRecordComponent(profile, hash);
    const state = recordComponent?.state ?? 6;
    const isCompleted = (state & 4) === 0;
    const isObscured = (state & 8) === 8;
    const objectiveRows = isObscured ? [] : getRecordObjectiveRows(record, recordComponent);
    const progress = getRecordProgress(record, recordComponent);
    const score = record.completionInfo?.ScoreValue || 0;

    if (shouldHideRecord(state, Boolean(recordComponent), isCompleted, visibilityOptions)) return null;

    return (
        <article className={cn(
            "min-h-36 border p-4 transition-colors",
            isCompleted
                ? "border-[#d6c586] bg-[#d6c586]/15"
                : "border-white/20 bg-black/15"
        )}>
            <div className="flex items-start gap-4">
                <div className="relative h-10 w-10 shrink-0">
                    {record.displayProperties?.hasIcon ? (
                        <Image
                            src={getBungieImage(record.displayProperties.icon)}
                            fill
                            sizes="40px"
                            className={cn("object-contain", !isCompleted && "opacity-80")}
                            alt=""
                        />
                    ) : (
                        <Trophy className="h-8 w-8 text-white/80" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold leading-tight text-white">
                            {isObscured ? "Secret Triumph" : record.displayProperties?.name}
                        </h3>
                        <div className="shrink-0 text-right text-xs font-bold text-slate-300">
                            <span className="underline decoration-dotted underline-offset-2">
                                {progress.percent.toFixed(2)}%
                            </span>
                            {score > 0 && <span className="text-slate-500"> / {score}</span>}
                        </div>
                    </div>

                    <PretextLineClamp
                        className="mt-2 text-sm leading-snug text-slate-400"
                        maxLines={2}
                        text={isObscured ? "???" : (record.displayProperties?.description ?? '')}
                    />
                </div>
            </div>

            {objectiveRows.length > 0 && (
                <div className="mt-4 space-y-1.5">
                    {objectiveRows.slice(0, 6).map((objective: any) => (
                        <SealObjectiveRow
                            key={objective.objectiveHash}
                            objective={objective}
                            isCompleted={isCompleted}
                        />
                    ))}
                </div>
            )}
        </article>
    );
}

function SealObjectiveRow({ objective, isCompleted }: { objective: any, isCompleted: boolean }) {
    const { data } = useSWR(
        objective.objectiveHash ? endpoints.getObjectiveDefinition(objective.objectiveHash) : null,
        (url: string) => bungieApi.get(url).then((res) => res.data)
    );
    const objectiveDefinition = data?.Response;
    const label =
        objectiveDefinition?.progressDescription ||
        objectiveDefinition?.displayProperties?.name ||
        'Objective';
    const percent = objective.total > 0 ? Math.min(100, (objective.current / objective.total) * 100) : 0;

    return (
        <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2 text-xs text-slate-200">
            <div className={cn(
                "h-4 w-4 border",
                objective.isComplete || isCompleted ? "border-[#d6c586] bg-[#d6c586]/35" : "border-white/40"
            )} />
            <div className="relative h-5 overflow-hidden bg-white/[0.08]">
                <div
                    className={cn("h-full", objective.isComplete || isCompleted ? "bg-[#d6c586]/45" : "bg-emerald-500/65")}
                    style={{ width: `${percent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between gap-2 px-2">
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 font-bold text-slate-200">
                        {objective.current}/{objective.total}
                    </span>
                </div>
            </div>
        </div>
    );
}

function RecordItem({
    hash,
    profile,
    visibilityOptions,
}: {
    hash: number,
    profile: any,
    visibilityOptions: RecordVisibilityOptions,
}) {
    const { record, isLoading } = useRecord(hash);

    if (isLoading) return <div className="h-20 bg-white/5 animate-pulse rounded-none" />;
    if (!record) return null;

    const recordComponent = getRecordComponent(profile, hash);
    
    const state = recordComponent?.state ?? 6; // Default: ObjectiveNotCompleted | RewardUnavailable
    const isCompleted = (state & 4) === 0; // ObjectiveNotCompleted bit is 0
    const isObscured = (state & 8) === 8;

    if (shouldHideRecord(state, Boolean(recordComponent), isCompleted, visibilityOptions)) return null;

    const objectives = recordComponent?.objectives || [];
    const score = record.completionInfo?.ScoreValue || 0;
    const title = record.titleInfo?.hasTitle ? record.titleInfo.titlesByGender?.Male : null;

    return (
        <div className={cn(
            "relative flex flex-col sm:flex-row gap-4 p-4 border transition-all rounded-none",
            isCompleted ? "bg-linear-to-r from-destiny-gold/5 to-transparent border-destiny-gold/20" : "bg-none border-white/5"
        )}>
            {/* Icon */}
            <div className="shrink-0 w-12 h-12 flex items-center justify-center self-start">
                {record.displayProperties?.hasIcon ? (
                    <Image 
                        src={getBungieImage(record.displayProperties.icon)} 
                        width={40}
                        height={40}
                        className={cn("object-contain", !isCompleted && "grayscale opacity-50")} 
                        alt="" 
                    />
                ) : (
                    <Trophy className="w-6 h-6 text-slate-600" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 overflow-hidden">
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <ScrollingText className={cn("font-bold text-white", isCompleted && "text-destiny-gold")}>
                            {isObscured ? "Secret Triumph" : record.displayProperties?.name}
                        </ScrollingText>
                        <PretextLineClamp
                            className="text-sm text-slate-400 line-clamp-2 mt-1"
                            maxLines={2}
                            text={isObscured ? "???" : (record.displayProperties?.description ?? '')}
                        />
                        {title && isCompleted && (
                            <div className="text-xs text-purple-400 mt-1 uppercase tracking-wider">
                                Title Unlocked: {title}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {score > 0 && (
                            <div className="text-xs font-bold text-destiny-gold bg-black/40 px-2 py-1 rounded-none border border-white/5 whitespace-nowrap">
                                {score} pts
                            </div>
                        )}
                    </div>
                </div>

                {/* Objectives */}
                {!isObscured && objectives.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {objectives.map((obj: any, i: number) => {
                             const defObj = record.objectives?.find((o: any) => o.objectiveHash === obj.objectiveHash);
                             const total = obj.completionValue || defObj?.completionValue || 1;
                             const current = obj.progress || 0;
                             const percent = Math.min(100, (current / total) * 100);
                             const complete = obj.complete;

                             return (
                                 <div key={i} className="text-xs">
                                     <div className="flex justify-between text-slate-400 mb-1">
                                         <span>{current} / {total}</span>
                                         <span>{Math.floor(percent)}%</span>
                                     </div>
                                     <div className="h-1.5 rounded-full overflow-hidden">
                                         <div 
                                            className={cn("h-full transition-all", complete ? "bg-destiny-gold" : "bg-blue-500")} 
                                            style={{ width: `${percent}%` }} 
                                         />
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                )}
                
                {/* Single Checkbox if no objectives but completed */}
                {isCompleted && objectives.length === 0 && (
                    <div className="mt-2 flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-widest">
                        <CheckCircle2 className="w-4 h-4" /> Completed
                    </div>
                )}
            </div>
        </div>
    );
}
