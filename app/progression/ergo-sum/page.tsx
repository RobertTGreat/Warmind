'use client';

import { useState, useMemo, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { Loader2, Swords, CheckCircle2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from 'next/image';
import { getBungieImage } from '@/lib/bungie';

// Lazy load components
const PageHeader = dynamic(
  () => import("@/components/PageHeader").then((mod) => mod.PageHeader),
  { ssr: false }
);

const ERGO_SUM_HASH = 3514146698;

// All possible Ergo Sum rolls
const ERGO_SUM_PERKS = {
    FRAMES: [
        "Wave Sword Frame",
        "Caster Frame", 
        "Vortex Frame",
        "Lightweight Frame",
        "Aggressive Frame"
    ],
    TRAITS: [
        "Wolfpack Rounds",
        "Gathering Light",
        "Sacred Flame",
        "The Perfect Fifth",
        "Arc Conductor",
        "Stormbringer",
        "Unplanned Reprieve",
        "Insectoid Robot Grenades"
    ]
};

function useAllItems(profile: any) {
    return useMemo(() => {
        if (!profile) return [];
        const items: any[] = [];
        
        if (profile.characterInventories?.data) {
            Object.values(profile.characterInventories.data).forEach((char: any) => items.push(...char.items));
        }
        if (profile.characterEquipment?.data) {
            Object.values(profile.characterEquipment.data).forEach((char: any) => items.push(...char.items));
        }
        if (profile.profileInventory?.data?.items) {
            items.push(...profile.profileInventory.data.items);
        }
        return items;
    }, [profile]);
}

export default function ErgoSumPage() {
    const { profile, isLoading } = useDestinyProfile();
    const [searchQuery, setSearchQuery] = useState('');
    const allItems = useAllItems(profile);
    const socketsData = profile?.itemComponents?.sockets?.data;
    
    // Filter for Ergo Sum swords
    const ergoSumItems = useMemo(() => {
        return allItems.filter((item: any) => String(item.itemHash) === String(ERGO_SUM_HASH));
    }, [allItems]);

    // Extract plug hashes from all Ergo Sum items (check all plugs, not just enabled)
    const plugHashes = useMemo(() => {
        const hashes = new Set<number>();
        ergoSumItems.forEach(item => {
            const sockets = socketsData?.[item.itemInstanceId]?.sockets;
            if (sockets) {
                sockets.forEach((s: any) => {
                    // Check all plugs, not just enabled ones
                    if (s.plugHash) hashes.add(s.plugHash);
                });
            }
        });
        return Array.from(hashes);
    }, [ergoSumItems, socketsData]);

    const { definitions, isLoading: defsLoading } = useItemDefinitions(plugHashes);

    // Build collection matrix - check all Ergo Sum items in inventory/vault
    const { collectedSet, collectedCount, totalCount } = useMemo(() => {
        const empty = { 
            collectedSet: new Set<string>(), 
            collectedCount: 0, 
            totalCount: ERGO_SUM_PERKS.FRAMES.length * ERGO_SUM_PERKS.TRAITS.length 
        };
        if (defsLoading || !definitions) return empty;
        
        const collectedSet = new Set<string>();

        // Check all Ergo Sum items in inventory/vault
        // allItems already includes character inventories, equipment, and vault
        ergoSumItems.forEach(item => {
            const sockets = socketsData?.[item.itemInstanceId]?.sockets;
            if (!sockets) return;

            // Get all plug hashes from sockets (check all plugs)
            const itemPlugHashes = sockets
                .map((s: any) => s.plugHash)
                .filter(Boolean);

            // Get plug names from definitions
            const plugNames = itemPlugHashes
                .map((hash: number) => definitions[hash]?.displayProperties?.name)
                .filter(Boolean);

            // Find matches by exact name or partial match
            const frame = ERGO_SUM_PERKS.FRAMES.find(f => 
                plugNames.some((n: string) => n === f || n.includes(f) || f.includes(n))
            );
            const trait = ERGO_SUM_PERKS.TRAITS.find(t => 
                plugNames.some((n: string) => n === t || n.includes(t) || t.includes(n))
            );

            if (frame && trait) {
                collectedSet.add(`${frame}|${trait}`);
            }
        });

        return {
            collectedSet,
            collectedCount: collectedSet.size,
            totalCount: empty.totalCount
        };
    }, [ergoSumItems, definitions, socketsData, defsLoading]);

    // Filter by search
    const filteredFrames = useMemo(() => {
        if (!searchQuery) return ERGO_SUM_PERKS.FRAMES;
        const query = searchQuery.toLowerCase();
        return ERGO_SUM_PERKS.FRAMES.filter(f => f.toLowerCase().includes(query));
    }, [searchQuery]);

    const filteredTraits = useMemo(() => {
        if (!searchQuery) return ERGO_SUM_PERKS.TRAITS;
        const query = searchQuery.toLowerCase();
        return ERGO_SUM_PERKS.TRAITS.filter(t => t.toLowerCase().includes(query));
    }, [searchQuery]);

    if (isLoading || defsLoading) {
        return (
            <div className="w-full h-[calc(100vh-80px)] flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-destiny-gold" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24">
            <PageHeader 
                title="Ergo Sum Collection" 
                description="Track all possible Ergo Sum exotic sword rolls. Frame + Trait combinations."
            />

            {/* Stats */}
            <div className="mt-8 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-white">{collectedCount}</div>
                        <div className="text-sm text-slate-400">Collected</div>
                    </div>
                    <div className="h-12 w-px bg-white/10" />
                    <div className="text-center">
                        <div className="text-3xl font-bold text-slate-400">{totalCount}</div>
                        <div className="text-sm text-slate-400">Total</div>
                    </div>
                    <div className="h-12 w-px bg-white/10" />
                    <div className="text-center">
                        <div className="text-3xl font-bold text-destiny-gold">
                            {Math.round((collectedCount / totalCount) * 100)}%
                        </div>
                        <div className="text-sm text-slate-400">Complete</div>
                    </div>
                </div>

                {/* Search */}
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search frames or traits..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-destiny-gold/50"
                    />
                </div>
            </div>

            {/* Collection Matrix */}
            <div className="bg-gray-800/20 border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Swords className="w-6 h-6 text-destiny-gold" />
                    <h2 className="text-xl font-bold text-white">Ergo Sum Collection Matrix</h2>
                </div>

                <div className="overflow-x-auto pb-2">
                    <div className="inline-block min-w-full">
                        <div className="grid gap-1" style={{ 
                            gridTemplateColumns: `auto repeat(${ERGO_SUM_PERKS.TRAITS.length}, minmax(80px, 1fr))` 
                        }}>
                            {/* Header Row */}
                            <div className="sticky left-0 z-10 p-2 bg-gray-900/80 backdrop-blur-sm rounded-l-sm border border-white/5"></div>
                            {ERGO_SUM_PERKS.TRAITS.map((trait, i) => {
                                const isVisible = filteredTraits.includes(trait);
                                if (!isVisible) return null;
                                return (
                                    <div 
                                        key={trait} 
                                        className={cn(
                                            "text-[10px] font-bold text-slate-400 text-center py-2 flex items-center justify-center whitespace-nowrap border border-white/5 bg-gray-900/80 backdrop-blur-sm",
                                            i === ERGO_SUM_PERKS.TRAITS.length - 1 && "rounded-r-sm"
                                        )}
                                        title={trait}
                                    >
                                        <span className="truncate px-1">{trait.replace(' Frame', '').replace('Spirit of ', '')}</span>
                                    </div>
                                );
                            })}

                            {/* Rows for each frame */}
                            {ERGO_SUM_PERKS.FRAMES.map((frame, frameIdx) => {
                                const isFrameVisible = filteredFrames.includes(frame);
                                if (!isFrameVisible) return null;
                                
                                return (
                                    <Fragment key={frame}>
                                        <div className="sticky left-0 z-10 text-right pr-4 py-2 pl-2 text-xs font-bold text-slate-300 flex items-center justify-end whitespace-nowrap bg-gray-900/80 backdrop-blur-sm rounded-l-sm border-y border-l border-white/5">
                                            {frame.replace(' Frame', '')}
                                        </div>
                                        {ERGO_SUM_PERKS.TRAITS.map((trait, traitIdx) => {
                                            const isTraitVisible = filteredTraits.includes(trait);
                                            if (!isTraitVisible) return null;
                                            
                                            const isCollected = collectedSet.has(`${frame}|${trait}`);
                                            const isLast = traitIdx === ERGO_SUM_PERKS.TRAITS.length - 1;
                                            return (
                                                <div 
                                                    key={`${frame}-${trait}`} 
                                                    className={cn(
                                                        "flex items-center justify-center p-2 border-y border-white/5 transition-colors relative group",
                                                        isCollected ? "bg-green-500/10 hover:bg-green-500/20" : "hover:bg-white/5",
                                                        isLast && "rounded-r-sm border-r"
                                                    )}
                                                    title={`${frame} + ${trait}`}
                                                >
                                                    {isCollected ? (
                                                        <div className="relative">
                                                            <div className="absolute inset-0 bg-green-500 blur-md opacity-20" />
                                                            <CheckCircle2 className="w-5 h-5 text-green-500 relative z-10" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Your Ergo Sum Swords */}
            {ergoSumItems.length > 0 && (
                <div className="mt-8 bg-gray-800/20 border border-white/10 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">
                        Your Ergo Sum Swords ({ergoSumItems.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {ergoSumItems.map((item: any) => {
                            const sockets = socketsData?.[item.itemInstanceId]?.sockets;
                            const plugNames = sockets
                                ?.map((s: any) => definitions[s.plugHash]?.displayProperties?.name)
                                .filter(Boolean) || [];
                            
                            const frame = ERGO_SUM_PERKS.FRAMES.find(f => 
                                plugNames.includes(f) || plugNames.some((n: string) => n?.includes(f))
                            );
                            const trait = ERGO_SUM_PERKS.TRAITS.find(t => 
                                plugNames.includes(t) || plugNames.some((n: string) => n?.includes(t))
                            );

                            return (
                                <div
                                    key={item.itemInstanceId}
                                    className="p-3 bg-black/30 border border-white/10 hover:border-destiny-gold/50 transition-all"
                                >
                                    <div className="text-xs font-semibold text-slate-300 mb-1">
                                        {frame || 'Unknown Frame'}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {trait || 'Unknown Trait'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {ergoSumItems.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    <Swords className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No Ergo Sum swords found in your inventory</p>
                </div>
            )}
        </div>
    );
}

