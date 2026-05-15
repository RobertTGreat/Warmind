import useSWR from 'swr';
import { getActivityHistory } from '@/lib/bungie';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { useState, useEffect, useCallback } from 'react';
import { getCachedHistory, setCachedHistory, clearCache, getInvalidInstanceIds } from '@/lib/activityCache';

export interface ActivityHistoryItem {
    activityDetails: {
        referenceId: number;
        instanceId: string;
        mode: number;
    };
    values: {
        completed: { basic: { value: number; displayValue: string } };
        kills: { basic: { value: number; displayValue: string } };
        deaths: { basic: { value: number; displayValue: string } };
        assists: { basic: { value: number; displayValue: string } };
        activityDurationSeconds: { basic: { value: number; displayValue: string } };
        completionReason: { basic: { value: number; displayValue: string } };
    };
    period: string;
    characterId?: string; // Added
}

export interface PGCRPlayer {
    player: {
        destinyUserInfo: {
            displayName: string;
            iconPath: string;
            membershipId: string;
            membershipType: number;
            bungieGlobalDisplayName: string;
            bungieGlobalDisplayNameCode: number;
        };
        characterClass: string;
        classHash: number;
        lightLevel: number;
        emblemPath: string;
        emblemBackgroundPath: string;
    };
    values: {
        kills: { basic: { value: number; displayValue: string } };
        deaths: { basic: { value: number; displayValue: string } };
        assists: { basic: { value: number; displayValue: string } };
        completed: { basic: { value: number; displayValue: string } };
        activityDurationSeconds: { basic: { value: number; displayValue: string } };
    };
}

export function useActivityHistory() {
    const { profile } = useDestinyProfileContext();
    const characterIds = profile?.characters?.data ? Object.keys(profile.characters.data) : [];
    const membershipType = profile?.profile?.data?.userInfo?.membershipType;
    const membershipId = profile?.profile?.data?.userInfo?.membershipId;

    const [raidHistory, setRaidHistory] = useState<ActivityHistoryItem[]>([]);
    const [dungeonHistory, setDungeonHistory] = useState<ActivityHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Fetch history when profile is loaded
    // Currently fetching page 0 (up to 250 items per char). 
    // This covers a lot of history. 
    // To get *more* historical data we would need to loop pages until no more results.
    useEffect(() => {
        if (!membershipType || !membershipId || characterIds.length === 0) return;

        const fetchHistory = async () => {
            setLoading(true);
            const cacheKey = `history_${membershipType}_${membershipId}_${characterIds.sort().join('_')}`;
            
            // Try loading from cache first
            const cachedData = await getCachedHistory(cacheKey);
            if (cachedData) {
                setRaidHistory(cachedData.raids);
                setDungeonHistory(cachedData.dungeons);
                setLoading(false);
                // We can choose to re-fetch in background or just return
                // For now, let's just return to be fast. 
                // Or maybe only fetch if cache is old? The lib handles expiry (1 hour).
                return;
            }

            try {
                const raids: ActivityHistoryItem[] = [];
                const dungeons: ActivityHistoryItem[] = [];

                // For each character, let's try to fetch at least 250 items which is page 0.
                // If we wanted deeper history, we could iterate pages.
                // Bungie API page size max is 250.
                for (const charId of characterIds) {
                    // Fetch Raids (Mode 4)
                    try {
                        let page = 0;
                        let hasMore = true;
                        while (hasMore) {
                            const raidRes = await getActivityHistory(membershipType, membershipId, charId, 4, 250, page);
                            const activities = raidRes.data.Response?.activities;
                            
                            if (activities && activities.length > 0) {
                                raids.push(...activities.map((a: any) => ({ ...a, characterId: charId })));
                                page++;
                            } else {
                                hasMore = false;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to fetch raid history for char ${charId}`, e);
                    }

                    // Fetch Dungeons (Mode 82)
                    try {
                        let page = 0;
                        let hasMore = true;
                        while (hasMore) {
                            const dungeonRes = await getActivityHistory(membershipType, membershipId, charId, 82, 250, page);
                            const activities = dungeonRes.data.Response?.activities;

                            if (activities && activities.length > 0) {
                                dungeons.push(...activities.map((a: any) => ({ ...a, characterId: charId })));
                                page++;
                            } else {
                                hasMore = false;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to fetch dungeon history for char ${charId}`, e);
                    }
                }

                // Deduplicate by instanceId
                const uniqueRaids = Array.from(new Map(raids.map(item => [item.activityDetails.instanceId, item])).values());
                const uniqueDungeons = Array.from(new Map(dungeons.map(item => [item.activityDetails.instanceId, item])).values());

                // Filter out any known invalid instances before storing
                const invalidIds = await getInvalidInstanceIds();
                const hasMethod = typeof (invalidIds as any)?.has === 'function';

                const filteredRaids = uniqueRaids.filter(r => !(hasMethod ? invalidIds.has(r.activityDetails.instanceId) : false));
                const filteredDungeons = uniqueDungeons.filter(d => !(hasMethod ? invalidIds.has(d.activityDetails.instanceId) : false));

                // Sort by date (newest first)
                filteredRaids.sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime());
                filteredDungeons.sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime());

                setRaidHistory(filteredRaids);
                setDungeonHistory(filteredDungeons);

                // Save to cache (setCachedHistory will also filter)
                await setCachedHistory(cacheKey, { raids: filteredRaids, dungeons: filteredDungeons });

            } catch (err) {
                console.error("Error fetching activity history", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [membershipType, membershipId, characterIds.join(',')]);

    // Function to force refresh the cache
    const refreshHistory = useCallback(async () => {
        if (!membershipType || !membershipId || characterIds.length === 0) return;
        
        // Clear the cache to force a fresh fetch
        await clearCache();
        
        // Reset state and trigger re-fetch
        setRaidHistory([]);
        setDungeonHistory([]);
        setLoading(true);
        
        // The useEffect will handle the re-fetch since loading state changed
    }, [membershipType, membershipId, characterIds]);

    return {
        raidHistory,
        dungeonHistory,
        isLoadingHistory: loading,
        refreshHistory
    };
}

// Fetch PGCR via server proxy (required due to CORS restrictions on Bungie's PGCR endpoint)
const fetchPGCR = async (instanceId: string) => {
    const res = await fetch(`/api/pgcr/${instanceId}`);
    const data = await res.json();
    return data.Response;
};

export function usePGCR(instanceId: string | null) {
    const { data, error, isLoading } = useSWR(
        instanceId ? `pgcr/${instanceId}` : null,
        () => fetchPGCR(instanceId!)
    );

    return {
        pgcr: data,
        isLoading,
        isError: error
    };
}
