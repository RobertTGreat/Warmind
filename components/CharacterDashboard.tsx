'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { DestinyItemCard } from '@/components/DestinyItemCard';
import { CharacterHeader } from '@/components/CharacterHeader';
import { LoadoutButton } from '@/components/LoadoutButton';
import { getBungieImage } from '@/lib/bungie';

// Reusing from page or defining locally
const CLASS_ICONS: Record<number, string> = {
    0: '/class-titan.svg',
    1: '/class-hunter.svg',
    2: '/class-warlock.svg',
};

const CLASS_NAMES: Record<number, string> = {
    0: 'Titan',
    1: 'Hunter',
    2: 'Warlock',
};

interface CharacterDashboardProps {
    characters: any[];
    activeCharacterId: string;
    onCharacterSelect: (id: string) => void;
    loadouts: any[];
    postmasterItems: any[];
    engrams: any[];
    currencies: {
        glimmer: number;
        brightDust: number;
        cores: number;
        prisms: number;
        shards: number;
        alloys: number;
        strangeCoins: number;
    };
    currencyDefs: Record<number, any>;
    profile: any;
    membershipInfo: any;
    iconSize: 'small' | 'medium' | 'large';
}

export function CharacterDashboard({
    characters,
    activeCharacterId,
    onCharacterSelect,
    loadouts,
    postmasterItems,
    engrams,
    currencies,
    currencyDefs,
    profile,
    membershipInfo,
    iconSize
}: CharacterDashboardProps) {

    const activeCharacter = useMemo(() =>
        characters.find(c => c.characterId === activeCharacterId),
        [characters, activeCharacterId]);

    const otherCharacters = useMemo(() =>
        characters.filter(c => c.characterId !== activeCharacterId),
        [characters, activeCharacterId]);

    // Currency Icons helper
    const getCurrencyIcon = (hash: number) => currencyDefs[hash]?.displayProperties?.icon;

    // Hardcoded hashes for lookup - matched with page.tsx
    const CURRENCY_HASHES = {
        GLIMMER: 3159615086,
        BRIGHT_DUST: 2817410917,
        CORES: 3853748946,
        PRISMS: 4257549984,
        SHARDS: 4257549985,
        ALLOYS: 2979281381,
        STRANGE_COINS: 1877894319 // This is one of them, page.tsx handles logic
    };

    return (
        <div className="w-full bg-[#0f1115] border-b border-white/10 p-4 flex gap-6 overflow-x-auto custom-scrollbar shrink-0 h-[220px]">
            {/* 1. Character Selection Section */}
            <div className="flex gap-2 shrink-0 h-full">
                {/* Selected Character - Large Card */}
                <div className="w-26 h-full border border-white/10 overflow-hidden relative group">
                    {activeCharacter && (
                        <div className="w-full h-full relative">
                            <CharacterHeader
                                character={{
                                    characterId: activeCharacter.characterId,
                                    classType: activeCharacter.classType,
                                    light: activeCharacter.light,
                                    emblemBackgroundPath: activeCharacter.emblemBackgroundPath,
                                    titleRecordHash: activeCharacter.titleRecordHash,
                                }}
                            // Force full height/width styling within wrapper if needed, 
                            // but CharacterHeader has fixed h-[72px]. We might need to override or just containerize it.
                            // The User asked for "like on the vault screen", which is the header strip.
                            // Let's place it at top and maybe fill rest with stats or just center it?
                            // Actually, let's just let it be the card.
                            />
                            {/* Add extra stats or visuals here if 'like Vault screen' just meant the header component */}
                            <div className="absolute bottom-2 left-2 text-xs text-slate-400">
                                {/* Maybe playtime or stats? */}
                                Last Played: {new Date(activeCharacter.dateLastPlayed).toLocaleDateString()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Other Characters - Vertical Icons */}
                <div className="flex flex-col gap-2 h-full justify-center">
                    {otherCharacters.map(char => (
                        <button
                            key={char.characterId}
                            onClick={() => onCharacterSelect(char.characterId)}
                            className="w-16 h-16 relative border border-white/10 bg-slate-900/50 hover:border-destiny-gold/50 transition-all overflow-hidden group"
                            title={`Switch to ${CLASS_NAMES[char.classType]}`}
                        >
                            <Image
                                src={CLASS_ICONS[char.classType]}
                                fill
                                className="object-contain p-2 opacity-50 group-hover:opacity-100 transition-opacity"
                                alt={CLASS_NAMES[char.classType]}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-white/5 h-full shrink-0" />

            {/* 2. Loadouts (2 Rows) */}
            <div className="flex flex-col gap-1 w-[280px] shrink-0">
                <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1">Loadouts</h3>
                <div className="grid grid-cols-5 gap-1.5 flex-1 content-start overflow-y-auto pr-1">
                    {loadouts.length > 0 ? loadouts.map((loadout, i) => (
                        <div key={i} className="aspect-square">
                            <LoadoutButton
                                loadout={loadout}
                                index={i}
                                activeCharacterId={activeCharacterId}
                                membershipInfo={membershipInfo}
                                profile={profile}
                            // Add a 'compact' or 'iconOnly' prop to LoadoutButton if it supports it, 
                            // otherwise we might need to style it via wrapper or CSS.
                            // Assuming specific styling is handled in LoadoutButton or we constrain it here.
                            />
                        </div>
                    )) : (
                        <div className="col-span-4 text-xs text-slate-600 italic p-2">No Loadouts</div>
                    )}
                </div>
            </div>

            {/* 3. Postmaster */}
            <div className="flex flex-col gap-1 w-[220px] shrink-0">
                <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1">Postmaster ({postmasterItems.length})</h3>
                <div className="grid grid-cols-5 gap-1 flex-1 content-start overflow-y-auto pr-1 custom-scrollbar">
                    {Array.from({ length: 21 }).map((_, i) => {
                        const item = postmasterItems[i];
                        return (
                            <div key={i} className="aspect-square bg-slate-800/20 border border-white/5 overflow-hidden relative">
                                {item && (
                                    <DestinyItemCard
                                        itemHash={item.itemHash}
                                        itemInstanceId={item.itemInstanceId}
                                        instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                        size="small" // Force small
                                        hideBorder
                                        hidePower
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4. Engrams */}
            <div className="flex flex-col gap-1 w-[180px] shrink-0">
                <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1">Engrams ({engrams.length})</h3>
                <div className="flex flex-wrap gap-1 content-start">
                    {Array.from({ length: 10 }).map((_, i) => {
                        const item = engrams[i];
                        return (
                            <div key={i} className="w-8 h-8 rounded-full border border-white/10 bg-slate-800/20 overflow-hidden flex items-center justify-center">
                                {item ? (
                                    <DestinyItemCard
                                        itemHash={item.itemHash}
                                        itemInstanceId={item.itemInstanceId}
                                        instanceData={profile.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                        size="small"
                                        hideBorder
                                        hidePower
                                    />
                                ) : (
                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 5. Currencies (Compact) */}
            <div className="flex flex-col gap-1 flex-1 min-w-[120px] overflow-y-auto">
                <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1 sticky top-0 bg-[#0f1115]">Currencies</h3>
                <div className="grid grid-cols-1 gap-1">
                    {[
                        { val: currencies.glimmer, icon: getCurrencyIcon(CURRENCY_HASHES.GLIMMER) },
                        { val: currencies.brightDust, icon: getCurrencyIcon(CURRENCY_HASHES.BRIGHT_DUST) },
                        { val: currencies.cores, icon: getCurrencyIcon(CURRENCY_HASHES.CORES) },
                        { val: currencies.prisms, icon: getCurrencyIcon(CURRENCY_HASHES.PRISMS) },
                        { val: currencies.shards, icon: getCurrencyIcon(CURRENCY_HASHES.SHARDS) },
                        { val: currencies.alloys, icon: getCurrencyIcon(CURRENCY_HASHES.ALLOYS) },
                        { val: currencies.strangeCoins, icon: currencyDefs[CURRENCY_HASHES.STRANGE_COINS]?.displayProperties?.icon || '/icons/strange_coin.png' } // Fallback or logic handled in parent usually
                    ].map((curr, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-white/5 border border-white/5">
                            {curr.icon && <Image src={getBungieImage(curr.icon)} width={16} height={16} alt="" className="object-contain" />}
                            <span className="text-xs font-medium text-slate-300">{curr.val.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
