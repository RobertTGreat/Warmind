'use client';

import Image from 'next/image';
import { getBungieImage } from '@/lib/bungie';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

// Class icons
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


interface CharacterHeaderProps {
    character: {
        characterId: string;
        classType: number;
        light: number;
        emblemBackgroundPath: string;
        titleRecordHash?: number;
    };
    isHidden?: boolean;
    onToggleVisibility?: () => void;
}

export function CharacterHeader({ 
    character, 
    isHidden = false, 
    onToggleVisibility 
}: CharacterHeaderProps) {
    // Fetch title definition if character has an equipped title
    const { data: titleDefData } = useSWR(
        character.titleRecordHash ? endpoints.getRecordDefinition(character.titleRecordHash) : null,
        fetcher
    );
    
    const titleDef = titleDefData?.Response;
    const titleName = titleDef?.titleInfo?.titlesByGender?.Male || titleDef?.titleInfo?.titlesByGenderHash?.Male || null;
    
    return (
        <div 
            className={cn(
                "relative overflow-hidden transition-all cursor-pointer group h-[72px]",
                isHidden && "opacity-30 grayscale"
            )}
            onClick={onToggleVisibility}
            title={`Click to ${isHidden ? 'show' : 'hide'} ${CLASS_NAMES[character.classType]}`}
        >
            {/* Emblem Background */}
            <div className="absolute inset-0">
                <Image
                    src={getBungieImage(character.emblemBackgroundPath)}
                    fill
                    sizes="400px"
                    className="object-cover"
                    alt=""
                    priority
                />
                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
            </div>
            
            {/* Content */}
            <div className="relative z-10 flex flex-col justify-center h-full p-3">
                {/* Top Row: Class & Power */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {/* Class Icon */}
                        <div className="relative w-7 h-7 shrink-0">
                            <Image
                                src={CLASS_ICONS[character.classType]}
                                width={28}
                                height={28}
                                className="object-contain drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]"
                                alt=""
                            />
                        </div>
                        
                        {/* Class Name */}
                        <span className="font-bold text-white text-base tracking-wide uppercase drop-shadow-md">
                            {CLASS_NAMES[character.classType]}
                        </span>
                    </div>
                    
                    {/* Power Level */}
                    <div className="flex items-center gap-1">
                        <span className="text-destiny-gold text-xl">✦</span>
                        <span className="text-destiny-gold font-bold text-xl tabular-nums">
                            {character.light}
                        </span>
                    </div>
                </div>
                
                {/* Title (if equipped) */}
                {titleName && (
                    <div className="mt-1">
                        <span className="text-xs font-semibold uppercase tracking-widest text-purple-300 drop-shadow-md">
                            {titleName}
                        </span>
                    </div>
                )}
            </div>
            
            {/* Hover Overlay */}
            <div className={cn(
                "absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            )} />
        </div>
    );
}

