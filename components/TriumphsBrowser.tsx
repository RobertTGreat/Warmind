'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePresentationNode, useRecord } from '@/hooks/useDefinitions';
import { ChevronRight, ArrowLeft, CheckCircle2, Trophy, Search, X, AlertTriangle } from 'lucide-react';
import { getBungieImage, bungieApi, endpoints } from '@/lib/bungie';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { ScrollingText } from '@/components/ScrollingText';
import { PretextLineClamp } from '@/components/PretextLineClamp';

interface TriumphsBrowserProps {
    rootHash: number;
}

export function TriumphsBrowser({ rootHash }: TriumphsBrowserProps) {
    const [history, setHistory] = useState<number[]>([]);
    const [currentHash, setCurrentHash] = useState<number | undefined>(rootHash);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [showCompleted, setShowCompleted] = useState(true);

    const { node, isLoading, isError } = usePresentationNode(currentHash);
    const { profile } = useDestinyProfileContext();

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

    const childNodes = node?.children?.presentationNodes || [];
    const childRecords = node?.children?.records || [];

    return (
        <div className="space-y-6">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
               <div className="flex-1 w-full">
                   <form onSubmit={performSearch} className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                       <input 
                           type="text"
                           placeholder="Search triumphs..."
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
               
               <button
                   onClick={() => setShowCompleted(!showCompleted)}
                   className={cn(
                       "flex items-center gap-2 px-4 py-2 border transition-all rounded-none min-w-[160px] justify-center",
                       showCompleted ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold" : "bg-black/20 border-white/10 text-slate-500 hover:text-slate-300"
                   )}
               >
                   <div className={cn("w-2 h-2 rounded-full", showCompleted ? "bg-destiny-gold" : "bg-slate-600")} />
                   <span className="text-sm font-bold uppercase tracking-wider hover:cursor-pointer">
                       {showCompleted ? "All Triumphs" : "Incomplete Only"}
                   </span>
               </button>
            </div>

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
                                    showCompleted={showCompleted}
                                />
                             ))}
                        </div>
                    ) : (
                        <div className="text-slate-400">No results found.</div>
                    )}
                </div>
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

                    {/* Sub-Categories */}
                    {childNodes.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {childNodes.map((child: any) => (
                                <PresentationNodeCard 
                                    key={child.presentationNodeHash} 
                                    hash={child.presentationNodeHash} 
                                    onClick={handleNodeClick} 
                                    profile={profile}
                                />
                            ))}
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
                                    showCompleted={showCompleted}
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

function PresentationNodeCard({ hash, onClick, profile }: { hash: number, onClick: (h: number) => void, profile: any }) {
    const { node, isLoading } = usePresentationNode(hash);

    if (isLoading) return <div className="h-24 bg-white/5 animate-pulse rounded-none" />;
    if (!node) return null;

    // Calculate progress from Profile/Character Presentation Nodes
    // Try profile first
    const profileNode = profile?.profilePresentationNodes?.data?.nodes?.[hash];
    const characterNodes = profile?.characterPresentationNodes?.data;
    
    // If not in profile, check all characters and sum/max?
    // Usually Presentation Nodes are either Profile Scoped or Character Scoped.
    // If scoped to character, we usually take the "best" or "active" one.
    // Let's look for any progress.
    
    let progress = profileNode?.progressValue || 0;
    let completion = profileNode?.completionValue || 0;
    
    if (!profileNode && characterNodes) {
        // Check character nodes
        // Taking the first one that has this node for now, or max progress
        for (const charId in characterNodes) {
             const charNode = characterNodes[charId].nodes?.[hash];
             if (charNode) {
                 if (charNode.progressValue > progress) {
                     progress = charNode.progressValue;
                     completion = charNode.completionValue;
                 }
             }
        }
    }

    // If we still don't have completion value but definition implies it (some nodes don't track progress explicitly via API if purely organizational)
    // But usually 700/701 gives it.
    
    const percent = completion > 0 ? Math.min(100, (progress / completion) * 100) : 0;

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
                {completion > 0 && (
                    <div className="mt-2">
                         <div className="flex justify-between text-xs text-slate-400 mb-1">
                             <span>{progress} / {completion}</span>
                             <span>{Math.floor(percent)}%</span>
                         </div>
                         <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                             <div className="h-full bg-destiny-gold transition-all duration-500" style={{ width: `${percent}%` }} /> 
                         </div>
                    </div>
                )}
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
        </div>
    );
}

function RecordItem({ hash, profile, showCompleted }: { hash: number, profile: any, showCompleted: boolean }) {
    const { record, isLoading } = useRecord(hash);

    if (isLoading) return <div className="h-20 bg-white/5 animate-pulse rounded-none" />;
    if (!record) return null;

    // Find record state
    const profileRecord = profile?.profileRecords?.data?.records?.[hash];
    // Check character records if not in profile
    let recordComponent = profileRecord;
    
    if (!recordComponent && profile?.characterRecords?.data) {
         // Iterate chars to find best progress or just the first one
         // Usually records are consistently present if they exist for char
         for (const charId in profile.characterRecords.data) {
             const charRecord = profile.characterRecords.data[charId].records?.[hash];
             if (charRecord) {
                 // Prefer completed one?
                 if (!recordComponent || ((charRecord.state & 4) === 0)) {
                     recordComponent = charRecord;
                 }
             }
         }
    }
    
    const state = recordComponent?.state ?? 6; // Default: ObjectiveNotCompleted | RewardUnavailable
    const isCompleted = (state & 4) === 0; // ObjectiveNotCompleted bit is 0
    const isRedeemed = (state & 1) === 1;
    const isObscured = (state & 8) === 8;
    const isInvisible = (state & 16) === 16;
    const isEntitled = (state & 2) === 2; // Can redeem

    if (isInvisible) return null;
    if (isCompleted && !showCompleted) return null;

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
