import Image from "next/image";
import { FrostedCard } from "@/components/FrostedCard";
import { bungieApi, endpoints, getBungieImage as getImg } from "@/lib/bungie";
import { useSettingsStore } from "@/store/settingsStore";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import useSWR from "swr";
import { ScrollingText } from "@/components/ScrollingText";

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

export interface MemberStats {
    power: number;
    guardianRank: number;
    emblemPath: string;
}

const SPECIAL_TAGS: Record<string, { label: string, className: string }[]> = {
    "RobertTheGreat#437": [
        { label: "Murder Cave", className: "bg-red-900/40 text-red-200 border-red-500/50" },
        { label: "Dev", className: "bg-destiny-gold/20 text-destiny-gold border-destiny-gold/50" }],
    "Cavez#4930": [
        { label: "Murder Cave", className: "bg-red-900/40 text-red-200 border-red-500/50" },
        { label: "Saltagreppo Glazer", className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/50" }
    ]
};

export function ClanMemberCard({ member, isOnline, preloadedStats }: { member: any, isOnline: boolean, preloadedStats?: MemberStats }) {
    const user = member.destinyUserInfo;
    const { favoriteMembers, toggleFavoriteMember } = useSettingsStore();
    
    const fullBungieName = `${user.bungieGlobalDisplayName}#${user.bungieGlobalDisplayNameCode}`;
    const specialTags = SPECIAL_TAGS[fullBungieName];

    const isFavorite = favoriteMembers.includes(user.membershipId);
    
    // Fetch minimal profile data (100 = Profile, 200 = Characters)
    // Only fetch if we don't have preloadedStats
    const { data: profileData, isLoading: profileLoading } = useSWR(
        !preloadedStats ? endpoints.getProfile(user.membershipType, user.membershipId, [100, 200]) : null,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000 // Cache for 1 minute
        }
    );

    let power = preloadedStats?.power;
    let guardianRank = preloadedStats?.guardianRank;
    let emblemPath = preloadedStats?.emblemPath;

    if (!preloadedStats && profileData) {
        const profile = profileData.Response;
        const characters = profile?.characters?.data;
        guardianRank = profile?.profile?.data?.currentGuardianRank;

        // Get most recently played character
        const lastPlayedCharacterId = characters 
            ? Object.keys(characters).sort((a, b) => {
                return new Date(characters[b].dateLastPlayed).getTime() - new Date(characters[a].dateLastPlayed).getTime();
            })[0]
            : null;
        
        const character = lastPlayedCharacterId ? characters[lastPlayedCharacterId] : null;
        emblemPath = character?.emblemPath;
        power = character?.light;
    }

    const isLoading = !preloadedStats && profileLoading;

    // Fallback to user icon if profile/emblem fails
    const displayIcon = emblemPath ? getImg(emblemPath) : getImg(user.iconPath);

    return (
        <FrostedCard className="group relative flex items-center gap-0 p-0 hover:bg-gray-800/40 transition-colors overflow-hidden h-20" hover>
            {/* Hover Ambient Glow */}
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                 <Image 
                    src={displayIcon} 
                    alt="" 
                    fill 
                    className="object-cover blur-3xl scale-[2] opacity-50" 
                />
            </div>

            {/* Emblem / Icon Section */}
            <div className="w-20 h-20 relative flex-shrink-0 bg-black z-10">
                {isLoading ? (
                    <div className="w-full h-full bg-slate-800 animate-pulse" />
                ) : (
                    <Image 
                        src={displayIcon} 
                        alt="Icon" 
                        fill 
                        sizes="80px"
                        className={cn(
                            "object-cover transition-all duration-300",
                            isOnline ? "opacity-100" : "opacity-50 grayscale group-hover:opacity-100 group-hover:grayscale-0"
                        )} 
                    />
                )}
                {isOnline && <div className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 border-2 border-black rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)]" />}
            </div>

            {/* Info Section */}
            <div className="flex-1 px-4 py-2 flex flex-col justify-center relative z-10 overflow-hidden">
                <div className="flex items-baseline gap-2 overflow-hidden">
                    <ScrollingText className="font-bold text-white text-base">
                        {user.bungieGlobalDisplayName || user.displayName}
                    </ScrollingText>
                    {user.bungieGlobalDisplayNameCode && (
                        <span className="text-xs text-destiny-gold opacity-70">#{user.bungieGlobalDisplayNameCode}</span>
                    )}
                    
                    {specialTags && specialTags.map((tag) => (
                        <span key={tag.label} className={cn("ml-2 text-[10px] px-1.5 py-0.5 rounded border font-bold tracking-wide uppercase whitespace-nowrap", tag.className)}>
                            {tag.label}
                        </span>
                    ))}
                </div>
                
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                     {guardianRank !== undefined && guardianRank > 0 && (
                        <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/10" title={`Guardian Rank ${guardianRank}`}>
                            <span className="w-2 h-2 rounded-full bg-destiny-gold/80" />
                            <span className="font-mono text-white font-bold">{guardianRank}</span>
                        </div>
                    )}
                    
                    {power !== undefined && (
                        <div className="text-destiny-gold font-bold flex items-center gap-1" title="Power Level">
                           <span>✧</span> {power}
                        </div>
                    )}

                    {!power && !guardianRank && (
                         <span className={cn(
                            "font-medium uppercase tracking-wider",
                            member.memberType === 5 ? "text-destiny-gold" : 
                            member.memberType === 3 ? "text-white" : "text-slate-500"
                        )}>
                            {member.memberType === 5 ? 'Founder' : member.memberType === 3 ? 'Admin' : 'Member'}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="pr-4 pl-2 flex flex-col items-end justify-center gap-1 relative z-10">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteMember(user.membershipId);
                    }}
                    className={cn(
                        "p-2 rounded-full hover:bg-white/10 transition-colors",
                        isFavorite ? "text-destiny-gold" : "text-slate-600 hover:text-slate-300"
                    )}
                >
                    <Star className={cn("w-4 h-4", isFavorite && "fill-current")} />
                </button>
            </div>
            
            {/* Decorative Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none z-0" />
        </FrostedCard>
    );
}
