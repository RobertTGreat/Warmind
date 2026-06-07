import { useQuery } from '@tanstack/react-query';
import { bungieApi, endpoints } from '@/lib/bungie';

export interface SearchUserResult {
    bungieGlobalDisplayName: string;
    bungieGlobalDisplayNameCode: number;
    membershipId: string;
    membershipType: number;
    displayName: string;
    bungieNetMembershipId?: string;
}

export async function searchUsers(query: string) {
    const trimmedQuery = query.trim();
    const [queryName, queryCode] = parseBungieName(trimmedQuery);
    const displayNamePrefix = queryName || trimmedQuery;

    try {
        // Try GlobalName search first (supports partial matching)
        const response = await bungieApi.post(
            endpoints.searchUsers('', 0),
            {
                displayNamePrefix
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data?.ErrorCode === 1) {
            const searchResults = response.data?.Response?.searchResults || [];
            if (searchResults.length > 0) {
                return filterSearchResultsByCode(
                    searchResults.map((result: any) => {
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
                    }),
                    queryCode
                );
            }
        }

        // If GlobalName search fails or returns no results, fall back to SearchDestinyPlayer.
        // This requires exact match but works as a fallback.
        const platforms = [1, 2, 3]; // Xbox, PlayStation, Steam

        const searchPromises = platforms.map(async (platform) => {
            try {
                const playerResponse = await bungieApi.get(endpoints.searchDestinyPlayer(platform, displayNamePrefix));
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
                // Platform might not have the player, continue.
            }
            return [];
        });

        const platformResults = await Promise.all(searchPromises);
        const allResults = filterSearchResultsByCode(platformResults.flat(), queryCode);

        return Array.from(
            new Map(
                allResults.map((result) => [`${result.membershipType}-${result.membershipId}`, result])
            ).values()
        );
    } catch (error: any) {
        console.error('User search error:', error);
        console.error('Error response:', error.response?.data);
        throw error;
    }
}

function parseBungieName(query: string): [string, number | null] {
    const match = query.match(/^(.+?)#(\d{1,4})$/);

    if (!match) {
        return [query, null];
    }

    return [match[1].trim(), Number(match[2])];
}

function filterSearchResultsByCode(
    results: SearchUserResult[],
    displayNameCode: number | null
): SearchUserResult[] {
    if (!displayNameCode) {
        return results;
    }

    return results.filter((result) => result.bungieGlobalDisplayNameCode === displayNameCode);
}

export function useUserSearch(query: string) {
    const normalizedQuery = query.trim();
    const { data, error, isLoading } = useQuery({
        queryKey: ['userSearch', normalizedQuery],
        queryFn: async () => {
            const searchResults = await searchUsers(normalizedQuery);

            return {
                Response: {
                    searchResults,
                },
                ErrorCode: 1
            };
        },
        enabled: normalizedQuery.length >= 3,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const results: SearchUserResult[] = data?.Response?.searchResults || [];

    return {
        results,
        isLoading,
        isError: error,
    };
}

