import { useQuery } from '@tanstack/react-query';
import { getActivityHistory } from '@/lib/bungie';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getCachedHistory, setCachedHistory, clearCache, getInvalidInstanceIds, getOrFetchPGCR } from '@/lib/activityCache';

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
        playerCount?: { basic: { value: number; displayValue: string } };
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

interface UseActivityHistoryOptions {
    includeAllActivities?: boolean;
}

const ALL_ACTIVITY_MODE = 0;
const RAID_ACTIVITY_MODE = 4;
const DUNGEON_ACTIVITY_MODE = 82;

async function fetchHistoryForCharacter(
    membershipType: number,
    membershipId: string,
    characterId: string,
    mode: number
) {
    const characterHistory: ActivityHistoryItem[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const response = await getActivityHistory(membershipType, membershipId, characterId, mode, 250, page);
        const activities = response.data.Response?.activities;

        if (activities && activities.length > 0) {
            characterHistory.push(...activities.map((activity: any) => ({ ...activity, characterId })));
            page++;
        } else {
            hasMore = false;
        }
    }

    return characterHistory;
}

export async function fetchHistoryForMode(
    membershipType: number,
    membershipId: string,
    characterIds: string[],
    mode: number
) {
    const historyByCharacter = await Promise.all(
        characterIds.map(async (characterId) => {
            try {
                return await fetchHistoryForCharacter(membershipType, membershipId, characterId, mode);
            } catch (error) {
                console.error(`Failed to fetch mode ${mode} history for character ${characterId}`, error);
                return [];
            }
        })
    );
    const activityHistory = historyByCharacter.flat();

    return filterAndSortHistory(activityHistory);
}

async function filterAndSortHistory(history: ActivityHistoryItem[]) {
    const uniqueHistory = Array.from(
        new Map(history.map((activity) => [activity.activityDetails.instanceId, activity])).values()
    );

    const invalidIds = await getInvalidInstanceIds();
    const filteredHistory = uniqueHistory.filter((activity) => !invalidIds.has(activity.activityDetails.instanceId));

    filteredHistory.sort((firstActivity, secondActivity) => (
        new Date(secondActivity.period).getTime() - new Date(firstActivity.period).getTime()
    ));

    return filteredHistory;
}

export function useActivityHistory(options: UseActivityHistoryOptions = {}) {
    const includeAllActivities = options.includeAllActivities ?? false;
    const { profile } = useDestinyProfileContext();
    const characterIds = profile?.characters?.data ? Object.keys(profile.characters.data) : [];
    const membershipType = profile?.profile?.data?.userInfo?.membershipType;
    const membershipId = profile?.profile?.data?.userInfo?.membershipId;
    const sortedCharacterIds = useMemo(() => [...characterIds].sort(), [characterIds.join(',')]);

    const [raidHistory, setRaidHistory] = useState<ActivityHistoryItem[]>([]);
    const [dungeonHistory, setDungeonHistory] = useState<ActivityHistoryItem[]>([]);
    const [allHistory, setAllHistory] = useState<ActivityHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingAllHistory, setLoadingAllHistory] = useState(false);

    useEffect(() => {
        if (!membershipType || !membershipId || characterIds.length === 0) return;

        const fetchHistory = async () => {
            setLoading(true);
            const cacheKey = `history_v2_${membershipType}_${membershipId}_${sortedCharacterIds.join('_')}`;
            
            const cachedData = await getCachedHistory(cacheKey);
            if (cachedData) {
                setRaidHistory(cachedData.raids);
                setDungeonHistory(cachedData.dungeons);
                setLoading(false);
                return;
            }

            try {
                const [raids, dungeons] = await Promise.all([
                    fetchHistoryForMode(membershipType, membershipId, sortedCharacterIds, RAID_ACTIVITY_MODE),
                    fetchHistoryForMode(membershipType, membershipId, sortedCharacterIds, DUNGEON_ACTIVITY_MODE),
                ]);

                setRaidHistory(raids);
                setDungeonHistory(dungeons);

                await setCachedHistory(cacheKey, { raids, dungeons });

            } catch (err) {
                console.error("Error fetching activity history", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [membershipType, membershipId, sortedCharacterIds.join(',')]);

    useEffect(() => {
        if (!includeAllActivities || !membershipType || !membershipId || sortedCharacterIds.length === 0) {
            if (!includeAllActivities) {
                setAllHistory([]);
            }
            return;
        }

        const fetchAllHistory = async () => {
            setLoadingAllHistory(true);
            const cacheKey = `all_history_v1_${membershipType}_${membershipId}_${sortedCharacterIds.join('_')}`;

            const cachedData = await getCachedHistory(cacheKey);
            if (cachedData?.allActivities) {
                setAllHistory(cachedData.allActivities);
                setLoadingAllHistory(false);
                return;
            }

            try {
                const allActivities = await fetchHistoryForMode(
                    membershipType,
                    membershipId,
                    sortedCharacterIds,
                    ALL_ACTIVITY_MODE
                );

                setAllHistory(allActivities);
                await setCachedHistory(cacheKey, { raids: [], dungeons: [], allActivities });
            } catch (error) {
                console.error("Error fetching all activity history", error);
            } finally {
                setLoadingAllHistory(false);
            }
        };

        fetchAllHistory();
    }, [includeAllActivities, membershipType, membershipId, sortedCharacterIds.join(',')]);

    // Function to force refresh the cache
    const refreshHistory = useCallback(async () => {
        if (!membershipType || !membershipId || characterIds.length === 0) return;
        
        // Clear the cache to force a fresh fetch
        await clearCache();
        
        // Reset state and trigger re-fetch
        setRaidHistory([]);
        setDungeonHistory([]);
        setAllHistory([]);
        setLoading(true);
        setLoadingAllHistory(false);
        
        // The useEffect will handle the re-fetch since loading state changed
    }, [membershipType, membershipId, characterIds]);

    return {
        raidHistory,
        dungeonHistory,
        allHistory,
        isLoadingHistory: loading,
        isLoadingAllHistory: loadingAllHistory,
        refreshHistory
    };
}

export function usePGCR(instanceId: string | null) {
    const { data, error, isLoading } = useQuery({
        queryKey: ['pgcr', instanceId],
        queryFn: () => getOrFetchPGCR(instanceId!),
        enabled: Boolean(instanceId),
        staleTime: 24 * 60 * 60 * 1000,
        gcTime: 7 * 24 * 60 * 60 * 1000,
    });

    return {
        pgcr: data,
        isLoading,
        isError: error
    };
}
