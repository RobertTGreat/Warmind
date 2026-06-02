import { useState, useEffect } from 'react';
import { ActivityHistoryItem, fetchHistoryForMode } from './useActivityHistory';

interface OtherUserActivityHistoryOptions {
    includeAllActivities?: boolean;
}

const ALL_ACTIVITY_MODE = 0;
const RAID_ACTIVITY_MODE = 4;
const DUNGEON_ACTIVITY_MODE = 82;

export function useOtherUserActivityHistory(
    membershipType: number | null,
    destinyMembershipId: string | null,
    characterIds: string[],
    options: OtherUserActivityHistoryOptions = {}
) {
    const [raidHistory, setRaidHistory] = useState<ActivityHistoryItem[]>([]);
    const [dungeonHistory, setDungeonHistory] = useState<ActivityHistoryItem[]>([]);
    const [allHistory, setAllHistory] = useState<ActivityHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingAllHistory, setLoadingAllHistory] = useState(false);
    const includeAllActivities = options.includeAllActivities ?? false;

    useEffect(() => {
        if (!membershipType || !destinyMembershipId || characterIds.length === 0) {
            setRaidHistory([]);
            setDungeonHistory([]);
            setAllHistory([]);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const sortedCharacterIds = [...characterIds].sort();
                const [raids, dungeons] = await Promise.all([
                    fetchHistoryForMode(membershipType, destinyMembershipId, sortedCharacterIds, RAID_ACTIVITY_MODE),
                    fetchHistoryForMode(membershipType, destinyMembershipId, sortedCharacterIds, DUNGEON_ACTIVITY_MODE),
                ]);

                setRaidHistory(raids);
                setDungeonHistory(dungeons);
            } catch (err) {
                console.error("Error fetching activity history", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [membershipType, destinyMembershipId, characterIds.join(',')]);

    useEffect(() => {
        if (!includeAllActivities || !membershipType || !destinyMembershipId || characterIds.length === 0) {
            if (!includeAllActivities) {
                setAllHistory([]);
            }
            return;
        }

        const fetchAllHistory = async () => {
            setLoadingAllHistory(true);

            try {
                const allActivities = await fetchHistoryForMode(
                    membershipType,
                    destinyMembershipId,
                    [...characterIds].sort(),
                    ALL_ACTIVITY_MODE
                );

                setAllHistory(allActivities);
            } catch (error) {
                console.error("Error fetching all activity history", error);
            } finally {
                setLoadingAllHistory(false);
            }
        };

        fetchAllHistory();
    }, [includeAllActivities, membershipType, destinyMembershipId, characterIds.join(',')]);

    return {
        raidHistory,
        dungeonHistory,
        allHistory,
        isLoadingHistory: loading,
        isLoadingAllHistory: loadingAllHistory,
    };
}

