import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { Loader2, Users, Shield, Star } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { FrostedCard } from './FrostedCard';
import { ScrollingText } from '@/components/ScrollingText';
import { useSettingsStore } from '@/store/settingsStore';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface FireteamMember {
    membershipId: string;
    emblemPath?: string;
    displayName?: string;
    displayNameCode?: string;
    light?: number;
    guardianRank?: number;
    classType?: number;
    isOnline?: boolean;
    memberType?: number; // For consistency if needed
}

// Reusing styles from ClanMemberCard slightly modified for Fireteam context
export function FireteamList() {
    const { membershipInfo } = useDestinyProfileContext();
    const [members, setMembers] = useState<FireteamMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const { favoriteMembers, toggleFavoriteMember } = useSettingsStore();

    // 1. Get Transitory Data (Component 1000)
    const { data: profileData, isLoading: profileLoading } = useSWR(
        membershipInfo 
            ? endpoints.getProfile(membershipInfo.membershipType, membershipInfo.membershipId, [1000]) 
            : null,
        fetcher,
        { refreshInterval: 30000 } // Refresh every 30s
    );

    const transitoryData = profileData?.Response?.profileTransitoryData?.data;
    const partyMembers = transitoryData?.partyMembers;
    const partyMemberIds = useMemo(() => {
        return (partyMembers ?? [])
            .map((member: any) => member.membershipId)
            .sort()
            .join(',');
    }, [partyMembers]);

    // 2. Fetch Details for Party Members
    useEffect(() => {
        if (!partyMemberIds) {
            setMembers([]);
            return;
        }

        let cancelled = false;

        const fetchMemberDetails = async () => {
            setIsLoadingMembers(true);
            const details: FireteamMember[] = [];

            // Fetch in parallel
            await Promise.all((partyMembers ?? []).map(async (member: any) => {
                try {
                    // First, look up the member's actual memberships using BungieNext type (254)
                    // This handles cross-platform players
                    const membershipRes = await bungieApi.get(
                        `/User/GetMembershipsById/${member.membershipId}/254/`
                    );
                    
                    const membershipData = membershipRes.data.Response;
                    if (!membershipData?.destinyMemberships?.length) {
                        throw new Error('No destiny memberships found');
                    }
                    
                    // Get the primary or most recently played membership
                    // Prefer the one with cross-save override, otherwise take the first one
                    const destinyMembership = membershipData.primaryMembershipId 
                        ? membershipData.destinyMemberships.find((m: any) => m.membershipId === membershipData.primaryMembershipId) || membershipData.destinyMemberships[0]
                        : membershipData.destinyMemberships[0];
                    
                    // Now fetch their Destiny profile with the correct membership type
                    const res = await bungieApi.get(
                        endpoints.getProfile(destinyMembership.membershipType, destinyMembership.membershipId, [100, 200])
                    );
                    
                    const p = res.data.Response;
                    if (!p) throw new Error('No profile data');

                    const profile = p.profile.data;
                    const characters = p.characters.data;
                    
                    // Get active character
                    const lastPlayedCharacterId = characters 
                        ? Object.keys(characters).sort((a, b) => {
                            return new Date(characters[b].dateLastPlayed).getTime() - new Date(characters[a].dateLastPlayed).getTime();
                        })[0]
                        : null;
                    const char = lastPlayedCharacterId ? characters[lastPlayedCharacterId] : null;

                    details.push({
                        membershipId: member.membershipId,
                        displayName: profile.userInfo.bungieGlobalDisplayName || profile.userInfo.displayName,
                        displayNameCode: profile.userInfo.bungieGlobalDisplayNameCode,
                        emblemPath: char?.emblemPath,
                        light: char?.light,
                        guardianRank: profile.currentGuardianRank,
                        classType: char?.classType,
                        isOnline: true // They are in fireteam
                    });

                } catch (e) {
                    console.error(`Failed to load member ${member.membershipId}`, e);
                    // Use the displayName from partyMembers if available
                    details.push({
                        membershipId: member.membershipId,
                        displayName: member.displayName || "Unknown Guardian",
                        isOnline: true
                    });
                }
            }));

            if (!cancelled) {
                setMembers(details);
                setIsLoadingMembers(false);
            }
        };

        fetchMemberDetails();

        return () => {
            cancelled = true;
        };
    }, [partyMemberIds, membershipInfo?.membershipId, membershipInfo?.membershipType]);

    if (!membershipInfo) return null;

    return (
        <div className="space-y-4 h-full">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 h-[37px] box-border"> {/* Matched height with clan header */}
                <Users className="w-5 h-5 text-destiny-gold" />
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Fireteam</h2>
                {partyMembers && (
                    <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5">
                        {partyMembers.length} / {transitoryData?.partyMembers?.length || 0}
                    </span>
                )}
            </div>

            <div className="space-y-3"> {/* Matched gap-3 from Clan Grid */}
                {profileLoading || isLoadingMembers ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-destiny-gold" />
                    </div>
                ) : members.length > 0 ? (
                    members.map(member => {
                        const displayIcon = member.emblemPath ? getBungieImage(member.emblemPath) : null;
                        const isFavorite = favoriteMembers.includes(member.membershipId);

                        // Exact same structure as ClanMemberCard
                        return (
                            <FrostedCard key={member.membershipId} className="group relative flex items-center gap-0 p-0 hover:bg-gray-800/40 transition-colors overflow-hidden h-20" hover>
                                {/* Hover Ambient Glow */}
                                <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                                    {displayIcon && (
                                        <Image 
                                            src={displayIcon} 
                                            alt="" 
                                            fill 
                                            className="object-cover blur-3xl scale-[2] opacity-50" 
                                        />
                                    )}
                                </div>

                                {/* Emblem / Icon Section */}
                                <div className="w-20 h-20 relative shrink-0 bg-black z-10">
                                    {displayIcon ? (
                                        <Image 
                                            src={displayIcon} 
                                            alt="Icon" 
                                            fill 
                                            sizes="80px"
                                            className="object-cover transition-all duration-300 opacity-100" 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                            <Shield className="w-8 h-8 text-slate-600" />
                                        </div>
                                    )}
                                    {/* Online Indicator - Always Green for Fireteam */}
                                    <div className="absolute bottom-1 right-1 w-3 h-3 bg-green-500 border-2 border-black rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                                </div>

                                {/* Info Section */}
                                <div className="flex-1 px-4 py-2 flex flex-col justify-center relative z-10 overflow-hidden">
                                    <div className="flex items-baseline gap-2 overflow-hidden">
                                        <ScrollingText className="min-w-0 flex-1 font-bold text-white text-base">
                                            {member.displayName}
                                        </ScrollingText>
                                        {member.displayNameCode && (
                                            <span className="text-xs text-destiny-gold opacity-70">#{member.displayNameCode}</span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                        {member.guardianRank !== undefined && member.guardianRank > 0 && (
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 border border-white/10" title={`Guardian Rank ${member.guardianRank}`}>
                                                <span className="w-2 h-2 rounded-full bg-destiny-gold/80" />
                                                <span className="font-mono text-white font-bold">{member.guardianRank}</span>
                                            </div>
                                        )}
                                        
                                        {member.light !== undefined && (
                                            <div className="text-destiny-gold font-bold flex items-center gap-1" title="Power Level">
                                            <span>✧</span> {member.light}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="pr-4 pl-2 flex flex-col items-end justify-center gap-1 relative z-10">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavoriteMember(member.membershipId);
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
                                <div className="absolute inset-0 bg-linear-to-r from-black/60 via-transparent to-transparent pointer-events-none z-0" />
                            </FrostedCard>
                        );
                    })
                ) : (
                    <div className="p-4 text-center border border-dashed border-white/10 h-20 flex items-center justify-center">
                        <div className="text-slate-500 text-sm">No Fireteam Detected</div>
                    </div>
                )}
            </div>
        </div>
    );
}
