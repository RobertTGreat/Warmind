import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';

export interface SearchUserResult {
    bungieGlobalDisplayName: string;
    bungieGlobalDisplayNameCode: number;
    membershipId: string;
    membershipType: number;
    displayName: string;
    bungieNetMembershipId?: string;
}

export function useUserSearch(query: string) {
    const fetcher = async () => {
        try {
            // Try GlobalName search first (supports partial matching)
            const response = await bungieApi.post(
                endpoints.searchUsers('', 0),
                {
                    displayNamePrefix: query
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('GlobalName search response:', response.data);
            
            if (response.data?.ErrorCode === 1) {
                const searchResults = response.data?.Response?.searchResults || [];
                if (searchResults.length > 0) {
                    return {
                        Response: {
                            searchResults: searchResults.map((result: any) => {
                                // Handle different response structures
                                const destinyMembership = result.destinyMemberships?.[0] || result;
                                return {
                                    bungieGlobalDisplayName: result.bungieGlobalDisplayName || result.displayName || destinyMembership.displayName,
                                    bungieGlobalDisplayNameCode: result.bungieGlobalDisplayNameCode || 0,
                                    membershipId: destinyMembership.membershipId || result.membershipId,
                                    membershipType: destinyMembership.membershipType || result.membershipType,
                                    displayName: result.displayName || result.bungieGlobalDisplayName || destinyMembership.displayName,
                                    bungieNetMembershipId: result.bungieNetMembershipId
                                };
                            })
                        },
                        ErrorCode: 1
                    };
                }
            }
            
            console.log('GlobalName search returned no results or error, trying fallback');

            // If GlobalName search fails or returns no results, fall back to SearchDestinyPlayer
            // This requires exact match but works as a fallback
            const platforms = [1, 2, 3]; // Xbox, PlayStation, Steam
            const results: SearchUserResult[] = [];
            
            const searchPromises = platforms.map(async (platform) => {
                try {
                    const playerResponse = await bungieApi.get(endpoints.searchDestinyPlayer(platform, query));
                    if (playerResponse.data?.Response && Array.isArray(playerResponse.data.Response) && playerResponse.data.Response.length > 0) {
                        return playerResponse.data.Response.map((player: any) => ({
                            bungieGlobalDisplayName: player.bungieGlobalDisplayName || player.displayName,
                            bungieGlobalDisplayNameCode: player.bungieGlobalDisplayNameCode || 0,
                            membershipId: player.membershipId,
                            membershipType: player.membershipType,
                            displayName: player.displayName,
                            bungieNetMembershipId: player.bungieNetMembershipId
                        }));
                    }
                } catch (e: any) {
                    // Platform might not have the player, continue
                }
                return [];
            });

            const platformResults = await Promise.all(searchPromises);
            const allResults = platformResults.flat();
            
            // Deduplicate by membershipId and membershipType
            const uniqueResults = Array.from(
                new Map(
                    allResults.map((r) => [`${r.membershipType}-${r.membershipId}`, r])
                ).values()
            );

            return {
                Response: {
                    searchResults: uniqueResults
                },
                ErrorCode: 1
            };
        } catch (error: any) {
            console.error('User search error:', error);
            console.error('Error response:', error.response?.data);
            throw error;
        }
    };

    const { data, error, isLoading } = useSWR(
        query && query.length >= 3 ? `user-search-${query}` : null,
        fetcher,
        { 
            revalidateOnFocus: false,
            onError: (err) => {
                console.error('SWR error in user search:', err);
            }
        }
    );

    const results: SearchUserResult[] = data?.Response?.searchResults || [];

    return {
        results,
        isLoading,
        isError: error,
    };
}

