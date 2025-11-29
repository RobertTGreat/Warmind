'use client';

import { PageHeader } from "@/components/PageHeader";
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { bungieApi, endpoints, getBungieImage as getImg } from "@/lib/bungie";
import useSWR from "swr";
import { Loader2, Shield, Users, Search, Star, Calendar, Info, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { cn } from "@/lib/utils";
import { ClanMemberCard, MemberStats } from "@/components/ClanMemberCard";

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

type SortOption = 'joined_desc' | 'joined_asc' | 'name_asc' | 'rank_desc' | 'online' | 'power_desc' | 'guardian_rank_desc';

const ITEMS_PER_PAGE = 12;

export function ClanBrowser() {
  const { membershipInfo, isLoggedIn } = useDestinyProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('online');
  const [currentPage, setCurrentPage] = useState(1);
  const { favoriteMembers, toggleFavoriteMember } = useSettingsStore();
  const [memberStats, setMemberStats] = useState<Record<string, MemberStats>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, showFavoritesOnly, sortBy]);

  // 1. Get Clan Info for User
  const { data: groupsData, isLoading: groupsLoading } = useSWR(
    membershipInfo ? endpoints.getGroupsForMember(membershipInfo.membershipType, membershipInfo.membershipId) : null,
    fetcher
  );

  const group = groupsData?.Response?.results?.[0]?.group;
  const groupId = group?.groupId;


  // 2. Get Clan Members
  const { data: membersData, isLoading: membersLoading } = useSWR(
    groupId ? endpoints.getMembersOfGroup(groupId) : null,
    fetcher
  );

  const members = membersData?.Response?.results;

  // Fetch stats logic
  useEffect(() => {
      if (!members || members.length === 0) return;

      const fetchStats = async () => {
          setIsLoadingStats(true);
          
          // Filter members we don't have stats for yet
          const membersToFetch = members.filter((m: any) => !memberStats[m.destinyUserInfo.membershipId]);
          
          // Simple chunking to avoid rate limits (5 concurrent requests)
          const CHUNK_SIZE = 5;
          for (let i = 0; i < membersToFetch.length; i += CHUNK_SIZE) {
              const chunk = membersToFetch.slice(i, i + CHUNK_SIZE);
              
              await Promise.all(chunk.map(async (member: any) => {
                  const user = member.destinyUserInfo;
                  try {
                      const res = await bungieApi.get(
                          endpoints.getProfile(user.membershipType, user.membershipId, [100, 200])
                      );
                      const profile = res.data.Response;
                      const characters = profile?.characters?.data;
                      const guardianRank = profile?.profile?.data?.currentGuardianRank || 0;
                      
                      // Get most recently played character
                      const lastPlayedCharacterId = characters 
                        ? Object.keys(characters).sort((a, b) => {
                            return new Date(characters[b].dateLastPlayed).getTime() - new Date(characters[a].dateLastPlayed).getTime();
                        })[0]
                        : null;
                    
                      const character = lastPlayedCharacterId ? characters[lastPlayedCharacterId] : null;
                      
                      if (character) {
                          setMemberStats(prev => ({
                              ...prev,
                              [user.membershipId]: {
                                  power: character.light,
                                  guardianRank: guardianRank,
                                  emblemPath: character.emblemPath
                              }
                          }));
                      }
                  } catch {
                      // Expected for private profiles, inactive accounts, or cross-save issues
                      // Mark as attempted so we don't retry
                      setMemberStats(prev => ({
                          ...prev,
                          [user.membershipId]: { power: 0, guardianRank: 0, emblemPath: '' }
                      }));
                  }
              }));
              
              // Small delay between chunks to be nice to API
              await new Promise(resolve => setTimeout(resolve, 100));
          }
          setIsLoadingStats(false);
      };

      // Trigger fetch
      fetchStats();
      
  }, [members]); // Run when members list loads

  const filteredAndSortedMembers = members
    ?.filter((member: any) => {
      const user = member.destinyUserInfo;
      const name = user.bungieGlobalDisplayName || user.displayName || "";
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      const isFavorite = favoriteMembers.includes(user.membershipId);
      
      if (showFavoritesOnly && !isFavorite) return false;
      return matchesSearch;
    })
    ?.sort((a: any, b: any) => {
        const idA = a.destinyUserInfo.membershipId;
        const idB = b.destinyUserInfo.membershipId;
        const statsA = memberStats[idA];
        const statsB = memberStats[idB];

        switch (sortBy) {
            case 'name_asc':
                const nameA = a.destinyUserInfo.bungieGlobalDisplayName || a.destinyUserInfo.displayName;
                const nameB = b.destinyUserInfo.bungieGlobalDisplayName || b.destinyUserInfo.displayName;
                return nameA.localeCompare(nameB);
            case 'rank_desc':
                return b.memberType - a.memberType;
            case 'joined_asc':
                return new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime();
            case 'joined_desc':
                return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
            case 'power_desc':
                return (statsB?.power || 0) - (statsA?.power || 0);
            case 'guardian_rank_desc':
                return (statsB?.guardianRank || 0) - (statsA?.guardianRank || 0);
            case 'online':
            default:
                // Sort by online first, then by join date (newest first)
                if (a.isOnline !== b.isOnline) return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
                return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
        }
    });

  // Pagination Logic
  const totalItems = filteredAndSortedMembers?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMembers = filteredAndSortedMembers?.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (!isLoggedIn) return <div className="p-8 text-center text-slate-400">Please login to view clan.</div>;
  if (groupsLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;

  if (!group) {
      return (
          <div className="p-8 text-center">
              <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl text-white font-bold">No Clan Found</h2>
              <p className="text-slate-400">You are not currently in a clan.</p>
          </div>
      );
  }


  return (
    <div className="space-y-4">
      {/* Controls & Roster */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                    <Shield className="w-5 h-5 text-destiny-gold" />
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider">Clan Roster</h2>
                </div>
                {isLoadingStats && (
                    <div className="flex items-center gap-2 text-xs text-destiny-gold animate-pulse bg-destiny-gold/10 px-2 py-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading Stats...</span>
                    </div>
                )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <div className="relative flex-1 sm:w-56 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900/50 border border-white/10 py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-destiny-gold/50"
                    />
                </div>

                <div className="relative">
                     <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="appearance-none bg-gray-900/50 border border-white/10 py-2 pl-9 pr-8 text-sm text-white focus:outline-none focus:border-destiny-gold/50 cursor-pointer min-w-[120px]"
                     >
                         <option value="online">Online</option>
                         <option value="power_desc">Power</option>
                         <option value="guardian_rank_desc">Rank</option>
                         <option value="name_asc">Name</option>
                     </select>
                </div>

                <button 
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={cn(
                        "p-2 border border-white/10 transition-colors",
                        showFavoritesOnly ? "bg-destiny-gold/20 border-destiny-gold/50 text-destiny-gold" : "bg-gray-900/50 text-slate-400 hover:text-white"
                    )}
                    title="Toggle Favorites Only"
                >
                    <Star className={cn("w-5 h-5", showFavoritesOnly && "fill-current")} />
                </button>
            </div>
        </div>

        {/* Members Grid */}
        {membersLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-destiny-gold w-8 h-8" /></div>
        ) : filteredAndSortedMembers?.length === 0 ? (
             <div className="text-center py-12 text-slate-500">
                 No guardians found.
             </div>
        ) : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {paginatedMembers?.map((member: any) => {
                        const user = member.destinyUserInfo;
                        // Use preloaded stats if available
                        const stats = memberStats[user.membershipId];
                        
                        return (
                            <ClanMemberCard 
                                key={user.membershipId} 
                                member={member} 
                                isOnline={member.isOnline} 
                                preloadedStats={stats}
                            />
                        );
                    })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 pt-8">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 hover:scale-120 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        
                        <div className="text-sm text-slate-400">
                            Page <span className="text-destiny-gold font-bold">{currentPage}</span> of <span className="text-white">{totalPages}</span>
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 hover:scale-120 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:cursor-pointer"
                        >
                            <ChevronRight className="w-5 h-5 text-white" />
                        </button>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}

